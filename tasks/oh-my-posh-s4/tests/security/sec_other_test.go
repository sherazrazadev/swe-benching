package ompverify

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func gitRepoWithBranch(t *testing.T, work, branch string) string {
	t.Helper()
	repo := filepath.Join(work, "repo")
	if err := os.MkdirAll(repo, 0o755); err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", repo, "-c", "user.email=task@example.com", "-c", "user.name=task", "-c", "commit.gpgsign=false"}, args...)...)
		cmd.Env = []string{"PATH=" + os.Getenv("PATH"), "HOME=" + work, "GIT_CONFIG_NOSYSTEM=1", "TZ=UTC"}
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}
	run("init", "-q", "-b", "main")
	run("commit", "-q", "--allow-empty", "-m", "init")
	run("checkout", "-q", "-b", branch)
	return repo
}

// Text the product takes from a repository it inspects is not theme text and
// must not be able to run a program when the prompt displays it.
func TestSec_RepositoryTextCommand(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	leak := "LEAKMARKER-REPO"
	binDir := filepath.Join(work, "bin")
	hostileMarker(t, binDir, "OMP_MARKER", marker, leak)

	repo := gitRepoWithBranch(t, work, `{{"OMP_MARKER"|cmd}}`)
	cfg := writeTheme(t, work, map[string]any{
		"type":     "git",
		"style":    "plain",
		"options":  map[string]any{},
		"template": " {{ .HEAD }} ",
	})

	r := runPrimary(t, work, cfg, repo, []string{withPath(binDir)})
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("repository metadata ran a command when displayed; marker %q was created\nstdout: %q", marker, r.stdout)
	}
	if strings.Contains(r.stdout, leak) {
		t.Fatalf("repository metadata ran a command and its output reached the prompt\nstdout: %q", r.stdout)
	}
}

// A value that a theme obtains from outside itself (here, a variable in the
// process environment) must not be interpreted as a program to run when the
// product resolves it a second time.
func TestSec_ResolvedValueCommand(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	leak := "LEAKMARKER-HTTP"
	binDir := filepath.Join(work, "bin")
	hostileMarker(t, binDir, "OMP_MARKER", marker, leak)

	cfg := writeTheme(t, work, map[string]any{
		"type":  "http",
		"style": "plain",
		"options": map[string]any{
			"url":     "http://127.0.0.1:1/{{ .Env.OMP_TEST_VALUE }}",
			"timeout": 500,
		},
		"template": "{{ .Body }}",
	})

	env := []string{withPath(binDir), `OMP_TEST_VALUE={{"OMP_MARKER"|cmd}}`}
	r := runPrimary(t, work, cfg, work, env)
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("a value obtained from outside the theme ran a command; marker %q was created\nstdout: %q", marker, r.stdout)
	}
	if strings.Contains(r.stdout, leak) {
		t.Fatalf("a value obtained from outside the theme ran a command and its output reached the prompt\nstdout: %q", r.stdout)
	}
}
