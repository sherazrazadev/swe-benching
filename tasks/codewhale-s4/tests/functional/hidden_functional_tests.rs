//! Hidden functional tests: ordinary revisions, comparisons and checkouts keep working.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::json;
use tempfile::tempdir;

use crate::client::DeepSeekClient;
use crate::tools::git::GitDiffTool;
use crate::tools::git_history::{GitBlameTool, GitLogTool, GitShowTool};
use crate::tools::review::ReviewTool;
use crate::tools::spec::{ToolContext, ToolSpec};
use crate::tools::subagent::{AgentTool, SubAgentRuntime, new_shared_subagent_manager};

fn git_available() -> bool {
    Command::new("git")
        .arg("--version")
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

fn git(root: &Path, args: &[&str]) {
    let out = Command::new("git")
        .args(args)
        .current_dir(root)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_AUTHOR_NAME", "Test User")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test User")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .output()
        .expect("git should spawn");
    assert!(
        out.status.success(),
        "git {args:?} failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

fn repo_with_history() -> tempfile::TempDir {
    let repo = tempdir().expect("repo");
    populate_repo(repo.path());
    repo
}

/// The same history in a directory named `work`, so a sibling checkout path is
/// predictable from the product's own naming rules.
fn named_repo() -> (tempfile::TempDir, PathBuf) {
    let base = tempdir().expect("base");
    let root = base.path().join("work");
    fs::create_dir_all(&root).expect("mkdir");
    populate_repo(&root);
    (base, root)
}

fn populate_repo(repo: &Path) {
    git(repo, &["init", "-q", "-b", "main"]);
    git(repo, &["config", "core.autocrlf", "false"]);
    git(repo, &["config", "commit.gpgsign", "false"]);
    git(repo, &["config", "user.name", "Test User"]);
    git(repo, &["config", "user.email", "test@example.com"]);
    fs::write(repo.join("file.txt"), "one\n").expect("write");
    git(repo, &["add", "."]);
    git(repo, &["commit", "-q", "-m", "first"]);
    fs::write(repo.join("file.txt"), "one\ntwo\n").expect("write");
    git(repo, &["add", "."]);
    git(repo, &["commit", "-q", "-m", "second"]);
    git(repo, &["branch", "release-1.0"]);
    git(repo, &["branch", "release-0.9", "HEAD~1"]);
    fs::write(repo.join("file.txt"), "one\ntwo\nthree\n").expect("write");
}

/// A loopback chat-completions stub, so the review feature can run offline.
async fn review_client() -> DeepSeekClient {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let app = axum::Router::new().route(
        "/{*path}",
        axum::routing::post(|| async {
            axum::Json(json!({
                "id": "chatcmpl-test",
                "model": "deepseek-v4-flash",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "{\"summary\":\"looks fine\",\"issues\":[],\"suggestions\":[],\"overall_assessment\":\"ok\"}"
                    },
                    "finish_reason": "stop"
                }],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
            }))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind stub server");
    let addr = listener.local_addr().expect("stub addr");
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    let config = crate::config::Config {
        api_key: Some("test-key".to_string()),
        base_url: Some(format!("http://{addr}/v1")),
        ..crate::config::Config::default()
    };
    DeepSeekClient::new(&config).expect("review client")
}

fn worktree_path(repo: &Path, rel: &str) -> PathBuf {
    let parent = repo.parent().expect("repo parent");
    parent.join(".codewhale-worktrees").join("work").join(rel)
}

async fn run_agent_worktree(
    repo: &Path,
    base: &str,
    rel_path: &str,
    branch: &str,
) -> Result<crate::tools::spec::ToolResult, crate::tools::spec::ToolError> {
    let context = ToolContext::new(repo.to_path_buf());
    let manager = new_shared_subagent_manager(repo.to_path_buf(), 5);
    let runtime = SubAgentRuntime::new(
        review_client().await,
        "deepseek-v4-flash".to_string(),
        context.clone(),
        true,
        None,
        manager.clone(),
    );
    let tool = AgentTool::new(manager, runtime);
    tool.execute(
        json!({
            "prompt": "functional probe",
            "worktree": true,
            "worktree_branch": branch,
            "worktree_path": rel_path,
            "worktree_base": base,
            "model": "not-a-real-model"
        }),
        &context,
    )
    .await
}

// -- showing revisions ------------------------------------------------------

#[tokio::test]
async fn fun_show_head_returns_patch() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitShowTool
        .execute(json!({ "rev": "HEAD", "stat": false }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("+two"));
}

#[tokio::test]
async fn fun_show_hyphenated_branch_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitShowTool
        .execute(
            json!({ "rev": "release-1.0", "stat": false }),
            &context,
        )
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("second"));
}

#[tokio::test]
async fn fun_show_ancestry_expression_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitShowTool
        .execute(json!({ "rev": "HEAD~1", "stat": false }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("first"));
}

#[tokio::test]
async fn fun_show_range_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitShowTool
        .execute(
            json!({ "rev": "HEAD~1..HEAD", "stat": false }),
            &context,
        )
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("second"));
}

#[tokio::test]
async fn fun_show_revision_path_form_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitShowTool
        .execute(json!({ "rev": "HEAD:file.txt", "stat": false }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("one"));
}

// -- line attribution -------------------------------------------------------

#[tokio::test]
async fn fun_blame_default_revision_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitBlameTool
        .execute(json!({ "path": "file.txt", "max_lines": 1 }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("Test User"));
}

#[tokio::test]
async fn fun_blame_explicit_revision_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitBlameTool
        .execute(
            json!({ "path": "file.txt", "rev": "HEAD", "max_lines": 1 }),
            &context,
        )
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("Test User"));
}

// -- history listing --------------------------------------------------------

#[tokio::test]
async fn fun_log_default_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitLogTool
        .execute(json!({ "max_count": 1 }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("Subject: second"));
}

#[tokio::test]
async fn fun_log_revision_list_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitLogTool
        .execute(json!({ "revs": ["HEAD"], "max_count": 1 }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("Subject: second"));
}

#[tokio::test]
async fn fun_log_multiple_revision_list_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitLogTool
        .execute(json!({ "revs": ["HEAD", "HEAD~1"] }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("second"));
    assert!(result.content.contains("first"));
}

// -- diffs ------------------------------------------------------------------

#[tokio::test]
async fn fun_diff_default_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitDiffTool
        .execute(json!({}), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("+three"));
}

#[tokio::test]
async fn fun_diff_ancestry_base_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let result = GitDiffTool
        .execute(json!({ "base": "HEAD~1" }), &context)
        .await
        .expect("execute");
    assert!(result.success);
    assert!(result.content.contains("+two"));
}

// -- review against a base --------------------------------------------------

#[tokio::test]
async fn fun_review_branch_base_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let tool = ReviewTool::new(Some(review_client().await), "deepseek-v4-flash".to_string());
    let result = tool
        .execute(json!({ "target": "diff", "base": "release-0.9" }), &context)
        .await
        .expect("execute");
    assert!(result.success);
}

#[tokio::test]
async fn fun_review_without_base_works() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let context = ToolContext::new(repo.path());
    let tool = ReviewTool::new(Some(review_client().await), "deepseek-v4-flash".to_string());
    let result = tool
        .execute(json!({ "target": "diff" }), &context)
        .await
        .expect("execute");
    assert!(result.success);
}

// -- isolated checkout from a base ------------------------------------------

#[tokio::test]
async fn fun_worktree_legit_base_still_checks_out() {
    if !git_available() {
        return;
    }
    let (_base, repo) = named_repo();
    let rel = "legit-base-checkout";
    let branch = "legit-base-checkout";
    let expected = worktree_path(&repo, rel);

    let _ = run_agent_worktree(&repo, "HEAD", rel, branch).await;
    let created = expected.exists();

    let _ = Command::new("git")
        .args(["worktree", "remove", "--force"])
        .arg(&expected)
        .current_dir(&repo)
        .output();
    let _ = fs::remove_dir_all(&expected);
    let _ = Command::new("git")
        .args(["branch", "-D", branch])
        .current_dir(&repo)
        .output();

    assert!(
        created,
        "a legitimate base revision no longer creates the isolated checkout"
    );
}
