package vtesting

import (
	"testing"

	"github.com/osrg/gobgp/v4/pkg/packet/bgp"
)

// Legitimate OPEN messages and capabilities must keep decoding exactly as before.

func mustDecodeCapability(t *testing.T, decode func([]byte) error, raw []byte) {
	t.Helper()
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("decoding a legitimate capability panicked: %v", r)
			}
		}()
		if err := decode(raw); err != nil {
			t.Fatalf("legitimate capability was rejected: %v", err)
		}
	}()
}

func TestFunc_MultipleCapabilitiesInOneParameter(t *testing.T) {
	// Extended nexthop, add-path and long-lived graceful restart packed into one optional
	// parameter: the buffer each decoder receives extends past its own declared length.
	caps := append(capBytes(capExtendedNexthop, []byte{0x00, 0x01, 0x00, 0x01, 0x00, 0x02}),
		capBytes(capAddPath, []byte{0x00, 0x01, 0x01, 0x02})...)
	caps = append(caps, capBytes(capLLGR, []byte{0x00, 0x01, 0x01, 0x00, 0x00, 0x0e, 0x10})...)

	body := decodeOpen(t, caps)
	got := capabilitiesOf(t, body)
	if len(got) != 3 {
		t.Fatalf("expected 3 capabilities, got %d: %v", len(got), got)
	}
	if got[0].Code() != bgp.BGPCapabilityCode(capExtendedNexthop) ||
		got[1].Code() != bgp.BGPCapabilityCode(capAddPath) ||
		got[2].Code() != bgp.BGPCapabilityCode(capLLGR) {
		t.Fatalf("unexpected capability codes: %v %v %v", got[0].Code(), got[1].Code(), got[2].Code())
	}
	ap, ok := got[1].(*bgp.CapAddPath)
	if !ok || len(ap.Tuples) != 1 || ap.Tuples[0].Family != bgp.NewFamily(1, 1) || ap.Tuples[0].Mode != bgp.BGP_ADD_PATH_SEND {
		t.Fatalf("add-path capability decoded incorrectly: %+v", got[1])
	}
	llgr, ok := got[2].(*bgp.CapLongLivedGracefulRestart)
	if !ok || len(llgr.Tuples) != 1 || llgr.Tuples[0].RestartTime != 3600 {
		t.Fatalf("long-lived graceful restart decoded incorrectly: %+v", got[2])
	}
}

func TestFunc_GracefulRestartWithoutTuples(t *testing.T) {
	// Flags and time only: a declared length of two is legal.
	caps := capBytes(capGracefulRestart, []byte{0x80, 0x78})
	body := decodeOpen(t, caps)
	got := capabilitiesOf(t, body)
	if len(got) != 1 {
		t.Fatalf("expected 1 capability, got %d", len(got))
	}
	gr, ok := got[0].(*bgp.CapGracefulRestart)
	if !ok {
		t.Fatalf("unexpected capability type %T", got[0])
	}
	if gr.Flags != 8 || gr.Time != 120 || len(gr.Tuples) != 0 {
		t.Fatalf("graceful restart decoded incorrectly: flags=%d time=%d tuples=%d", gr.Flags, gr.Time, len(gr.Tuples))
	}
}

func TestFunc_ZeroLengthCapabilities(t *testing.T) {
	// Capabilities that carry no value declare a length of zero and are legal.
	caps := append(capBytes(capRouteRefresh, nil), capBytes(capEnhancedRR, nil)...)
	caps = append(caps, capBytes(capCiscoRR, nil)...)
	caps = append(caps, capBytes(capCarryingLabels, nil)...)

	body := decodeOpen(t, caps)
	got := capabilitiesOf(t, body)
	want := []bgp.BGPCapabilityCode{
		bgp.BGPCapabilityCode(capRouteRefresh),
		bgp.BGPCapabilityCode(capEnhancedRR),
		bgp.BGPCapabilityCode(capCiscoRR),
		bgp.BGPCapabilityCode(capCarryingLabels),
	}
	if len(got) != len(want) {
		t.Fatalf("expected %d capabilities, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i].Code() != want[i] {
			t.Fatalf("capability %d has code %v, want %v", i, got[i].Code(), want[i])
		}
	}
}

func TestFunc_UnknownCapabilityKeepsValue(t *testing.T) {
	value := []byte{0xde, 0xad, 0xbe, 0xef}
	body := decodeOpen(t, capBytes(capUnknownA, value))
	got := capabilitiesOf(t, body)
	if len(got) != 1 {
		t.Fatalf("expected 1 capability, got %d", len(got))
	}
	unknown, ok := got[0].(*bgp.CapUnknown)
	if !ok {
		t.Fatalf("unexpected capability type %T", got[0])
	}
	if string(unknown.CapValue) != string(value) {
		t.Fatalf("unknown capability value changed: %x, want %x", unknown.CapValue, value)
	}
}

func TestFunc_FixedSizeCapabilities(t *testing.T) {
	caps := append(capBytes(capFourOctetAS, []byte{0x00, 0x00, 0xfd, 0xe8}),
		capBytes(capMultiProtocol, []byte{0x00, 0x01, 0x00, 0x01})...)
	body := decodeOpen(t, caps)
	got := capabilitiesOf(t, body)
	if len(got) != 2 {
		t.Fatalf("expected 2 capabilities, got %d", len(got))
	}
	as4, ok := got[0].(*bgp.CapFourOctetASNumber)
	if !ok || as4.CapValue != 65000 {
		t.Fatalf("four-octet AS decoded incorrectly: %+v", got[0])
	}
	mp, ok := got[1].(*bgp.CapMultiProtocol)
	if !ok || mp.CapValue != bgp.NewFamily(1, 1) {
		t.Fatalf("multiprotocol decoded incorrectly: %+v", got[1])
	}
}

func TestFunc_FQDNCapability(t *testing.T) {
	caps := capBytes(capFQDN, []byte{4, 'h', 'o', 's', 't', 3, 'c', 'o', 'm'})
	body := decodeOpen(t, caps)
	got := capabilitiesOf(t, body)
	if len(got) != 1 {
		t.Fatalf("expected 1 capability, got %d", len(got))
	}
	f, ok := got[0].(*bgp.CapFQDN)
	if !ok || f.HostName != "host" || f.DomainName != "com" {
		t.Fatalf("FQDN decoded incorrectly: %+v", got[0])
	}
}

func TestFunc_EmptyFQDNCapability(t *testing.T) {
	// Host name and domain name both empty: the two length bytes are the whole value.
	body := decodeOpen(t, capBytes(capFQDN, []byte{0x00, 0x00}))
	got := capabilitiesOf(t, body)
	if len(got) != 1 {
		t.Fatalf("expected 1 capability, got %d", len(got))
	}
	f, ok := got[0].(*bgp.CapFQDN)
	if !ok || f.HostName != "" || f.DomainName != "" {
		t.Fatalf("empty FQDN decoded incorrectly: %+v", got[0])
	}
}

func TestFunc_SoftwareVersionCapability(t *testing.T) {
	body := decodeOpen(t, capBytes(capSoftwareVersion, []byte{3, '1', '.', '2'}))
	got := capabilitiesOf(t, body)
	if len(got) != 1 {
		t.Fatalf("expected 1 capability, got %d", len(got))
	}
	sv, ok := got[0].(*bgp.CapSoftwareVersion)
	if !ok || sv.SoftwareVersion != "1.2" {
		t.Fatalf("software version decoded incorrectly: %+v", got[0])
	}
}

func TestFunc_CapabilityEndsAtParameterEnd(t *testing.T) {
	// The buffer ends exactly at 2+CapLen.
	body := decodeOpen(t, capBytes(capFourOctetAS, []byte{0x00, 0x00, 0xfd, 0xe8}))
	got := capabilitiesOf(t, body)
	if len(got) != 1 {
		t.Fatalf("expected 1 capability, got %d", len(got))
	}
	as4, ok := got[0].(*bgp.CapFourOctetASNumber)
	if !ok || as4.CapValue != 65000 {
		t.Fatalf("four-octet AS decoded incorrectly: %+v", got[0])
	}
}

func TestFunc_ORFCapabilityWithFollowingCapability(t *testing.T) {
	// A valid ORF capability (one entry, no ORF types) followed by another capability.
	caps := append(capBytes(capORF, []byte{0x00, 0x01, 0x01, 0x00}),
		capBytes(capMultiProtocol, []byte{0x00, 0x01, 0x00, 0x01})...)
	body := decodeOpen(t, caps)
	got := capabilitiesOf(t, body)
	if len(got) != 2 {
		t.Fatalf("expected 2 capabilities, got %d: %v", len(got), got)
	}
	if got[0].Code() != bgp.BGPCapabilityCode(capORF) || got[1].Code() != bgp.BGPCapabilityCode(capMultiProtocol) {
		t.Fatalf("unexpected capability codes: %v %v", got[0].Code(), got[1].Code())
	}
	// A valid ORF capability whose declared length is consistent must be accepted; its
	// entry list is not asserted here so that the check only fixes the coupled behaviour
	// this task protects (a capability followed by another capability is not an error).
	if _, ok := got[0].(*bgp.CapORF); !ok {
		t.Fatalf("ORF capability has unexpected type %T", got[0])
	}
	mp, ok := got[1].(*bgp.CapMultiProtocol)
	if !ok || mp.CapValue != bgp.NewFamily(1, 1) {
		t.Fatalf("following multiprotocol capability decoded incorrectly: %+v", got[1])
	}
}

func TestFunc_MultipleOptionalParameters(t *testing.T) {
	params := append(optionParameter(optCapability, capBytes(capFourOctetAS, []byte{0x00, 0x00, 0xfd, 0xe8})),
		optionParameter(optCapability, capBytes(capRouteRefresh, nil))...)
	body := decodeOpenParams(t, params)
	got := capabilitiesOf(t, body)
	if len(got) != 2 {
		t.Fatalf("expected 2 capabilities, got %d", len(got))
	}
	if got[0].Code() != bgp.BGPCapabilityCode(capFourOctetAS) || got[1].Code() != bgp.BGPCapabilityCode(capRouteRefresh) {
		t.Fatalf("unexpected capability codes: %v %v", got[0].Code(), got[1].Code())
	}
}

func TestFunc_DirectCapabilityDecoders(t *testing.T) {
	as4 := &bgp.CapFourOctetASNumber{}
	mustDecodeCapability(t, as4.DecodeFromBytes, []byte{capFourOctetAS, 0x04, 0x00, 0x00, 0xfd, 0xe8})
	if as4.CapValue != 65000 {
		t.Fatalf("four-octet AS decoded incorrectly: %d", as4.CapValue)
	}

	mp := &bgp.CapMultiProtocol{}
	mustDecodeCapability(t, mp.DecodeFromBytes, []byte{capMultiProtocol, 0x04, 0x00, 0x01, 0x00, 0x01})
	if mp.CapValue != bgp.NewFamily(1, 1) {
		t.Fatalf("multiprotocol decoded incorrectly: %v", mp.CapValue)
	}

	gr := &bgp.CapGracefulRestart{}
	mustDecodeCapability(t, gr.DecodeFromBytes, []byte{capGracefulRestart, 0x02, 0x80, 0x78})
	if gr.Flags != 8 || gr.Time != 120 || len(gr.Tuples) != 0 {
		t.Fatalf("graceful restart decoded incorrectly: %+v", gr)
	}

	fqdn := &bgp.CapFQDN{}
	mustDecodeCapability(t, fqdn.DecodeFromBytes, []byte{capFQDN, 0x06, 0x04, 'h', 'o', 's', 't', 0x00})
	if fqdn.HostName != "host" || fqdn.DomainName != "" {
		t.Fatalf("FQDN decoded incorrectly: %+v", fqdn)
	}

	sv := &bgp.CapSoftwareVersion{}
	mustDecodeCapability(t, sv.DecodeFromBytes, []byte{capSoftwareVersion, 0x04, 0x03, '1', '.', '2'})
	if sv.SoftwareVersion != "1.2" {
		t.Fatalf("software version decoded incorrectly: %q", sv.SoftwareVersion)
	}

	orf := &bgp.CapORF{}
	mustDecodeCapability(t, orf.DecodeFromBytes, []byte{capORF, 0x04, 0x00, 0x01, 0x01, 0x00})
	if len(orf.Tuples) != 1 || orf.Tuples[0].AFI != 1 || orf.Tuples[0].SAFI != 1 {
		t.Fatalf("ORF decoded incorrectly: %+v", orf)
	}
}
