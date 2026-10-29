package vtesting

import (
	"fmt"
	"strconv"
	"strings"
	"testing"
)

// wsStatusCode extracts the numeric status from the first response line.
func wsStatusCode(t *testing.T, res *wsResult) int {
	t.Helper()
	fields := strings.Fields(res.status)
	if len(fields) < 2 {
		t.Fatalf("unreadable WebSocket response: %q", res.status)
	}
	code, err := strconv.Atoi(fields[1])
	if err != nil {
		t.Fatalf("unreadable WebSocket status: %q", res.status)
	}
	return code
}

// Under DNS rebinding the browser's Origin and the Host it addresses are the
// same attacker-controlled name. The stream must not open for it.
func TestSec_WSStatesForgedOriginRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("attacker.example:%d", s.restPort)
	res, err := s.wsHandshake("/process/states/ws", host, "http://"+host)
	if err != nil {
		t.Fatalf("WebSocket handshake failed: %v", err)
	}
	code := wsStatusCode(t, res)
	if code == 101 {
		t.Fatalf("a forged Host+Origin upgraded a state stream")
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host+Origin was not refused with a client error (%d)", code)
	}
}

func TestSec_WSLogsForgedOriginRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("attacker.example:%d", s.restPort)
	res, err := s.wsHandshake("/process/logs/ws?name="+processName+"&offset=0&follow=false", host, "http://"+host)
	if err != nil {
		t.Fatalf("WebSocket handshake failed: %v", err)
	}
	code := wsStatusCode(t, res)
	if code == 101 {
		t.Fatalf("a forged Host+Origin upgraded a log stream")
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host+Origin was not refused with a client error (%d)", code)
	}
}

// A non-browser client can omit Origin; the Host check alone must still refuse
// an untrusted name.
func TestSec_WSStatesForgedHostNoOriginRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("attacker.example:%d", s.restPort)
	res, err := s.wsHandshake("/process/states/ws", host, "")
	if err != nil {
		t.Fatalf("WebSocket handshake failed: %v", err)
	}
	code := wsStatusCode(t, res)
	if code == 101 {
		t.Fatalf("a forged Host upgraded a state stream")
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host was not refused with a client error (%d)", code)
	}
}
