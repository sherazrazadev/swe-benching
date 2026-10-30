// Package harness contains helpers shared by the hidden security and functional suites.
package harness

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"unicode"
)

// ShellWords splits a POSIX shell command line into words and removes quoting. It does not
// perform expansion; the result is what a shell would pass to a program for a command line.
func ShellWords(s string) ([]string, error) {
	var out []string
	var cur strings.Builder
	inSingle, inDouble, escaped, started := false, false, false, false
	for _, r := range s {
		switch {
		case escaped:
			cur.WriteRune(r)
			escaped = false
			started = true
		case r == '\\' && !inSingle:
			escaped = true
			started = true
		case r == '\'' && !inDouble:
			inSingle = !inSingle
			started = true
		case r == '"' && !inSingle:
			inDouble = !inDouble
			started = true
		case unicode.IsSpace(r) && !inSingle && !inDouble:
			if started {
				out = append(out, cur.String())
				cur.Reset()
				started = false
			}
		default:
			cur.WriteRune(r)
			started = true
		}
	}
	if inSingle || inDouble {
		return nil, errors.New("unbalanced quotes")
	}
	if escaped {
		cur.WriteRune('\\')
	}
	if started {
		out = append(out, cur.String())
	}
	return out, nil
}

// GitSSHCommand returns the GIT_SSH_COMMAND entry from an environment slice.
func GitSSHCommand(env []string) (string, bool) {
	for _, e := range env {
		if v, ok := strings.CutPrefix(e, "GIT_SSH_COMMAND="); ok {
			return v, true
		}
	}
	return "", false
}

// ProxyCommandValue extracts the value of the SSH ProxyCommand option from a GIT_SSH_COMMAND
// string, the way git's shell and ssh would see it.
func ProxyCommandValue(gitSSH string) (string, bool) {
	words, err := ShellWords(gitSSH)
	if err != nil {
		return "", false
	}
	for i, w := range words {
		if w == "-o" && i+1 < len(words) {
			if v, ok := strings.CutPrefix(words[i+1], "ProxyCommand="); ok {
				return v, true
			}
		}
		if v, ok := strings.CutPrefix(w, "ProxyCommand="); ok {
			return v, true
		}
	}
	return "", false
}

const connectProxyStub = `#!/bin/sh
: "${PROXY_ARGS_FILE:=/dev/null}"
{
  for a in "$@"; do printf '%s\n' "$a"; done
} >> "$PROXY_ARGS_FILE"
exit 0
`

const sshStub = `#!/bin/sh
exit 0
`

// WriteStubs creates a directory holding an executable connect-proxy stub, which records its
// arguments, and a no-op ssh stub. It returns the directory and the arguments file.
func WriteStubs(t *testing.T) (string, string) {
	t.Helper()
	dir := t.TempDir()
	args := filepath.Join(dir, "proxy-args")
	for name, body := range map[string]string{"connect-proxy": connectProxyStub, "ssh": sshStub} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o755); err != nil {
			t.Fatalf("write %s stub: %v", name, err)
		}
	}
	return dir, args
}

func stubEnv(stubDir, argsFile string) []string {
	env := os.Environ()
	out := make([]string, 0, len(env)+2)
	for _, e := range env {
		if strings.HasPrefix(e, "PATH=") || strings.HasPrefix(e, "PROXY_ARGS_FILE=") {
			continue
		}
		out = append(out, e)
	}
	path := stubDir + string(os.PathListSeparator) + os.Getenv("PATH")
	return append(out, "PATH="+path, "PROXY_ARGS_FILE="+argsFile)
}

// RunProxyValue runs a ProxyCommand value the way ssh does: a value naming an existing
// program is executed with the destination host and port, anything else is run by /bin/sh
// after the %h and %p tokens are substituted.
func RunProxyValue(t *testing.T, value, workdir, stubDir, argsFile string) {
	t.Helper()
	var cmd *exec.Cmd
	if info, err := os.Stat(value); err == nil && !info.IsDir() {
		// Run a script-form ProxyCommand through /bin/sh, as ssh does, so the check does not
		// depend on the mount options of the directory the product put the script in.
		cmd = exec.Command("/bin/sh", value, "targethost.example", "22")
	} else {
		v := strings.ReplaceAll(value, "%h", "targethost.example")
		v = strings.ReplaceAll(v, "%p", "22")
		cmd = exec.Command("/bin/sh", "-c", v)
	}
	cmd.Dir = workdir
	cmd.Env = stubEnv(stubDir, argsFile)
	_, _ = cmd.CombinedOutput()
}

// RunGitSSHCommand runs a whole GIT_SSH_COMMAND through /bin/sh the way git does.
func RunGitSSHCommand(t *testing.T, gitSSH, workdir, stubDir, argsFile string) {
	t.Helper()
	cmd := exec.Command("/bin/sh", "-c", gitSSH, "sh", "targethost.example", "git-upload-pack '/repo'")
	cmd.Dir = workdir
	cmd.Env = stubEnv(stubDir, argsFile)
	_, _ = cmd.CombinedOutput()
}

// RecordedArgs returns the arguments the connect-proxy stub recorded.
func RecordedArgs(t *testing.T, argsFile string) []string {
	t.Helper()
	data, err := os.ReadFile(argsFile)
	if err != nil {
		return nil
	}
	return strings.Fields(string(data))
}

// ProxyText returns the text that carries the proxy destination: the contents of the script
// when the value names one, otherwise the value itself.
func ProxyText(t *testing.T, value string) string {
	t.Helper()
	if info, err := os.Stat(value); err == nil && !info.IsDir() {
		data, err := os.ReadFile(value)
		if err != nil {
			t.Fatalf("read proxy script %s: %v", value, err)
		}
		return string(data)
	}
	return value
}

// DirContainsName reports whether dir holds an entry whose name contains substr.
func DirContainsName(dir, substr string) bool {
	for _, n := range DirFiles(dir) {
		if strings.Contains(n, substr) {
			return true
		}
	}
	return false
}

// FileExists reports whether path exists.
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// DirFiles lists the entry names of dir (empty when it cannot be read).
func DirFiles(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

// TempDirFiles lists files in the process temp dir used for credential files.
func TempDirFiles(dir string) []string {
	if dir == "" {
		dir = os.TempDir()
	}
	return DirFiles(dir)
}

// MarkerPath returns the path of the harmless side-effect marker used by the suites.
func MarkerPath(dir, name string) string {
	return filepath.Join(dir, name)
}

// RequireNoNewFiles fails when after contains entries that were not in before.
func RequireNoNewFiles(t *testing.T, before, after []string) {
	t.Helper()
	seen := make(map[string]bool, len(before))
	for _, n := range before {
		seen[n] = true
	}
	for _, n := range after {
		if !seen[n] {
			t.Fatalf("a temporary file was left behind: %s", n)
		}
	}
}

// Describe renders a value for a failure message without echoing shell payloads verbatim.
func Describe(value string) string {
	return fmt.Sprintf("%q", value)
}
