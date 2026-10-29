package vtesting

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// The REST listener exposes the same control operations as the MCP listener and
// is started for every normal run. A request addressed to a foreign host must
// not perform an operation or return process data.

func TestSec_RESTStopForgedHostRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	forged := fmt.Sprintf("attacker.example:%d", s.restPort)
	code, _, err := s.restRequest(http.MethodPatch, "/process/stop/"+processName, forged, "", nil)
	if err != nil {
		t.Fatalf("stop request failed: %v", err)
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host stopped a process (status %d)", code)
	}
	time.Sleep(500 * time.Millisecond)
	if running, err := s.processRunning(processName); err != nil || !running {
		t.Fatalf("the refused stop still changed the process (running=%v err=%v)", running, err)
	}
}

// The Host and a matching Origin are both attacker-controlled under DNS
// rebinding; matching each other must not make a request trustworthy.
func TestSec_RESTStopForgedMatchingOriginRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	forged := fmt.Sprintf("attacker.example:%d", s.restPort)
	origin := "http://" + forged
	code, _, err := s.restRequest(http.MethodPatch, "/process/stop/"+processName, forged, origin, nil)
	if err != nil {
		t.Fatalf("stop request failed: %v", err)
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host+Origin stopped a process (status %d)", code)
	}
	time.Sleep(500 * time.Millisecond)
	if running, err := s.processRunning(processName); err != nil || !running {
		t.Fatalf("the refused stop still changed the process (running=%v err=%v)", running, err)
	}
}

// Reads are guarded as well as writes: process data must not be returned to an
// untrusted request.
func TestSec_RESTReadForgedHostRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	forged := fmt.Sprintf("attacker.example:%d", s.restPort)
	code, data, err := s.restRequest(http.MethodGet, "/process/"+processName, forged, "", nil)
	if err != nil {
		t.Fatalf("read request failed: %v", err)
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host read process state (status %d, %d bytes)", code, len(data))
	}
}

// Reloading the project is a control operation with a side effect.
func TestSec_RESTReloadForgedHostRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	forged := fmt.Sprintf("attacker.example:%d", s.restPort)
	code, _, err := s.restRequest(http.MethodPost, "/project/configuration", forged, "", []byte("{}"))
	if err != nil {
		t.Fatalf("reload request failed: %v", err)
	}
	if !isClientError(code) {
		t.Fatalf("a forged Host reloaded the project (status %d)", code)
	}
}

// Shutting the whole project down is the strongest control operation.
func TestSec_RESTProjectStopForgedHostRefused(t *testing.T) {
	s := startServer(t, serverOpts{})
	forged := fmt.Sprintf("attacker.example:%d", s.restPort)
	code, _, err := s.restRequest(http.MethodPost, "/project/stop", forged, "", nil)
	// The fixed listener stays up; the vulnerable one shuts the project down.
	alive := false
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if s.serverAlive() {
			alive = true
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if !alive {
		t.Fatalf("a forged Host shut the project down (status %d err %v)", code, err)
	}
	if err != nil || !isClientError(code) {
		t.Fatalf("a forged Host was not refused with a client error (status %d err %v)", code, err)
	}
}
