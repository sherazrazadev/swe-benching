// Security tests for the live event feed. Each test opens the feed as a caller
// restricted to team=red, feeds one message about an out-of-scope container
// followed by the same kind of message about a permitted container, and asserts
// that the permitted message arrived while nothing about the hidden container
// did. The permitted message is the positive control: a fix that silences the
// whole channel fails here instead of passing by silence.
package vtesting

import (
	"testing"
	"time"

	"github.com/amir20/dozzle/internal/container"
	"github.com/amir20/dozzle/internal/web"
)

func TestSec_HiddenContainerStatNotDelivered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	if err := host.emitStat(container.ContainerStat{ID: hiddenID, CPUPercent: 99.9, MemoryPercent: 99.9}); err != nil {
		s.stop()
		t.Fatalf("feed the hidden stat: %v", err)
	}
	if err := host.emitStat(container.ContainerStat{ID: visibleID, CPUPercent: 12.5, MemoryPercent: 25}); err != nil {
		s.stop()
		t.Fatalf("feed the permitted stat: %v", err)
	}

	waitEventIDOrFail(t, s, "container-stat", visibleID)
	s.stop()
	assertAbsent(t, s.text(), hiddenID, "live stat feed")
}

func TestSec_HiddenLifecycleEventNotDelivered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	for _, ev := range []container.ContainerEvent{
		{Name: "die", Host: "hostA", ActorID: hiddenID, Time: time.Now()},
		{Name: "die", Host: "hostA", ActorID: visibleID, Time: time.Now()},
	} {
		if err := host.emitEvent(ev); err != nil {
			s.stop()
			t.Fatalf("feed a lifecycle event: %v", err)
		}
	}

	waitEventIDOrFail(t, s, "container-event", visibleID)
	s.stop()
	assertAbsent(t, s.text(), hiddenID, "live lifecycle feed")
}

func TestSec_HiddenStartRefreshNotDelivered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	for _, ev := range []container.ContainerEvent{
		{Name: "start", Host: "hostA", ActorID: hiddenID, Time: time.Now()},
		{Name: "start", Host: "hostA", ActorID: visibleID, Time: time.Now()},
	} {
		if err := host.emitEvent(ev); err != nil {
			s.stop()
			t.Fatalf("feed a start event: %v", err)
		}
	}

	waitEventIDOrFail(t, s, "container-event", visibleID)
	s.stop()
	assertAbsent(t, s.text(), hiddenID, "container refresh")
	assertAbsent(t, s.text(), hiddenName, "container refresh")
}

func TestSec_HiddenUpdateNotDelivered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	hidden := newContainer(hiddenID, hiddenName, "hostA", "blue", "running")
	visible := newContainer(visibleID, visibleName, "hostA", "red", "running")
	for _, ev := range []container.ContainerEvent{
		{Name: "update", Host: "hostA", ActorID: hiddenID, Container: &hidden, Time: time.Now()},
		{Name: "update", Host: "hostA", ActorID: visibleID, Container: &visible, Time: time.Now()},
	} {
		if err := host.emitEvent(ev); err != nil {
			s.stop()
			t.Fatalf("feed an update event: %v", err)
		}
	}

	waitEventIDOrFail(t, s, "container-updated", visibleID)
	s.stop()
	assertAbsent(t, s.text(), hiddenID, "live update feed")
	assertAbsent(t, s.text(), hiddenName, "live update feed")
}

func TestSec_HiddenHealthNotDelivered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	for _, ev := range []container.ContainerEvent{
		{Name: "health_status: unhealthy", Host: "hostA", ActorID: hiddenID, Time: time.Now()},
		{Name: "health_status: healthy", Host: "hostA", ActorID: visibleID, Time: time.Now()},
	} {
		if err := host.emitEvent(ev); err != nil {
			s.stop()
			t.Fatalf("feed a health event: %v", err)
		}
	}

	waitEventIDOrFail(t, s, "container-health", visibleID)
	s.stop()
	assertAbsent(t, s.text(), hiddenID, "live health feed")
}

func TestSec_HiddenOOMNotDelivered(t *testing.T) {
	host := newFakeHost()
	ts := newTestServer(t, host, web.Config{})
	s := startStream(t, ts, permittedFilter)

	for _, ev := range []container.ContainerEvent{
		{Name: "oom", Host: "hostA", ActorID: hiddenID, Time: time.Now()},
		{Name: "oom", Host: "hostA", ActorID: visibleID, Time: time.Now()},
	} {
		if err := host.emitEvent(ev); err != nil {
			s.stop()
			t.Fatalf("feed an oom event: %v", err)
		}
	}

	waitEventIDOrFail(t, s, "container-oom", visibleID)
	s.stop()
	assertAbsent(t, s.text(), hiddenID, "live event feed")
}
