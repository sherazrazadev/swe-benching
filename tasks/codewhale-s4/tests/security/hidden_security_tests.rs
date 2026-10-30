//! Hidden security tests: caller-supplied revisions must never reach git as options.
//!
//! Every test drives the product's real entry point (the tool handler), uses a
//! harmless marker path outside the workspace as the would-be write target, and
//! asserts that the attempt is refused and the marker is untouched.

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

/// A repository with two commits and one uncommitted change.
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
    // An uncommitted change so working-tree diffs are non-empty.
    fs::write(repo.join("file.txt"), "one\ntwo\nthree\n").expect("write");
}

fn outside_entries(dir: &Path) -> Vec<String> {
    fs::read_dir(dir)
        .expect("read outside dir")
        .map(|entry| entry.expect("entry").file_name().to_string_lossy().to_string())
        .collect()
}

fn review_client() -> DeepSeekClient {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let config = crate::config::Config {
        api_key: Some("test-key".to_string()),
        ..crate::config::Config::default()
    };
    DeepSeekClient::new(&config).expect("client constructs offline")
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
        review_client(),
        "deepseek-v4-flash".to_string(),
        context.clone(),
        true,
        None,
        manager.clone(),
    );
    let tool = AgentTool::new(manager, runtime);
    tool.execute(
        json!({
            "prompt": "security probe",
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

fn refused(result: &Result<crate::tools::spec::ToolResult, crate::tools::spec::ToolError>) {
    match result {
        Ok(value) => assert!(!value.success, "option-shaped revision was accepted"),
        Err(_) => {}
    }
}

// -- the published protected sink: showing a revision -----------------------

#[tokio::test]
async fn sec_show_revision_option_write_is_refused() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let outside = tempdir().expect("outside");
    let marker = outside.path().join("patch.txt");
    let context = ToolContext::new(repo.path());

    let result = GitShowTool
        .execute(
            json!({ "rev": format!("--output={}", marker.display()) }),
            &context,
        )
        .await;

    let entries = outside_entries(outside.path());
    assert!(
        entries.is_empty(),
        "an option-shaped revision wrote outside the workspace: {entries:?}"
    );
    refused(&result);
}

#[tokio::test]
async fn sec_blame_revision_option_write_is_refused() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let outside = tempdir().expect("outside");
    let marker = outside.path().join("blame.txt");
    fs::write(&marker, "precious\n").expect("write");
    let context = ToolContext::new(repo.path());

    let result = GitBlameTool
        .execute(
            json!({
                "path": "file.txt",
                "rev": format!("--output={}", marker.display())
            }),
            &context,
        )
        .await;

    let contents = fs::read(&marker).expect("marker still readable");
    assert_eq!(
        contents, b"precious\n",
        "an option-shaped revision changed a file outside the workspace"
    );
    refused(&result);
}

// -- a listing operation whose start points arrive as a list ----------------

#[tokio::test]
async fn sec_log_revision_list_option_write_is_refused() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let outside = tempdir().expect("outside");
    let marker = outside.path().join("log.txt");
    let context = ToolContext::new(repo.path());

    let result = GitLogTool
        .execute(
            json!({ "revs": [format!("--output={}", marker.display())] }),
            &context,
        )
        .await;

    let entries = outside_entries(outside.path());
    assert!(
        entries.is_empty(),
        "an option-shaped list entry wrote outside the workspace: {entries:?}"
    );
    refused(&result);
}

#[tokio::test]
async fn sec_log_revision_list_option_after_legit_entry_is_refused() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let outside = tempdir().expect("outside");
    let marker = outside.path().join("log2.txt");
    let context = ToolContext::new(repo.path());

    let result = GitLogTool
        .execute(
            json!({ "revs": ["HEAD", format!("--output={}", marker.display())] }),
            &context,
        )
        .await;

    let entries = outside_entries(outside.path());
    assert!(
        entries.is_empty(),
        "an option-shaped list entry after a real revision wrote outside the workspace: {entries:?}"
    );
    refused(&result);
}

// -- a diff operation whose comparison base arrives from the caller ---------

#[tokio::test]
async fn sec_diff_base_option_write_is_refused() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let outside = tempdir().expect("outside");
    let marker = outside.path().join("diff.txt");
    let context = ToolContext::new(repo.path());

    let result = GitDiffTool
        .execute(
            json!({ "base": format!("--output={}", marker.display()) }),
            &context,
        )
        .await;

    let entries = outside_entries(outside.path());
    assert!(
        entries.is_empty(),
        "an option-shaped comparison base wrote outside the workspace: {entries:?}"
    );
    refused(&result);
}

// -- a separate product feature that compares against a caller-supplied ref -

#[tokio::test]
async fn sec_review_base_option_write_is_refused() {
    if !git_available() {
        return;
    }
    let repo = repo_with_history();
    let outside = tempdir().expect("outside");
    let marker = outside.path().join("review.txt");
    let context = ToolContext::new(repo.path());
    let tool = ReviewTool::new(Some(review_client()), "deepseek-v4-flash".to_string());

    let result = tool
        .execute(
            json!({
                "target": "diff",
                "base": format!("--output={}", marker.display())
            }),
            &context,
        )
        .await;

    let entries = outside_entries(outside.path());
    assert!(
        entries.is_empty(),
        "an option-shaped review base wrote outside the workspace: {entries:?}"
    );
    refused(&result);
}

// -- workspace isolation that starts a checkout from a caller-supplied ref --

#[tokio::test]
async fn sec_worktree_base_option_is_refused() {
    if !git_available() {
        return;
    }
    let (_base, repo) = named_repo();
    let rel = "opt-base-checkout";
    let branch = "opt-base-checkout";
    let expected = worktree_path(&repo, rel);

    let result = run_agent_worktree(&repo, "--no-checkout", rel, branch).await;
    let created = expected.exists();

    // Test-side clean-up before asserting, so a failure leaves nothing behind.
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
        !created,
        "an option-shaped base created a checkout outside the workspace"
    );
    refused(&result);
}
