// Hidden security tests: SCTP State Cookie authentication.
//
// Every test drives the real SCTP association entry point (ReceiveSctpData)
// with packets assembled in the test itself, and asserts only the outcome:
// no association state change, not connected, and no COOKIE-ACK that would let
// the sender treat the association as established.
#include "harness/sctp_hidden_common.hpp"

using namespace hidden_sctp;

TEST_CASE("state cookie: forged cookie cannot establish an association", "[security][sctp-hidden]")
{
	AssociationUnderTest passive;

	// A cookie with the expected magic values but attacker-chosen association
	// parameters and no proof of origin.
	auto cookie = MakePlainCookie(
	  /*localVerificationTag*/ 0xA1B2C3D4,
	  /*remoteVerificationTag*/ 0x11223344,
	  /*localInitialTsn*/ 1000,
	  /*remoteInitialTsn*/ 2000,
	  /*remoteAdvertisedReceiverWindowCredit*/ 65535,
	  /*tieTag*/ 0,
	  /*maxOutboundStreams*/ 10,
	  /*maxInboundStreams*/ 10);

	const auto packet = MakeCookieEcho(0xA1B2C3D4, cookie);

	passive.Receive(packet);

	REQUIRE(passive.association.GetAssociationState() != RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(!passive.listener.IsConnected());
	REQUIRE(!HasChunk(passive.TakeFirstSentPacket(), ChunkCookieAck));
}

TEST_CASE("state cookie: a modified genuine cookie is rejected", "[security][sctp-hidden]")
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

	// The passive side has not seen the COOKIE-ECHO yet.
	REQUIRE(passive.association.GetAssociationState() != RTC::SCTP::Types::AssociationState::CONNECTED);

	// Flip one byte inside the base cookie body (the local initial TSN) of the
	// cookie the passive side itself generated, then repair the packet checksum.
	// A cookie that was modified on the way must not be accepted.
	const size_t cookieOffset{ 16 }; // packet header + chunk header
	REQUIRE(cookieEcho.size() > cookieOffset + 20);
	cookieEcho[cookieOffset + 16] ^= 0x01;
	WriteCrc32c(cookieEcho);

	passive.Receive(cookieEcho);

	REQUIRE(passive.association.GetAssociationState() != RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(!passive.listener.IsConnected());
	REQUIRE(!HasChunk(passive.TakeFirstSentPacket(), ChunkCookieAck));
}

TEST_CASE("state cookie: an expired genuine cookie is rejected", "[security][sctp-hidden]")
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

	// The cookie is genuine but is only presented long after it was created.
	passive.nowMs += 60 * 60 * 1000;

	passive.Receive(cookieEcho);

	REQUIRE(passive.association.GetAssociationState() != RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(!passive.listener.IsConnected());
	REQUIRE(!HasChunk(passive.TakeFirstSentPacket(), ChunkCookieAck));
}

TEST_CASE("state cookie: a forged cookie cannot restart an existing association", "[security][sctp-hidden]")
{
	AssociationUnderTest active;
	AssociationUnderTest passive;

	auto packets = Establish(active, passive);

	REQUIRE(active.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);
	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	const uint32_t passiveLocalTag  = InitiateTagFromInitAck(packets.initAck);
	const uint32_t activeInitiateTag = InitiateTagFromInit(packets.init);

	passive.DrainSentPackets();

	const uint16_t streamsBefore = passive.association.GetNegotiatedMaxOutboundStreams();

	uint32_t forgedRemoteTag = 0x6F6F6F6F;

	if (forgedRemoteTag == activeInitiateTag)
	{
		++forgedRemoteTag;
	}

	// A foreign cookie aimed at the established association: same local tag the
	// passive side uses, a different remote tag and different stream limits.
	auto cookie = MakePlainCookie(
	  passiveLocalTag,
	  forgedRemoteTag,
	  /*localInitialTsn*/ 5000,
	  /*remoteInitialTsn*/ 6000,
	  /*remoteAdvertisedReceiverWindowCredit*/ 65535,
	  /*tieTag*/ 0,
	  /*maxOutboundStreams*/ 17,
	  /*maxInboundStreams*/ 19);

	const auto packet = MakeCookieEcho(passiveLocalTag, cookie);

	passive.Receive(packet);

	// The transmission control state must not have been replaced by the cookie
	// values, and the sender must not get a COOKIE-ACK.
	REQUIRE(passive.association.GetNegotiatedMaxOutboundStreams() == streamsBefore);
	REQUIRE(!HasChunk(passive.TakeFirstSentPacket(), ChunkCookieAck));
}

TEST_CASE("state cookie: an unsigned restart cannot take over an association", "[security][sctp-hidden]")
{
	AssociationUnderTest active;
	AssociationUnderTest passive;

	auto packets = Establish(active, passive);

	REQUIRE(passive.association.GetAssociationState() == RTC::SCTP::Types::AssociationState::CONNECTED);

	const uint32_t passiveLocalTag{ InitiateTagFromInitAck(packets.initAck) };
	const uint32_t activeInitialTsn{ InitialTsnFromInit(packets.init) };

	passive.DrainSentPackets();
	passive.listener.ConsumeFirstReceivedMessage();

	// Another host claims the peer restarted, using its own tags and TSNs.
	const uint32_t attackerInitiateTag{ 0x0BADCAFE };
	const uint32_t attackerInitialTsn{ 424242 };

	auto init = MakeInit(
	  attackerInitiateTag,
	  attackerInitialTsn,
	  /*aRwnd*/ 65535,
	  /*outStreams*/ 65535,
	  /*inStreams*/ 65535);

	passive.Receive(init);

	auto initAck = passive.TakeFirstSentPacket();
	REQUIRE(!initAck.empty());

	// The tag the association now expects on packets from "the peer".
	const uint32_t newLocalTag{ InitiateTagFromInitAck(initAck) };

	// The attacker sends data using the tag it just learned.
	auto attackerData = MakeData(
	  newLocalTag,
	  attackerInitialTsn,
	  /*streamId*/ 0,
	  /*streamSequenceNumber*/ 0,
	  /*ppid*/ 53,
	  /*payload*/ { 0x41, 0x42, 0x43 });

	passive.Receive(attackerData);

	// No message may be delivered from an association that was never proved.
	REQUIRE(!passive.listener.HasReceivedMessages());

	// The legitimate peer, which never restarted, must still be able to send.
	auto legitimateData = MakeData(
	  passiveLocalTag,
	  activeInitialTsn,
	  /*streamId*/ 0,
	  /*streamSequenceNumber*/ 0,
	  /*ppid*/ 53,
	  /*payload*/ { 0x44, 0x45, 0x46 });

	passive.Receive(legitimateData);

	REQUIRE(passive.listener.HasReceivedMessages());
}
