// Hidden test support for the SCTP State Cookie tasks.
//
// Everything in this file is test bookkeeping: packets are built and parsed
// byte-by-byte here (including CRC32c) so that a hardened product helper can
// never crash or silently change a test's expected values.
#ifndef MS_HIDDEN_SCTP_COMMON_HPP
#define MS_HIDDEN_SCTP_COMMON_HPP

#include "common.hpp"
#include "RTC/SCTP/association/Association.hpp"
#include "RTC/SCTP/public/SctpOptions.hpp"
#include "mocks/include/MockShared.hpp"
#include "mocks/include/RTC/SCTP/association/MockAssociationListener.hpp"
#include <catch2/catch_test_macros.hpp>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace hidden_sctp
{
	// SCTP chunk types used here.
	constexpr uint8_t ChunkData{ 0 };
	constexpr uint8_t ChunkInit{ 1 };
	constexpr uint8_t ChunkInitAck{ 2 };
	constexpr uint8_t ChunkCookieEcho{ 10 };
	constexpr uint8_t ChunkCookieAck{ 11 };
	constexpr uint8_t ParameterStateCookie{ 7 };

	// Fake clock origin.
	constexpr uint64_t InitialNowMs{ 1000000 };

	// A CRC32c (Castagnoli) table, built once by the test itself.
	inline uint32_t Crc32c(const uint8_t* data, size_t len)
	{
		static uint32_t table[256];
		static bool tableReady{ false };

		if (!tableReady)
		{
			for (uint32_t i{ 0 }; i < 256; ++i)
			{
				uint32_t c = i;

				for (int k{ 0 }; k < 8; ++k)
				{
					c = (c & 1u) ? (0x82F63B78u ^ (c >> 1)) : (c >> 1);
				}

				table[i] = c;
			}

			tableReady = true;
		}

		uint32_t crc{ 0xFFFFFFFFu };

		for (size_t i{ 0 }; i < len; ++i)
		{
			crc = (crc >> 8) ^ table[(crc ^ data[i]) & 0xFF];
		}

		return ~crc;
	}

	inline void WriteCrc32c(std::vector<uint8_t>& packet)
	{
		// SCTP places the CRC32c in the checksum field least significant byte first.
		packet[8] = packet[9] = packet[10] = packet[11] = 0;

		const uint32_t crc = Crc32c(packet.data(), packet.size());

		packet[8]  = static_cast<uint8_t>(crc & 0xFF);
		packet[9]  = static_cast<uint8_t>((crc >> 8) & 0xFF);
		packet[10] = static_cast<uint8_t>((crc >> 16) & 0xFF);
		packet[11] = static_cast<uint8_t>((crc >> 24) & 0xFF);
	}

	inline void PutU16(std::vector<uint8_t>& out, uint16_t value)
	{
		out.push_back(static_cast<uint8_t>((value >> 8) & 0xFF));
		out.push_back(static_cast<uint8_t>(value & 0xFF));
	}

	inline void PutU32(std::vector<uint8_t>& out, uint32_t value)
	{
		out.push_back(static_cast<uint8_t>((value >> 24) & 0xFF));
		out.push_back(static_cast<uint8_t>((value >> 16) & 0xFF));
		out.push_back(static_cast<uint8_t>((value >> 8) & 0xFF));
		out.push_back(static_cast<uint8_t>(value & 0xFF));
	}

	inline void PutU64(std::vector<uint8_t>& out, uint64_t value)
	{
		for (int shift{ 56 }; shift >= 0; shift -= 8)
		{
			out.push_back(static_cast<uint8_t>((value >> shift) & 0xFF));
		}
	}

	inline uint16_t GetU16(const uint8_t* p)
	{
		return static_cast<uint16_t>((static_cast<uint16_t>(p[0]) << 8) | p[1]);
	}

	inline uint32_t GetU32(const uint8_t* p)
	{
		return (static_cast<uint32_t>(p[0]) << 24) | (static_cast<uint32_t>(p[1]) << 16) |
		       (static_cast<uint32_t>(p[2]) << 8) | static_cast<uint32_t>(p[3]);
	}

	inline void PadTo4(std::vector<uint8_t>& chunk)
	{
		while (chunk.size() % 4 != 0)
		{
			chunk.push_back(0);
		}
	}

	// Builds an SCTP packet around one already padded chunk.
	inline std::vector<uint8_t> MakePacket(
	  uint32_t verificationTag, const std::vector<uint8_t>& chunk)
	{
		std::vector<uint8_t> packet;

		PutU16(packet, 5000);                       // source port
		PutU16(packet, 5000);                       // destination port
		PutU32(packet, verificationTag);            // verification tag
		PutU32(packet, 0);                          // checksum (written below)
		packet.insert(packet.end(), chunk.begin(), chunk.end());

		WriteCrc32c(packet);

		return packet;
	}

	// Builds an INIT chunk (no parameters).
	inline std::vector<uint8_t> MakeInit(
	  uint32_t initiateTag, uint32_t initialTsn, uint32_t aRwnd, uint16_t outStreams, uint16_t inStreams)
	{
		std::vector<uint8_t> chunk;

		chunk.push_back(ChunkInit);
		chunk.push_back(0);
		PutU16(chunk, 20); // chunk length
		PutU32(chunk, initiateTag);
		PutU32(chunk, aRwnd);
		PutU16(chunk, outStreams);
		PutU16(chunk, inStreams);
		PutU32(chunk, initialTsn);

		return MakePacket(0, chunk);
	}

	// Builds a COOKIE-ECHO chunk carrying the given cookie.
	inline std::vector<uint8_t> MakeCookieEcho(uint32_t verificationTag, const std::vector<uint8_t>& cookie)
	{
		std::vector<uint8_t> chunk;

		chunk.push_back(ChunkCookieEcho);
		chunk.push_back(0);
		PutU16(chunk, static_cast<uint16_t>(4 + cookie.size()));
		chunk.insert(chunk.end(), cookie.begin(), cookie.end());
		PadTo4(chunk);

		return MakePacket(verificationTag, chunk);
	}

	// Builds a DATA chunk carrying one complete ordered message.
	inline std::vector<uint8_t> MakeData(
	  uint32_t verificationTag,
	  uint32_t tsn,
	  uint16_t streamId,
	  uint16_t streamSequenceNumber,
	  uint32_t ppid,
	  const std::vector<uint8_t>& payload)
	{
		std::vector<uint8_t> chunk;

		chunk.push_back(ChunkData);
		chunk.push_back(0x03); // B and E set: one complete message
		PutU16(chunk, static_cast<uint16_t>(16 + payload.size()));
		PutU32(chunk, tsn);
		PutU16(chunk, streamId);
		PutU16(chunk, streamSequenceNumber);
		PutU32(chunk, ppid);
		chunk.insert(chunk.end(), payload.begin(), payload.end());
		PadTo4(chunk);

		return MakePacket(verificationTag, chunk);
	}

	// Builds a plain (unauthenticated) State Cookie in the format the pinned
	// product understands: 8-byte magic, tags, TSNs, a_rwnd, tie-tag and the
	// negotiated capabilities block with magic2.
	inline std::vector<uint8_t> MakePlainCookie(
	  uint32_t localVerificationTag,
	  uint32_t remoteVerificationTag,
	  uint32_t localInitialTsn,
	  uint32_t remoteInitialTsn,
	  uint32_t remoteAdvertisedReceiverWindowCredit,
	  uint64_t tieTag,
	  uint16_t maxOutboundStreams,
	  uint16_t maxInboundStreams)
	{
		std::vector<uint8_t> cookie;

		cookie.push_back(0x6D); // 'm'
		cookie.push_back(0x73); // 's'
		cookie.push_back(0x77); // 'w'
		cookie.push_back(0x6F); // 'o'
		cookie.push_back(0x72); // 'r'
		cookie.push_back(0x6B); // 'k'
		cookie.push_back(0x65); // 'e'
		cookie.push_back(0x72); // 'r'
		PutU32(cookie, localVerificationTag);
		PutU32(cookie, remoteVerificationTag);
		PutU32(cookie, localInitialTsn);
		PutU32(cookie, remoteInitialTsn);
		PutU32(cookie, remoteAdvertisedReceiverWindowCredit);
		PutU64(cookie, tieTag);
		cookie.push_back(0);      // reserved
		cookie.push_back(0);      // capability bits
		PutU16(cookie, 0xAD81);   // magic2
		PutU16(cookie, maxOutboundStreams);
		PutU16(cookie, maxInboundStreams);

		return cookie;
	}

	// Returns the offset of the first chunk of the given type, or npos.
	inline size_t FindChunk(const std::vector<uint8_t>& packet, uint8_t type)
	{
		size_t offset{ 12 };

		while (offset + 4 <= packet.size())
		{
			const uint8_t chunkType = packet[offset];
			const uint16_t chunkLength = GetU16(packet.data() + offset + 2);

			if (chunkType == type)
			{
				return offset;
			}

			if (chunkLength < 4)
			{
				break;
			}

			offset += (static_cast<size_t>(chunkLength) + 3) & ~static_cast<size_t>(3);
		}

		return std::string::npos;
	}

	inline bool HasChunk(const std::vector<uint8_t>& packet, uint8_t type)
	{
		return FindChunk(packet, type) != std::string::npos;
	}

	// Extracts the cookie carried by a COOKIE-ECHO packet.
	inline std::vector<uint8_t> CookieFromCookieEcho(const std::vector<uint8_t>& packet)
	{
		const size_t offset = FindChunk(packet, ChunkCookieEcho);

		if (offset == std::string::npos || offset + 4 > packet.size())
		{
			return {};
		}

		const uint16_t chunkLength = GetU16(packet.data() + offset + 2);

		if (chunkLength < 4 || offset + chunkLength > packet.size())
		{
			return {};
		}

		return std::vector<uint8_t>(
		  packet.begin() + static_cast<std::ptrdiff_t>(offset + 4),
		  packet.begin() + static_cast<std::ptrdiff_t>(offset + chunkLength));
	}

	// Extracts the Initiate Tag of an INIT-ACK packet.
	inline uint32_t InitiateTagFromInitAck(const std::vector<uint8_t>& packet)
	{
		const size_t offset = FindChunk(packet, ChunkInitAck);

		if (offset == std::string::npos || offset + 8 > packet.size())
		{
			return 0;
		}

		return GetU32(packet.data() + offset + 4);
	}

	// Extracts the initial TSN of an INIT packet.
	inline uint32_t InitialTsnFromInit(const std::vector<uint8_t>& packet)
	{
		const size_t offset = FindChunk(packet, ChunkInit);

		if (offset == std::string::npos || offset + 20 > packet.size())
		{
			return 0;
		}

		return GetU32(packet.data() + offset + 16);
	}

	// Extracts the Initiate Tag of an INIT packet.
	inline uint32_t InitiateTagFromInit(const std::vector<uint8_t>& packet)
	{
		const size_t offset = FindChunk(packet, ChunkInit);

		if (offset == std::string::npos || offset + 8 > packet.size())
		{
			return 0;
		}

		return GetU32(packet.data() + offset + 4);
	}

	// Extracts the State Cookie from an INIT-ACK packet.
	inline std::vector<uint8_t> CookieFromInitAck(const std::vector<uint8_t>& packet)
	{
		const size_t chunkOffset = FindChunk(packet, ChunkInitAck);

		if (chunkOffset == std::string::npos)
		{
			return {};
		}

		const uint16_t chunkLength = GetU16(packet.data() + chunkOffset + 2);

		if (chunkLength < 24)
		{
			return {};
		}

		const size_t chunkEnd = chunkOffset + chunkLength;
		size_t offset{ chunkOffset + 20 }; // INIT-ACK fixed part

		while (offset + 4 <= chunkEnd)
		{
			const uint16_t parameterType = GetU16(packet.data() + offset);
			const uint16_t parameterLength = GetU16(packet.data() + offset + 2);

			if (parameterLength < 4 || offset + parameterLength > chunkEnd)
			{
				break;
			}

			if (parameterType == ParameterStateCookie)
			{
				return std::vector<uint8_t>(
				  packet.begin() + static_cast<std::ptrdiff_t>(offset + 4),
				  packet.begin() + static_cast<std::ptrdiff_t>(offset + parameterLength));
			}

			offset += (static_cast<size_t>(parameterLength) + 3) & ~static_cast<size_t>(3);
		}

		return {};
	}

	// An SCTP Association under test with its own fake clock and listener.
	class AssociationUnderTest
	{
	public:
		explicit AssociationUnderTest(
		  RTC::SCTP::SctpOptions sctpOptions = RTC::SCTP::SctpOptions(),
		  bool mayConnectOnReceivedSctpData  = false)
		  : sctpOptions(sctpOptions),
		    shared(
		      /*getTimeMs*/
		      [this]()
		      {
			      return this->nowMs;
		      }),
		    association(
		      this->sctpOptions,
		      std::addressof(this->listener),
		      std::addressof(this->shared),
		      /*isDataChannel*/ true,
		      mayConnectOnReceivedSctpData)
		{
		}

		void Receive(const std::vector<uint8_t>& packet)
		{
			this->association.ReceiveSctpData(packet.data(), packet.size());
		}

		std::vector<uint8_t> TakeFirstSentPacket()
		{
			return this->listener.ConsumeFirstSentPacket();
		}

		void DrainSentPackets()
		{
			while (!this->listener.ConsumeFirstSentPacket().empty())
			{
			}
		}

		void SendMessage(uint16_t streamId, const std::vector<uint8_t>& payload)
		{
			this->association.SendMessage(
			  RTC::SCTP::Message(streamId, /*ppid*/ 53, payload), RTC::SCTP::SendMessageOptions());
		}

		void ExchangeWith(AssociationUnderTest& peer)
		{
			bool delivered{ false };

			do
			{
				delivered = false;

				auto fromThis = this->TakeFirstSentPacket();

				if (!fromThis.empty())
				{
					delivered = true;
					peer.Receive(fromThis);
				}

				auto fromPeer = peer.TakeFirstSentPacket();

				if (!fromPeer.empty())
				{
					delivered = true;
					this->Receive(fromPeer);
				}
			} while (delivered);
		}

	public:
		uint64_t nowMs{ InitialNowMs };
		RTC::SCTP::SctpOptions sctpOptions;
		mocks::RTC::SCTP::MockAssociationListener listener;
		mocks::MockShared shared;
		RTC::SCTP::Association association;
	};

	// Drives a full INIT / INIT-ACK / COOKIE-ECHO / COOKIE-ACK handshake and
	// returns the packets the passive side sent, so tests can reuse them.
	struct HandshakePackets
	{
		std::vector<uint8_t> init;
		std::vector<uint8_t> initAck;
		std::vector<uint8_t> cookieEcho;
		std::vector<uint8_t> cookieAck;
	};

	inline HandshakePackets Establish(
	  AssociationUnderTest& active, AssociationUnderTest& passive)
	{
		HandshakePackets packets;

		active.association.Connect();

		packets.init = active.TakeFirstSentPacket();
		REQUIRE(!packets.init.empty());
		passive.Receive(packets.init);

		packets.initAck = passive.TakeFirstSentPacket();
		REQUIRE(!packets.initAck.empty());
		active.Receive(packets.initAck);

		packets.cookieEcho = active.TakeFirstSentPacket();
		REQUIRE(!packets.cookieEcho.empty());
		passive.Receive(packets.cookieEcho);

		packets.cookieAck = passive.TakeFirstSentPacket();
		REQUIRE(!packets.cookieAck.empty());
		active.Receive(packets.cookieAck);

		return packets;
	}
} // namespace hidden_sctp

#endif
