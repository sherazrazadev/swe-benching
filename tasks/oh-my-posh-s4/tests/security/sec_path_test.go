package ompverify

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A directory name is the attacker input. When the prompt displays it, the
// product must not execute the command the name expresses.
func TestSec_PathFolderCommand(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	folder := `{{ cmd "touch" "PWNED" }}`
	pwd := filepath.Join(work, folder)
	if err := os.MkdirAll(pwd, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("a directory name ran a command; marker %q was created\nstdout: %q", marker, r.stdout)
	}
}

// A directory name must not be able to read a file and show its contents.
func TestSec_PathFolderFileRead(t *testing.T) {
	work := t.TempDir()
	secret := "TOPSECRET-987654"
	if err := os.WriteFile(filepath.Join(work, "secret"), []byte(secret), 0o644); err != nil {
		t.Fatal(err)
	}
	folder := `{{ readFile "secret" }}`
	pwd := filepath.Join(work, folder)
	if err := os.MkdirAll(pwd, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if strings.Contains(r.stdout, secret) {
		t.Fatalf("a directory name read a file and its contents reached the prompt\nstdout: %q", r.stdout)
	}
}

// The shell can hand the working directory over on a separate channel; the
// same protection applies there.
func TestSec_ShellSuppliedFolderCommand(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	folder := `{{ cmd "touch" "PWNED" }}`
	pwd := filepath.Join(work, "elsewhere")
	if err := os.MkdirAll(pwd, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
	}, " {{ .Path }} "))

	r := runOMP(t, work, nil,
		"print", "primary",
		"--config", cfg,
		"--pwd", pwd,
		"--pswd", filepath.Join(work, folder),
		"--shell", "pwsh",
		"--plain",
	)
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("a shell-supplied directory name ran a command; marker %q was created\nstdout: %q", marker, r.stdout)
	}
}

// The protection does not depend on which way the path is drawn.
func TestSec_FolderStyleCommand(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	folder := `{{ cmd "touch" "PWNED" }}`
	pwd := filepath.Join(work, folder)
	if err := os.MkdirAll(pwd, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "folder",
		"mapped_locations_enabled": false,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("a directory name ran a command under the folder style; marker %q was created\nstdout: %q", marker, r.stdout)
	}
}

// The text that reaches the display may already have been interpreted once as
// the user's own theme text. That earlier interpretation must not decide the
// helpers available for the runtime-composed text.
func TestSec_RepeatedTextKeepsRestriction(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	expr := `{{ cmd "touch" "PWNED" }}`
	text := `/{{ if .Path }}` + expr + `{{ end }}/X`

	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
		"mapped_locations": map[string]any{
			text: "#",
		},
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, text, nil)
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("text that was previously interpreted as theme text ran a command when it came back from runtime data; marker %q was created\nstdout: %q", marker, r.stdout)
	}
}

// A render's trust must belong to that render, not to a reusable internal
// object that a later render inherits.
func TestSec_RenderTrustIsPerRender(t *testing.T) {
	work := t.TempDir()
	marker := filepath.Join(work, "PWNED")
	folder := `{{ cmd "touch" "PWNED" }}`
	pwd := filepath.Join(work, folder)
	if err := os.MkdirAll(pwd, 0o755); err != nil {
		t.Fatal(err)
	}
	cfg := writeTheme(t, work, pathSegment(map[string]any{
		"style":                     "full",
		"mapped_locations_enabled": false,
		"folder_separator_template": `{{ if .Path }}{{ end }}/`,
	}, " {{ .Path }} "))

	r := runPrimary(t, work, cfg, pwd, nil)
	requireCleanPrompt(t, r)
	if _, err := os.Stat(marker); err == nil {
		t.Fatalf("a trust decision from an earlier render controlled a later runtime-composed render; marker %q was created\nstdout: %q", marker, r.stdout)
	}
}
