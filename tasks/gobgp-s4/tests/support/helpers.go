// Package vtesting holds the hidden behavioural checks for the gobgp-s4 task.
//
// Every check drives the product's exported BGP OPEN decoding entry points with byte
// buffers built here: whole OPEN messages through the message parser, and single
// capabilities through the exported capability dispatcher and per-type decoders.
// Nothing here reaches the network.
package vtesting

import (
	"encoding/binary"
	"testing"

	"github.com/osrg/gobgp/v4/pkg/packet/bgp"
)

// Capability codes and the optional-parameter type used by the checks.
const (
	capMultiProtocol   = byte(1)
	capRouteRefresh    = byte(2)
	capORF             = byte(3)
	capCarryingLabels  = byte(4)
	capExtendedNexthop = byte(5)
	capGracefulRestart = byte(64)
	capFourOctetAS     = byte(65)
	capAddPath         = byte(69)
	capEnhancedRR      = byte(70)
	capLLGR            = byte(71)
	capFQDN            = byte(73)
	capSoftwareVersion = byte(75)
	capCiscoRR         = byte(128)
	capUnknownA        = byte(200)
	optCapability      = byte(2)
)

func capBytes(code byte, value []byte) []byte {
	out := []byte{code, byte(len(value))}
	return append(out, value...)
}

func optionParameter(paramType byte, value []byte) []byte {
	out := []byte{paramType, byte(len(value))}
	return append(out, value...)
}

// openMessage builds a complete BGP OPEN message (header + body) whose single capability
// optional parameter carries the given capability bytes.
func openMessage(capabilities []byte) []byte {
	return openMessageWithParams(optionParameter(optCapability, capabilities))
}

// openMessageWithParams builds a complete BGP OPEN message from raw optional-parameter bytes.
func openMessageWithParams(optParams []byte) []byte {
	body := []byte{4, 0xfa, 0x7b, 0x00, 0xf0, 127, 0, 0, 2, byte(len(optParams))}
	body = append(body, optParams...)
	hdr := make([]byte, 19)
	for i := 0; i < 16; i++ {
		hdr[i] = 0xff
	}
	binary.BigEndian.PutUint16(hdr[16:], uint16(19+len(body)))
	hdr[18] = 1 // BGP_MSG_OPEN
	return append(hdr, body...)
}

// decodeOpen parses an OPEN built from the given capability bytes and returns the body.
// It fails the check if the message is rejected or the parser panics.
func decodeOpen(t *testing.T, capabilities []byte) *bgp.BGPOpen {
	t.Helper()
	return decodeOpenParams(t, optionParameter(optCapability, capabilities))
}

// decodeOpenParams parses an OPEN built from raw optional-parameter bytes.
func decodeOpenParams(t *testing.T, optParams []byte) *bgp.BGPOpen {
	t.Helper()
	var (
		msg *bgp.BGPMessage
		err error
	)
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("parsing a legitimate OPEN panicked: %v", r)
			}
		}()
		msg, err = bgp.ParseBGPMessage(openMessageWithParams(optParams))
	}()
	if err != nil {
		t.Fatalf("legitimate OPEN was rejected: %v", err)
	}
	body, ok := msg.Body.(*bgp.BGPOpen)
	if !ok {
		t.Fatalf("OPEN body has unexpected type %T", msg.Body)
	}
	return body
}

// requireRejected parses an OPEN built from the given capability bytes and requires the
// parser to refuse it with an error (not a panic).
func requireRejected(t *testing.T, capabilities []byte) {
	t.Helper()
	requireRejectedMessage(t, openMessage(capabilities))
}

// requireRejectedMessage requires an already-built message to be refused with an error.
func requireRejectedMessage(t *testing.T, message []byte) {
	t.Helper()
	var err error
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("parser panicked instead of returning an error: %v", r)
			}
		}()
		_, err = bgp.ParseBGPMessage(message)
	}()
	if err == nil {
		t.Fatalf("message was accepted; the declared-length violation must be refused")
	}
}

// decodeRaw calls one exported capability decoder on a raw buffer and requires an error.
func requireDecoderRejected(t *testing.T, decode func([]byte) error, raw []byte) {
	t.Helper()
	var err error
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("capability decoder panicked instead of returning an error: %v", r)
			}
		}()
		err = decode(raw)
	}()
	if err == nil {
		t.Fatalf("capability decoder accepted bytes outside the declared length")
	}
}

// capabilitiesOf returns the capabilities carried by the OPEN's optional parameters.
func capabilitiesOf(t *testing.T, body *bgp.BGPOpen) []bgp.ParameterCapabilityInterface {
	t.Helper()
	var out []bgp.ParameterCapabilityInterface
	for _, p := range body.OptParams {
		pc, ok := p.(*bgp.OptionParameterCapability)
		if !ok {
			continue
		}
		out = append(out, pc.Capability...)
	}
	return out
}
