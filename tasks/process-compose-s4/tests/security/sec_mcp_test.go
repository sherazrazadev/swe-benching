package vtesting

import (
	"fmt"
	"testing"
	"time"
)

// The MCP listener is the surface named in the report. A request whose Host is
// not the local machine must not open a stream, and a browser Origin that is
// not local must be refused.

func TestSec_MCPForgedHostRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	st, code, err := s.openSSE(fmt.Sprintf("attacker.example:%d", s.mcpPort), "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a forged Host opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host was not refused with a client error (status %d)", code)
	}
}

func TestSec_MCPForgedOriginRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	st, code, err := s.openSSE(fmt.Sprintf("127.0.0.1:%d", s.mcpPort), "http://attacker.example", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a foreign Origin opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a foreign Origin was not refused with a client error (status %d)", code)
	}
}

func TestSec_MCPNullOriginRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	st, code, err := s.openSSE(fmt.Sprintf("127.0.0.1:%d", s.mcpPort), "null", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a null Origin opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a null Origin was not refused with a client error (status %d)", code)
	}
}

// A name that merely starts with a loopback address is not the local machine.
func TestSec_MCPHostPrefixLookalikeRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	st, code, err := s.openSSE(fmt.Sprintf("127.0.0.1.attacker.example:%d", s.mcpPort), "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a loopback lookalike Host opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a loopback lookalike Host was not refused (status %d)", code)
	}
}

// A name that merely ends with localhost is not the local machine.
func TestSec_MCPLocalhostSuffixLookalikeRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	st, code, err := s.openSSE(fmt.Sprintf("localhost.attacker.example:%d", s.mcpPort), "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a localhost lookalike opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a localhost lookalike was not refused (status %d)", code)
	}
}

// The value after the separator is a port, not a host: a Host that embeds a
// loopback address after a colon still names the attacker.
func TestSec_MCPHostPortPositionTrickRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	st, code, err := s.openSSE("attacker.example:127.0.0.1", "", nil)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if st != nil {
		st.Close()
		t.Fatalf("a Host with a loopback port opened an MCP stream (status %d)", code)
	}
	if !isClientError(code) {
		t.Fatalf("a Host with a loopback port was not refused (status %d)", code)
	}
}

// Tool dispatch happens on the session's message endpoint as well as on the
// streaming endpoint. A trusted client opens the session; the hostile request
// must not be able to use it to reach the control tools.
func TestSec_MCPMessageEndpointForgedHostRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	trusted := fmt.Sprintf("127.0.0.1:%d", s.mcpPort)
	st, err := s.startSession(trusted, "")
	if err != nil {
		t.Fatalf("could not open a trustworthy session: %v", err)
	}
	defer st.Close()

	forged := fmt.Sprintf("attacker.example:%d", s.mcpPort)
	code, _, err := s.call(st, forged, "", "", stopToolCall(processName))
	if err != nil {
		t.Fatalf("hostile message request failed: %v", err)
	}
	if !isClientError(code) {
		t.Fatalf("a forged-Host message reached tool dispatch (status %d)", code)
	}
	time.Sleep(500 * time.Millisecond)
	if running, err := s.processRunning(processName); err != nil || !running {
		t.Fatalf("the refused call still changed the process (running=%v err=%v)", running, err)
	}
}

// With an access token configured, a session message that carries no token must
// not reach tool dispatch even from a trusted host.
func TestSec_MCPMessageEndpointRequiresToken(t *testing.T) {
	s := startServer(t, serverOpts{token: tokenValue})
	trusted := fmt.Sprintf("127.0.0.1:%d", s.mcpPort)
	st, err := s.startSession(trusted, "")
	if err != nil {
		t.Fatalf("could not open a trustworthy session: %v", err)
	}
	defer st.Close()

	code, _, err := s.call(st, trusted, "", "", stopToolCall(processName))
	if err != nil {
		t.Fatalf("unauthenticated message request failed: %v", err)
	}
	if !isClientError(code) {
		t.Fatalf("a message without the configured token reached tool dispatch (status %d)", code)
	}
	time.Sleep(500 * time.Millisecond)
	if running, err := s.processRunning(processName); err != nil || !running {
		t.Fatalf("the unauthenticated call still changed the process (running=%v err=%v)", running, err)
	}
}
