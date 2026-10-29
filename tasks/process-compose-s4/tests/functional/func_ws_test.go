package vtesting

import (
	"fmt"
	"testing"
)

// Ordinary loopback WebSocket clients keep working. The state stream sends a
// snapshot as soon as the client subscribes.
func TestFunc_WSStatesWorks(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("127.0.0.1:%d", s.restPort)
	res, err := s.wsHandshake("/process/states/ws", host, "")
	if err != nil {
		t.Fatalf("state stream handshake failed: %v", err)
	}
	if code := wsStatusCode(t, res); code != 101 {
		t.Fatalf("loopback state stream was refused (%d)", code)
	}
	if len(res.payload) == 0 {
		t.Fatalf("loopback state stream produced no data")
	}
}

func TestFunc_WSLogsWorks(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("127.0.0.1:%d", s.restPort)
	res, err := s.wsHandshake("/process/logs/ws?name="+processName+"&offset=0&follow=false", host, "")
	if err != nil {
		t.Fatalf("log stream handshake failed: %v", err)
	}
	if code := wsStatusCode(t, res); code != 101 {
		t.Fatalf("loopback log stream was refused (%d)", code)
	}
}

// A browser dashboard served from the loopback listener keeps working.
func TestFunc_WSBrowserOriginWorks(t *testing.T) {
	s := startServer(t, serverOpts{})
	host := fmt.Sprintf("127.0.0.1:%d", s.restPort)
	res, err := s.wsHandshake("/process/states/ws", host, "http://"+host)
	if err != nil {
		t.Fatalf("state stream handshake failed: %v", err)
	}
	if code := wsStatusCode(t, res); code != 101 {
		t.Fatalf("a loopback browser origin was refused (%d)", code)
	}
}
