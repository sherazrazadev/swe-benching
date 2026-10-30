// Shared black-box harness for the hidden suites. It drives the built product
// through its command line and inspects the process output and the filesystem;
// it imports only the Go standard library.
package ompverify

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

type runResult struct {
	stdout string
	stderr string
	exit   int
}

func ompBin(t *testing.T) string {
	t.Helper()
	bin := os.Getenv("OMP_BIN")
	if bin == "" {
		t.Fatal("OMP_BIN is not set")
	}
	return bin
}

// runOMP runs the product's prompt-printing command in dir.
func runOMP(t *testing.T, dir string, extraEnv []string, args ...string) runResult {
	t.Helper()
	cmd := exec.Command(ompBin(t), args...)
	cmd.Dir = dir
	env := map[string]string{
		"PATH":              os.Getenv("PATH"),
		"HOME":              dir,
		"TMPDIR":            dir,
		"LANG":              "C",
		"LC_ALL":            "C",
		"TZ":                "UTC",
		"OMP_CACHE_DISABLED": "1",
	}
	for _, kv := range extraEnv {
		if key, value, ok := strings.Cut(kv, "="); ok {
			env[key] = value
		}
	}
	for key, value := range env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	code := 0
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			code = exitErr.ExitCode()
		} else {
			t.Fatalf("could not run the product: %v", err)
		}
	}
	return runResult{stdout: stdout.String(), stderr: stderr.String(), exit: code}
}

// runPrimary prints the primary prompt for pwd with the given theme file.
func runPrimary(t *testing.T, dir, configPath, pwd string, extraEnv []string, extraArgs ...string) runResult {
	t.Helper()
	args := []string{
		"print", "primary",
		"--config", configPath,
		"--pwd", pwd,
		"--shell", "bash",
		"--plain",
	}
	args = append(args, extraArgs...)
	return runOMP(t, dir, extraEnv, args...)
}

// requireCleanPrompt checks the refusal contract: the prompt command finished
// normally, so a refused value neither aborts the prompt nor crashes it.
func requireCleanPrompt(t *testing.T, r runResult) {
	t.Helper()
	if r.exit != 0 {
		t.Fatalf("the prompt command failed (exit %d); a refused value must not abort the prompt\nstdout: %q\nstderr: %q",
			r.exit, r.stdout, r.stderr)
	}
}

// writeTheme writes a one-block, one-segment theme and returns its path.
func writeTheme(t *testing.T, dir string, segment map[string]any) string {
	t.Helper()
	cfg := map[string]any{
		"blocks": []any{
			map[string]any{
				"type":      "prompt",
				"alignment": "left",
				"segments":  []any{segment},
			},
		},
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("could not encode theme: %v", err)
	}
	path := filepath.Join(dir, "theme.json")
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		t.Fatalf("could not write theme: %v", err)
	}
	return path
}

func pathSegment(options map[string]any, template string) map[string]any {
	if options == nil {
		options = map[string]any{}
	}
	return map[string]any{
		"type":     "path",
		"style":    "plain",
		"options":  options,
		"template": template,
	}
}

// hostileMarker writes an executable named name into binDir; running it creates
// marker and prints leak. It is the observable side effect of a command helper.
func hostileMarker(t *testing.T, binDir, name, marker, leak string) string {
	t.Helper()
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatalf("could not create helper dir: %v", err)
	}
	script := "#!/bin/sh\n: > " + shellQuote(marker) + "\nprintf '%s\\n' " + shellQuote(leak) + "\n"
	path := filepath.Join(binDir, name)
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatalf("could not write helper: %v", err)
	}
	return path
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func withPath(binDir string) string {
	return "PATH=" + binDir + string(os.PathListSeparator) + os.Getenv("PATH")
}
