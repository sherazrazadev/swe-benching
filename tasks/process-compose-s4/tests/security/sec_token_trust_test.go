package vtesting

import (
	"fmt"
	"testing"
)

// A configured access token is required before the MCP listener will talk to a
// client at all.
func TestSec_MCPTokenRequired(t *testing.T) {
	s := startServer(t, serverOpts{token: tokenValue})
	st, code, err := s.openSSE(fmt.Sprintf("127.0.0.1:%d", s.mcpPort), "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("an unauthenticated request opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("an unauthenticated request was not refused (status %d)", code)
	}
}

func TestSec_MCPWrongTokenRefused(t *testing.T) {
	s := startServer(t, serverOpts{token: tokenValue})
	st, code, err := s.openSSE(fmt.Sprintf("127.0.0.1:%d", s.mcpPort), "", map[string]string{
		"X-PC-Token-Key": "not-the-configured-token",
	})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a wrong token opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a wrong token was not refused (status %d)", code)
	}
}

// An operator-listed name is trusted; a name that merely contains or extends it
// is not.
func TestSec_TrustedHostSuffixLookalikeRefused(t *testing.T) {
	s := startServer(t, serverOpts{trustedHosts: []string{"toolbox.local"}})
	st, code, err := s.openSSE(fmt.Sprintf("evil.toolbox.local:%d", s.mcpPort), "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a lookalike of a trusted host opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a lookalike of a trusted host was not refused (status %d)", code)
	}
}

func TestSec_TrustedHostPrefixLookalikeRefused(t *testing.T) {
	s := startServer(t, serverOpts{trustedHosts: []string{"toolbox.local"}})
	st, code, err := s.openSSE(fmt.Sprintf("toolbox.local.attacker.example:%d", s.mcpPort), "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("an extended trusted name opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("an extended trusted name was not refused (status %d)", code)
	}
}
