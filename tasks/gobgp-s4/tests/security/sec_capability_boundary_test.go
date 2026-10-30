package vtesting

import (
	"testing"

	"github.com/osrg/gobgp/v4/pkg/packet/bgp"
)

// A capability value, and every length-delimited field inside it, must be read only from
// the bytes the capability's declared length covers. Each check below builds an OPEN whose
// capability declares a length that cannot hold the value it carries (or that is not the
// exact size of a fixed-size value) and requires the parser to refuse it with an error.

func TestSec_FourOctetASZeroDeclaredLength(t *testing.T) {
	// CapLen 0; the four bytes that follow belong to the next capability.
	caps := append(capBytes(capFourOctetAS, nil), capBytes(capUnknownA, []byte{0x00, 0x00, 0xfd, 0xe8})...)
	requireRejected(t, caps)
}

func TestSec_FourOctetASShortDeclaredLength(t *testing.T) {
	caps := append(capBytes(capFourOctetAS, []byte{0x00, 0x01}), capBytes(capUnknownA, []byte{0x00, 0x00, 0x00, 0x00})...)
	requireRejected(t, caps)
}

func TestSec_FourOctetASLongDeclaredLength(t *testing.T) {
	// A fixed-size value must declare exactly its size; a longer declared length must not be accepted.
	caps := capBytes(capFourOctetAS, []byte{0x00, 0x00, 0xfd, 0xe8, 0x00})
	requireRejected(t, caps)
}

func TestSec_MultiProtocolZeroDeclaredLength(t *testing.T) {
	caps := append(capBytes(capMultiProtocol, nil), capBytes(capUnknownA, []byte{0x00, 0x01, 0x00, 0x01})...)
	requireRejected(t, caps)
}

func TestSec_MultiProtocolShortDeclaredLength(t *testing.T) {
	caps := append(capBytes(capMultiProtocol, []byte{0x00, 0x01}), capBytes(capUnknownA, []byte{0x00, 0x01, 0x00, 0x01})...)
	requireRejected(t, caps)
}

func TestSec_MultiProtocolLongDeclaredLength(t *testing.T) {
	caps := capBytes(capMultiProtocol, []byte{0x00, 0x01, 0x00, 0x01, 0x00})
	requireRejected(t, caps)
}

func TestSec_GracefulRestartZeroDeclaredLength(t *testing.T) {
	caps := append(capBytes(capGracefulRestart, nil), capBytes(capUnknownA, []byte{0x80, 0x78, 0x00, 0x00})...)
	requireRejected(t, caps)
}

func TestSec_GracefulRestartShortDeclaredLength(t *testing.T) {
	caps := append(capBytes(capGracefulRestart, []byte{0x80}), capBytes(capUnknownA, []byte{0x78, 0x00, 0x00, 0x00})...)
	requireRejected(t, caps)
}

func TestSec_FQDNDomainNamePastDeclaredLength(t *testing.T) {
	// The value declares a domain name of two bytes but only its length byte is inside CapLen.
	caps := append(capBytes(capFQDN, []byte{0x00, 0x02}), capBytes(capUnknownA, []byte{'A', 'B'})...)
	requireRejected(t, caps)
}

func TestSec_FQDNHostNamePastDeclaredLength(t *testing.T) {
	// The value declares a five-byte host name but only its length byte is inside CapLen.
	caps := append(capBytes(capFQDN, []byte{0x05, 0x00}), capBytes(capUnknownA, []byte{'A', 'B', 0x00})...)
	requireRejected(t, caps)
}

func TestSec_SoftwareVersionPastDeclaredLength(t *testing.T) {
	// The value declares a four-byte version string but only one byte of it is inside CapLen.
	caps := append(capBytes(capSoftwareVersion, []byte{0x04, 'A'}), capBytes(capUnknownA, []byte{'B', 'C', 'D', 'E'})...)
	requireRejected(t, caps)
}

func TestSec_ORFShortDeclaredLength(t *testing.T) {
	// The ORF capability declares two bytes; an entry and its type bytes come from the next capability.
	caps := append(capBytes(capORF, []byte{0x00, 0x01}), capBytes(capUnknownA, []byte{0x00, 0x01, 0x00, 0x01})...)
	requireRejected(t, caps)
}

func TestSec_ORFTupleTypesPastDeclaredLength(t *testing.T) {
	// An ORF entry's type count says five, but only four bytes are declared inside the capability.
	caps := append(capBytes(capORF, []byte{0x00, 0x01, 0x01, 0x05}), capBytes(capUnknownA, []byte{0x01, 0x02, 0x03, 0x04, 0x05})...)
	requireRejected(t, caps)
}

func TestSec_ParseBGPBodyRejectsDeclaredLengthViolation(t *testing.T) {
	caps := append(capBytes(capFourOctetAS, nil), capBytes(capUnknownA, []byte{0x00, 0x00, 0xfd, 0xe8})...)
	message := openMessage(caps)

	hdr := &bgp.BGPHeader{}
	if err := hdr.DecodeFromBytes(message); err != nil {
		t.Fatalf("could not decode the message header: %v", err)
	}
	var err error
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("body parser panicked instead of returning an error: %v", r)
			}
		}()
		_, err = bgp.ParseBGPBody(hdr, message[19:])
	}()
	if err == nil {
		t.Fatalf("body parser accepted the declared-length violation")
	}
}

func TestSec_OpenBodyDecoderRejectsDeclaredLengthViolation(t *testing.T) {
	caps := append(capBytes(capFourOctetAS, nil), capBytes(capUnknownA, []byte{0x00, 0x00, 0xfd, 0xe8})...)
	message := openMessage(caps)

	var err error
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("OPEN body decoder panicked instead of returning an error: %v", r)
			}
		}()
		open := &bgp.BGPOpen{}
		err = open.DecodeFromBytes(message[19:])
	}()
	if err == nil {
		t.Fatalf("OPEN body decoder accepted the declared-length violation")
	}
}

// The same guarantee holds when a caller decodes a single capability through the library's
// exported capability decoders, where no message-level wrapper supplies a bound.

func TestSec_DirectFourOctetASDecoder(t *testing.T) {
	requireDecoderRejected(t, (&bgp.CapFourOctetASNumber{}).DecodeFromBytes,
		[]byte{capFourOctetAS, 0x00, 0x00, 0x00, 0xfd, 0xe8})
}

func TestSec_DirectMultiProtocolDecoder(t *testing.T) {
	requireDecoderRejected(t, (&bgp.CapMultiProtocol{}).DecodeFromBytes,
		[]byte{capMultiProtocol, 0x02, 0x00, 0x01, capUnknownA, 0x04, 0x00, 0x01, 0x00, 0x01})
}

func TestSec_DirectGracefulRestartDecoder(t *testing.T) {
	requireDecoderRejected(t, (&bgp.CapGracefulRestart{}).DecodeFromBytes,
		[]byte{capGracefulRestart, 0x01, 0x80, capUnknownA, 0x04, 0x00, 0x01, 0x00, 0x01})
}

func TestSec_DirectFQDNDecoder(t *testing.T) {
	requireDecoderRejected(t, (&bgp.CapFQDN{}).DecodeFromBytes,
		[]byte{capFQDN, 0x02, 0x00, 0x02, capUnknownA, 0x00})
}

func TestSec_DirectSoftwareVersionDecoder(t *testing.T) {
	requireDecoderRejected(t, (&bgp.CapSoftwareVersion{}).DecodeFromBytes,
		[]byte{capSoftwareVersion, 0x02, 0x04, 'A', capUnknownA, 0x04, 'B', 'C', 'D', 'E'})
}

func TestSec_DirectORFDecoder(t *testing.T) {
	requireDecoderRejected(t, (&bgp.CapORF{}).DecodeFromBytes,
		[]byte{capORF, 0x02, 0x00, 0x01, capUnknownA, 0x00})
}

func TestSec_DirectCapabilityDispatch(t *testing.T) {
	raw := []byte{capFourOctetAS, 0x00, 0x00, 0x00, 0xfd, 0xe8}
	var err error
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("capability dispatcher panicked instead of returning an error: %v", r)
			}
		}()
		_, err = bgp.DecodeCapability(raw)
	}()
	if err == nil {
		t.Fatalf("capability dispatcher accepted bytes outside the declared length")
	}
}
