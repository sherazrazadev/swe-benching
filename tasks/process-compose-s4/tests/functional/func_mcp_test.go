package vtesting

import (
	"fmt"
	"testing"
	"time"
)

// A loopback MCP client with no extra configuration keeps working exactly as
// today: it can open the stream and dispatch a control tool.
func TestFunc_MCPStreamsOnLoopback(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("127.0.0.1:%d", s.mcpPort)
	st, code, err := s.openSSE(host, "", nil)
	if err != nil {
		t.Fatalf("loopback client could not stream: %v", err)
	}
	defer st.Close()
	if code != 200 {
		t.Fatalf("loopback client got status %d", code)
	}
}

func TestFunc_MCPToolCallWorks(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("127.0.0.1:%d", s.mcpPort)
	st, err := s.startSession(host, "")
	if err != nil {
		t.Fatalf("loopback session failed: %v", err)
	}
	defer st.Close()

	code, _, err := s.call(st, host, "", s.token, stopToolCall(processName))
	if err != nil || code >= 300 {
		t.Fatalf("control tool call failed: status %d err %v", code, err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		running, err := s.processRunning(processName)
		if err == nil && !running {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("the control tool did not stop the process (running=%v err=%v)", running, err)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

// Every spelling of the local machine is accepted: the whole loopback range,
// bracketed and bare IPv6, any case, and a trailing dot.
func TestFunc_MCPLoopbackHostForms(t *testing.T) {
	s := startServer(t, serverOpts{})
	for _, form := range []string{
		fmt.Sprintf("127.0.0.2:%d", s.mcpPort),
		fmt.Sprintf("[::1]:%d", s.mcpPort),
		fmt.Sprintf("LOCALHOST:%d", s.mcpPort),
		fmt.Sprintf("localhost.:%d", s.mcpPort),
		"127.0.0.1",
	} {
		st, code, err := s.openSSE(form, "", nil)
		if err != nil {
			t.Fatalf("loopback form %q failed: %v", form, err)
		}
		if st != nil {
			st.Close()
		}
		if code != 200 {
			t.Fatalf("loopback form %q was refused (status %d)", form, code)
		}
	}
}

// A deliberately configured trusted name keeps working, case-insensitively and
// with a trailing dot.
func TestFunc_MCPTrustedHostAccepted(t *testing.T) {
	s := startServer(t, serverOpts{trustedHosts: []string{"toolbox.local"}})
	for _, form := range []string{
		fmt.Sprintf("toolbox.local:%d", s.mcpPort),
		fmt.Sprintf("TOOLBOX.LOCAL:%d", s.mcpPort),
		fmt.Sprintf("toolbox.local.:%d", s.mcpPort),
	} {
		st, code, err := s.openSSE(form, "", nil)
		if err != nil {
			t.Fatalf("trusted host %q failed: %v", form, err)
		}
		if st != nil {
			st.Close()
		}
		if code != 200 {
			t.Fatalf("trusted host %q was refused (status %d)", form, code)
		}
	}
}

// The explicit wildcard opt-out is honoured.
func TestFunc_MCPWildcardAccepted(t *testing.T) {
	s := startServer(t, serverOpts{trustedHosts: []string{"*"}})
	host := fmt.Sprintf("attacker.example:%d", s.mcpPort)
	st, code, err := s.openSSE(host, "http://"+host, nil)
	if err != nil {
		t.Fatalf("wildcard opt-out failed: %v", err)
	}
	if st != nil {
		st.Close()
	}
	if code != 200 {
		t.Fatalf("the wildcard opt-out was not honoured (status %d)", code)
	}
}

// Both documented ways of presenting a configured token keep working, and the
// scheme name is case-insensitive.
func TestFunc_MCPTokenForms(t *testing.T) {
	s := startServer(t, serverOpts{token: tokenValue})
	host := fmt.Sprintf("127.0.0.1:%d", s.mcpPort)
	for _, tn := range []struct {
		name    string
		headers map[string]string
	}{
		{"header", map[string]string{"X-PC-Token-Key": tokenValue}},
		{"bearer", map[string]string{"Authorization": "Bearer " + tokenValue}},
		{"lowercase bearer", map[string]string{"Authorization": "bearer " + tokenValue}},
	} {
		st, code, err := s.openSSE(host, "", tn.headers)
		if err != nil {
			t.Fatalf("%s token form failed: %v", tn.name, err)
		}
		if st != nil {
			st.Close()
		}
		if code != 200 {
			t.Fatalf("%s token form was refused (status %d)", tn.name, code)
		}
	}
}
