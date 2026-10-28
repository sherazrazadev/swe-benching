// Functional tests for the live event feed: everything a permitted caller sees
// today must keep working, including the host-less stat binding, a second joined
// host, a container that starts while the caller is connected, and a raw update
// notification with no container payload.
package vtesting

import (
	"strings"
	"testing"
	"time"

	"github.com/amir20/dozzle/internal/container"
	"github.com/amir20/dozzle/internal/web"
)

func TestFunc_InitialListIsFiltered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)
	body := s.text()
	s.stop()

	if !strings.Contains(body, visibleID) {
		t.Fatalf("the initial list dropped a permitted container; feed:\n%s", body)
	}
	if !strings.Contains(body, remoteID) {
		t.Fatalf("the initial list dropped a permitted container on a second host; feed:\n%s", body)
	}
	assertAbsent(t, body, hiddenID, "initial container list")
}

func TestFunc_PermittedStatsKeepFlowing(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	if err := host.emitStat(container.ContainerStat{ID: visibleID, CPUPercent: 11}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if err := host.emitStat(container.ContainerStat{ID: remoteID, CPUPercent: 22}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if !s.waitEventID("container-stat", visibleID, 5*time.Second) {
		s.stop()
		t.Fatalf("stats for a permitted local container stopped flowing; feed:\n%s", s.text())
	}
	if !s.waitEventID("container-stat", remoteID, 5*time.Second) {
		s.stop()
		t.Fatalf("stats for a permitted container on a second host stopped flowing; feed:\n%s", s.text())
	}
	s.stop()
}

func TestFunc_PermittedLifecycleKeepsFlowing(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	for _, ev := range []container.ContainerEvent{
		{Name: "pause", Host: "hostA", ActorID: visibleID, Time: time.Now()},
		{Name: "die", Host: "hostB", ActorID: remoteID, Time: time.Now()},
	} {
		if err := host.emitEvent(ev); err != nil {
			s.stop()
			t.Fatal(err)
		}
	}
	if !s.waitEventID("container-event", visibleID, 5*time.Second) {
		s.stop()
		t.Fatalf("lifecycle notifications for a permitted container stopped flowing; feed:\n%s", s.text())
	}
	if !s.waitEventID("container-event", remoteID, 5*time.Second) {
		s.stop()
		t.Fatalf("lifecycle notifications for a permitted container on a second host stopped flowing; feed:\n%s", s.text())
	}
	s.stop()
}

func TestFunc_PermittedUpdateKeepsFlowing(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	visible := newContainer(visibleID, visibleName, "hostA", "red", "running")
	if err := host.emitEvent(container.ContainerEvent{Name: "update", Host: "hostA", ActorID: visibleID, Container: &visible, Time: time.Now()}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if !s.waitEventID("container-updated", visibleID, 5*time.Second) {
		s.stop()
		t.Fatalf("container updates for a permitted container stopped flowing; feed:\n%s", s.text())
	}
	s.stop()
}

func TestFunc_PermittedHealthKeepsFlowing(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	if err := host.emitEvent(container.ContainerEvent{Name: "health_status: healthy", Host: "hostA", ActorID: visibleID, Time: time.Now()}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if !s.waitEventID("container-health", visibleID, 5*time.Second) {
		s.stop()
		t.Fatalf("health notifications for a permitted container stopped flowing; feed:\n%s", s.text())
	}
	s.stop()
}

func TestFunc_PermittedOOMKeepsFlowing(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	if err := host.emitEvent(container.ContainerEvent{Name: "oom", Host: "hostA", ActorID: visibleID, Time: time.Now()}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if !s.waitEventID("container-oom", visibleID, 5*time.Second) {
		s.stop()
		t.Fatalf("oom notifications for a permitted container stopped flowing; feed:\n%s", s.text())
	}
	s.stop()
}

func TestFunc_NewlyStartedPermittedContainerAppears(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	host.addContainer(newContainer(laterID, laterName, "hostA", "red", "running"))
	if err := host.emitEvent(container.ContainerEvent{Name: "start", Host: "hostA", ActorID: laterID, Time: time.Now()}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if !s.waitEventID("containers-changed", laterID, 5*time.Second) {
		s.stop()
		t.Fatalf("a permitted container that started while connected never appeared in the list; feed:\n%s", s.text())
	}
	if !s.waitEventID("container-event", laterID, 5*time.Second) {
		s.stop()
		t.Fatalf("a permitted container's start notification was dropped; feed:\n%s", s.text())
	}
	s.stop()
}

func TestFunc_RawUpdateWithoutPayloadKeepsStreamAlive(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	// Docker can emit an update action without a container payload; the feed must
	// stay connected and keep delivering later traffic.
	if err := host.emitEvent(container.ContainerEvent{Name: "update", Host: "hostA", ActorID: visibleID, Time: time.Now()}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if err := host.emitStat(container.ContainerStat{ID: visibleID, CPUPercent: 33}); err != nil {
		s.stop()
		t.Fatal(err)
	}
	if !s.waitEventID("container-stat", visibleID, 5*time.Second) {
		s.stop()
		t.Fatalf("the feed disconnected after an update event with no container payload; feed:\n%s", s.text())
	}
	s.stop()
}
