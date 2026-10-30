package ompverify

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func mkdirAll(t *testing.T, path string) string {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

// An ordinary directory still renders as an ordinary path.
func TestFunc_NormalPathRenders(t *testing.T) {
	work := t.TempDir()
	pwd := mkdirAll(t, filepath.Join(work, "projects", "sample"))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "projects") || !strings.Contains(r.stdout, "sample") {
		t.Fatalf("an ordinary path did not render\nstdout: %q", r.stdout)
	}
}

// A template written in the theme keeps its full helper set: running a command
// from theme text is intended behaviour.
func TestFunc_ThemedTemplateRunsCommand(t *testing.T) {
	work := t.TempDir()
	pwd := mkdirAll(t, filepath.Join(work, "dir"))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, ` {{ cmd "echo" "hello-from-theme" }} `))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "hello-from-theme") {
		t.Fatalf("a command written in the theme stopped working\nstdout: %q", r.stdout)
	}
}

// Theme text may read a file; that is the user's own choice and keeps working.
func TestFunc_ThemedTemplateReadsFile(t *testing.T) {
	work := t.TempDir()
	pwd := mkdirAll(t, filepath.Join(work, "dir"))
	data := filepath.Join(work, "data.txt")
	if err := os.WriteFile(data, []byte("FILEDATA-42"), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, ` {{ readFile "`+data+`" }} `))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "FILEDATA-42") {
		t.Fatalf("reading a file from theme text stopped working\nstdout: %q", r.stdout)
	}
}

// Theme text may read and expand a process variable; that keeps working.
func TestFunc_ThemedTemplateReadsVariable(t *testing.T) {
	work := t.TempDir()
	pwd := mkdirAll(t, filepath.Join(work, "dir"))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, ` {{ env "OMP_TEST_ENV" }} `))

	r := runPrimary(t, work, cfg, pwd, []string{"OMP_TEST_ENV=env-value-9"})
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "env-value-9") {
		t.Fatalf("reading a variable from theme text stopped working\nstdout: %q", r.stdout)
	}
}

// A mapped-location key written in the theme keeps being interpreted as theme
// text and keeps matching the path it describes.
func TestFunc_MappedLocationKeyTemplate(t *testing.T) {
	work := t.TempDir()
	home := mkdirAll(t, filepath.Join(work, "home"))
	pwd := mkdirAll(t, filepath.Join(home, "d"))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style": "full",
		"mapped_locations": map[string]any{
			`{{ .Env.HOME }}/d`: "#",
		},
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, []string{"HOME=" + home})
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "#") {
		t.Fatalf("a mapped-location key written in the theme stopped resolving\nstdout: %q", r.stdout)
	}
}

// The path segment's separator option is theme text and may run a command.
func TestFunc_FolderSeparatorTemplateRunsCommand(t *testing.T) {
	work := t.TempDir()
	pwd := mkdirAll(t, filepath.Join(work, "a", "b"))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
		"folder_separator_template": `{{ cmd "echo" "SEP9" }}`,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "SEP9") {
		t.Fatalf("the separator option written in the theme stopped running its command\nstdout: %q", r.stdout)
	}
}

// A repository branch still displays normally.
func TestFunc_GitBranchRenders(t *testing.T) {
	work := t.TempDir()
	repo := filepath.Join(work, "repo")
	mkdirAll(t, repo)
	run := func(args ...string) {
		cmd := exec.Command("git", append([]string{"-C", repo, "-c", "user.email=task@example.com", "-c", "user.name=task", "-c", "commit.gpgsign=false"}, args...)...)
		cmd.Env = []string{"PATH=" + os.Getenv("PATH"), "HOME=" + work, "GIT_CONFIG_NOSYSTEM=1", "TZ=UTC"}
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %v\n%s", args, err, out)
		}
	}
	run("init", "-q", "-b", "feature/work")
	run("commit", "-q", "--allow-empty", "-m", "init")

	cfg := writeTheme(t, work, map[string]any{
		"type":     "git",
		"style":    "plain",
		"options":  map[string]any{},
		"template": " {{ .HEAD }} ",
	})
	r := runPrimary(t, work, cfg, repo, nil)
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "feature/work") {
		t.Fatalf("a normal branch name stopped rendering\nstdout: %q", r.stdout)
	}
}

// An HTTP endpoint whose address is built from a normal variable still works.
func TestFunc_HTTPURLFromVariable(t *testing.T) {
	var seenMu sync.Mutex
	var seen string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenMu.Lock()
		seen = r.URL.Path
		seenMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"message":"pong"}`)
	}))
	defer server.Close()

	work := t.TempDir()
	cfg := writeTheme(t, work, map[string]any{
		"type":  "http",
		"style": "plain",
		"options": map[string]any{
			"url":     server.URL + "/{{ .Env.OMP_TEST_PATH }}",
			"timeout": 2000,
		},
		"template": " {{ .Body.message }} ",
	})

	r := runPrimary(t, work, cfg, work, []string{"OMP_TEST_PATH=ping"})
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, "pong") {
		t.Fatalf("an HTTP segment whose address uses a variable stopped working\nstdout: %q\nstderr: %q", r.stdout, r.stderr)
	}
	seenMu.Lock()
	requested := seen
	seenMu.Unlock()
	if requested != "/ping" {
		t.Fatalf("the HTTP segment requested %q, want %q", requested, "/ping")
	}
}

// A mapped-location value written in the theme may carry a harmless template
// expression; it must keep resolving when the displayed path is built.
func TestFunc_MappedLocationValueTemplate(t *testing.T) {
	work := t.TempDir()
	home := mkdirAll(t, filepath.Join(work, "home"))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style": "full",
		"mapped_locations": map[string]any{
			"/mapped": "{{ .Env.HOME }}/x",
		},
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, "/mapped/sub", []string{"HOME=" + home})
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, home) {
		t.Fatalf("a mapped-location value written in the theme stopped resolving\nstdout: %q", r.stdout)
	}
}

// Text that merely looks like a template but cannot be parsed is still shown
// as it was, not stripped or escaped.
func TestFunc_LiteralFolderTextPreserved(t *testing.T) {
	work := t.TempDir()
	folder := `{{ missingHelper "x" }}`
	pwd := mkdirAll(t, filepath.Join(work, folder))
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if !strings.Contains(r.stdout, folder) {
		t.Fatalf("a directory name was altered instead of being shown as it is\nstdout: %q", r.stdout)
	}
}
