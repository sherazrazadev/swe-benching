package harness

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/argoproj/argo-cd/v3/util/kustomize"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v failed: %v: %s", args, err, out)
	}
}

// BuildKustomizeWithProxy runs the kustomize build entry point against a local file:// remote
// base with the supplied repository proxy, which makes kustomize invoke git for the base. It
// returns the application directory (the build's working directory) and the build error.
func BuildKustomizeWithProxy(t *testing.T, proxyValue string) (string, error) {
	t.Helper()
	bin, err := exec.LookPath("kustomize")
	if err != nil {
		t.Fatalf("kustomize binary not found on PATH: %v", err)
	}
	root := t.TempDir()
	repo := filepath.Join(root, "repo")
	base := filepath.Join(repo, "base")
	if err := os.MkdirAll(base, 0o755); err != nil {
		t.Fatalf("mkdir base: %v", err)
	}
	writeFile(t, filepath.Join(base, "cm.yaml"), "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: base\n")
	writeFile(t, filepath.Join(base, "kustomization.yaml"), "resources:\n- cm.yaml\n")
	runGit(t, repo, "init", "-q", "-b", "main")
	runGit(t, repo, "add", "-A")
	runGit(t, repo, "-c", "user.name=task", "-c", "user.email=task@example.com", "commit", "-q", "-m", "init")

	app := filepath.Join(root, "app")
	if err := os.MkdirAll(app, 0o755); err != nil {
		t.Fatalf("mkdir app: %v", err)
	}
	writeFile(t, filepath.Join(app, "kustomization.yaml"), "resources:\n- file://"+repo+"//base?ref=main\n")

	t.Setenv("HOME", t.TempDir())
	k := kustomize.NewKustomizeApp(app, ".", git.NopCreds{}, "ssh://git@example.com/org/repo.git", bin, proxyValue, "")
	_, _, _, err = k.Build(nil, nil, nil, &kustomize.BuildOpts{})
	return app, err
}

// BuildKustomizeEnvWithProxy runs the kustomize build entry point with a stub kustomize binary
// that records the environment the real binary would receive. It returns that environment and
// the build error, so a test can check that a legitimate proxy is still applied by any design.
func BuildKustomizeEnvWithProxy(t *testing.T, proxyValue string) ([]string, error) {
	t.Helper()
	root := t.TempDir()
	app := filepath.Join(root, "app")
	if err := os.MkdirAll(app, 0o755); err != nil {
		t.Fatalf("mkdir app: %v", err)
	}
	envOut := filepath.Join(root, "env.out")
	stub := filepath.Join(root, "kustomize-stub")
	script := "#!/bin/sh\nprintf 'apiVersion: v1\\nkind: ConfigMap\\nmetadata:\\n  name: stub\\n'\nenv -0 > \"$KUSTOMIZE_ENV_OUT\"\n"
	if err := os.WriteFile(stub, []byte(script), 0o755); err != nil {
		t.Fatalf("write stub: %v", err)
	}
	t.Setenv("KUSTOMIZE_ENV_OUT", envOut)
	t.Setenv("HOME", t.TempDir())

	k := kustomize.NewKustomizeApp(app, ".", git.NopCreds{}, "ssh://git@example.com/org/repo.git", stub, proxyValue, "")
	_, _, _, err := k.Build(nil, nil, nil, &kustomize.BuildOpts{})
	data, readErr := os.ReadFile(envOut)
	if readErr != nil {
		return nil, err
	}
	return strings.Split(string(data), "\x00"), err
}
