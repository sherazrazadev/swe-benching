// Hidden functional tests: legitimate SCTP use must keep working.
#include "harness/sctp_hidden_common.hpp"

using namespace hidden_sctp;

TEST_CASE("state cookie: two peers establish and exchange messages", "[functional][sctp-hidden]")
{
	AssociationUnderTest active;
	AssociationUnderTest passive;

	Establish(active, passive);

	REQUIRE(active.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	active.SendMessage(0, { 0x01, 0x02, 0x03 });
	active.ExchangeWith(passive);

	REQUIRE(passive.listener.HasReceivedMessages());

	passive.SendMessage(0, { 0x04, 0x05, 0x06 });
	passive.ExchangeWith(active);

	REQUIRE(active.listener.HasReceivedMessages());
}

TEST_CASE("state cookie: a retransmitted handshake message does not break the association", "[functional][sctp-hidden]")
{
	AssociationUnderTest active;
	AssociationUnderTest passive;

	auto packets = Establish(active, passive);

	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	passive.DrainSentPackets();

	// The peer did not see the COOKIE-ACK and retransmits its COOKIE-ECHO.
	passive.Receive(packets.cookieEcho);

	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(!passive.listener.HasErrored());
	REQUIRE(HasChunk(passive.TakeFirstSentPacket(), ChunkCookieAck));

	// The association keeps carrying messages afterwards.
	active.SendMessage(0, { 0x10, 0x11 });
	active.ExchangeWith(passive);

	REQUIRE(passive.listener.HasReceivedMessages());
}

TEST_CASE("state cookie: a promptly used cookie is accepted", "[functional][sctp-hidden]")
{
	AssociationUnderTest active;
	AssociationUnderTest passive;

	active.association.Connect();

	auto init = active.TakeFirstSentPacket();
	REQUIRE(!init.empty());
	passive.Receive(init);

	auto initAck = passive.TakeFirstSentPacket();
	REQUIRE(!initAck.empty());
	active.Receive(initAck);

	auto cookieEcho = active.TakeFirstSentPacket();
	REQUIRE(!cookieEcho.empty());

	// One second between generation and use is prompt by any reasonable measure.
	passive.nowMs += 1000;

	passive.Receive(cookieEcho);

	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	auto cookieAck = passive.TakeFirstSentPacket();
	REQUIRE(!cookieAck.empty());
	active.Receive(cookieAck);
	REQUIRE(active.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);
}

TEST_CASE("state cookie: a small backward clock adjustment does not expire a cookie", "[functional][sctp-hidden]")
{
	AssociationUnderTest active;
	AssociationUnderTest passive;

	active.association.Connect();

	auto init = active.TakeFirstSentPacket();
	REQUIRE(!init.empty());
	passive.Receive(init);

	auto initAck = passive.TakeFirstSentPacket();
	REQUIRE(!initAck.empty());
	active.Receive(initAck);

	auto cookieEcho = active.TakeFirstSentPacket();
	REQUIRE(!cookieEcho.empty());

	// The receiving endpoint's wall clock was adjusted a few seconds backwards
	// after the cookie was created. The cookie is still fresh.
	passive.nowMs -= 5000;

	passive.Receive(cookieEcho);

	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);
}

TEST_CASE("state cookie: a peer restart re-establishes the association", "[functional][sctp-hidden]")
{
	AssociationUnderTest oldPeer;
	AssociationUnderTest passive;

	Establish(oldPeer, passive);

	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	// A new endpoint on the same path (the peer process restarted).
	AssociationUnderTest newPeer;

	newPeer.association.Connect();

	auto init = newPeer.TakeFirstSentPacket();
	REQUIRE(!init.empty());
	passive.Receive(init);

	auto initAck = passive.TakeFirstSentPacket();
	REQUIRE(!initAck.empty());
	newPeer.Receive(initAck);

	auto cookieEcho = newPeer.TakeFirstSentPacket();
	REQUIRE(!cookieEcho.empty());
	passive.Receive(cookieEcho);

	auto cookieAck = passive.TakeFirstSentPacket();
	REQUIRE(!cookieAck.empty());
	newPeer.Receive(cookieAck);

	REQUIRE(newPeer.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	newPeer.SendMessage(0, { 0x21, 0x22 });
	newPeer.ExchangeWith(passive);

	REQUIRE(passive.listener.HasReceivedMessages());
}
