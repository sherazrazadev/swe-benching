package vtesting

import (
	"net/http"
	"testing"
	"time"
)

// Ordinary loopback REST use keeps working: reads, a stop and a start.
func TestFunc_RESTControlWorks(t *testing.T) {
	s := startServer(t, serverOpts{})

	code, data, err := s.restRequest(http.MethodGet, "/process/"+processName, "", "", nil)
	if err != nil || code != http.StatusOK || len(data) == 0 {
		t.Fatalf("loopback read failed: status %d err %v", code, err)
	}

	code, _, err = s.restRequest(http.MethodPatch, "/process/stop/"+processName, "", "", nil)
	if err != nil || code >= 300 {
		t.Fatalf("loopback stop failed: status %d err %v", code, err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		running, err := s.processRunning(processName)
		if err == nil && !running {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("loopback stop did not stop the process (running=%v err=%v)", running, err)
		}
		time.Sleep(200 * time.Millisecond)
	}

	code, _, err = s.restRequest(http.MethodPost, "/process/start/"+processName, "", "", nil)
	if err != nil || code >= 300 {
		t.Fatalf("loopback start failed: status %d err %v", code, err)
	}
}

func TestFunc_RESTReloadWorks(t *testing.T) {
	s := startServer(t, serverOpts{})
	code, _, err := s.restRequest(http.MethodPost, "/project/configuration", "", "", nil)
	if err != nil || code >= 300 {
		t.Fatalf("loopback reload failed: status %d err %v", code, err)
	}
}

func TestFunc_RESTProjectStateWorks(t *testing.T) {
	s := startServer(t, serverOpts{})
	code, data, err := s.restRequest(http.MethodGet, "/project/state", "", "", nil)
	if err != nil || code != http.StatusOK || len(data) == 0 {
		t.Fatalf("loopback project state failed: status %d err %v", code, err)
	}
}
