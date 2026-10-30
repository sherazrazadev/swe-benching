/**
 * Shared test harness for the grading suites.
 *
 * Opens the library's real socket on a stubbed websocket and delivers inbound messages through
 * the socket's own inbound processing entry. Events, key-store writes and identity-mapping
 * calls are recorded so a test can assert what a message did to local state.
 */
import { jest } from '@jest/globals'
import { EventEmitter } from 'events'
import { deflateSync } from 'zlib'
import P from 'pino'
import { proto } from '../../../../WAProto/index.js'

class FakeWebSocket extends EventEmitter {
	static CONNECTING = 0
	static OPEN = 1
	static CLOSING = 2
	static CLOSED = 3
	readyState = FakeWebSocket.OPEN
	constructor(public url?: unknown, public options?: unknown) {
		super()
	}
	override setMaxListeners(): this {
		return this
	}
	override close(): void {
		this.readyState = FakeWebSocket.CLOSED
		this.emit('close')
	}
	send(_data: unknown, cb?: (err?: Error) => void): boolean {
		cb?.()
		return true
	}
}

// Registered before any product module is imported (product modules are imported dynamically below).
jest.unstable_mockModule('ws', () => ({ default: FakeWebSocket, WebSocket: FakeWebSocket }))

export const logger = P({ level: 'silent' })

type Any = any

let modulesPromise: Promise<Any> | undefined
function loadModules(): Promise<Any> {
	if (!modulesPromise) {
		modulesPromise = (async () => {
			const socketMod: Any = await import('../../../Socket/index')
			const defaultsMod: Any = await import('../../../Defaults')
			const authMod: Any = await import('../../../Utils/auth-utils')
			return {
				makeWASocket: socketMod.default,
				DEFAULT_CONNECTION_CONFIG: defaultsMod.DEFAULT_CONNECTION_CONFIG,
				initAuthCreds: authMod.initAuthCreds,
				proto
			}
		})()
	}
	return modulesPromise
}

const EVENT_NAMES = [
	'creds.update',
	'messaging-history.status',
	'messaging-history.set',
	'messages.upsert',
	'messages.update',
	'messages.reaction',
	'chats.update',
	'contacts.update',
	'group.member-tag.update'
] as const

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function makeKeyStore(writes: Any[]) {
	const data: Any = {}
	return {
		get: async (type: string, ids: string[]) => {
			const out: Any = {}
			for (const id of ids) out[id] = data[`${type}.${id}`]
			return out
		},
		set: async (dict: Any) => {
			writes.push(dict)
			for (const t of Object.keys(dict)) for (const id of Object.keys(dict[t])) data[`${t}.${id}`] = dict[t][id]
		},
		transaction: async (fn: Any) => fn(),
		isInTransaction: () => false
	}
}

export type Harness = {
	sock: Any
	proto: Any
	events: Record<string, Any[]>
	keyWrites: Any[]
	lidCalls: Any[]
	errors: unknown[]
	deliver: (content: Any, opts?: { fromMe?: boolean; id?: string; remoteJid?: string; participant?: string }) => Promise<void>
	deliverMessage: (message: Any) => Promise<void>
	close: () => Promise<void>
}

export async function openSocket(opts: { accountSyncCounter?: number } = {}): Promise<Harness> {
	const { makeWASocket, DEFAULT_CONNECTION_CONFIG, initAuthCreds } = await loadModules()
	const creds = initAuthCreds()
	creds.me = { id: 'me@s.whatsapp.net', lid: 'me@lid', name: 'me' }
	creds.accountSyncCounter = opts.accountSyncCounter ?? 1

	const keyWrites: Any[] = []
	const lidCalls: Any[] = []
	const fakeSignalRepository: Any = {
		lidMapping: {
			getLIDForPN: async () => undefined,
			getPNForLID: async () => undefined,
			storeLIDPNMappings: async (mappings: Any) => {
				lidCalls.push({ op: 'store', mappings })
			},
			getLIDForPNBatch: async () => ({})
		},
		migrateSession: async (pn: Any, lid: Any) => {
			lidCalls.push({ op: 'migrate', pn, lid })
		},
		storeLIDPNMappings: async (mappings: Any) => {
			lidCalls.push({ op: 'store', mappings })
		},
		close: () => {}
	}

	const config: Any = {
		...DEFAULT_CONNECTION_CONFIG,
		logger,
		auth: { creds, keys: makeKeyStore(keyWrites) },
		makeSignalRepository: () => fakeSignalRepository,
		defaultQueryTimeoutMs: 200,
		fireInitQueries: false,
		markOnlineOnConnect: false,
		waWebSocketUrl: new URL('wss://127.0.0.1:1')
	}

	const sock: Any = makeWASocket(config)
	const events: Record<string, Any[]> = {}
	for (const name of EVENT_NAMES) {
		events[name] = []
		sock.ev.on(name, (payload: Any) => events[name].push(payload))
	}

	// The connection is already online from a previous session, so the inbound path processes
	// messages immediately instead of waiting for an initial history bootstrap.
	sock.ev.emit('connection.update', { connection: 'open', receivedPendingNotifications: true })
	await tick()
	sock.ev.flush?.()

	const refusedErrors: unknown[] = []

	const deliverMessage = async (message: Any) => {
		try {
			await sock.upsertMessage(message, 'notify')
		} catch (error) {
			// A refusal that raises is still a refusal; the test only cares that no state changed.
			refusedErrors.push(error)
		}
		try {
			sock.ev.flush?.()
		} catch {
			/* buffer already released */
		}
		await tick()
	}

	return {
		sock,
		proto: (await loadModules()).proto,
		events,
		keyWrites,
		lidCalls,
		errors: refusedErrors,
		deliver: async (content, o = {}) =>
			deliverMessage({
				key: {
					remoteJid: o.remoteJid ?? 'peer@s.whatsapp.net',
					fromMe: o.fromMe ?? false,
					id: o.id ?? 'MSG1',
					...(o.participant ? { participant: o.participant } : {})
				},
				message: content,
				messageTimestamp: 1700000000
			}),
		deliverMessage,
		close: async () => {
			try {
				await sock.end(undefined)
			} catch {
				/* already closed */
			}
		}
	}
}

/** Message-content builders. They use the library's own protobuf definitions. */
export async function builders() {
	const { proto } = await loadModules()
	const Type = proto.Message.ProtocolMessage.Type

	const deflate = (bytes: Uint8Array) => new Uint8Array(deflateSync(Buffer.from(bytes)))

	const historyPayload = (syncType = proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP) =>
		deflate(proto.HistorySync.encode({ syncType, conversations: [] }).finish())

	return {
		proto,
		Type,
		historyNotification: (fromMe: boolean) => ({
			type: Type.HISTORY_SYNC_NOTIFICATION,
			fromMe,
			content: {
				protocolMessage: {
					type: Type.HISTORY_SYNC_NOTIFICATION,
					historySyncNotification: {
						syncType: proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
						initialHistBootstrapInlinePayload: historyPayload(),
						fileLength: 0
					}
				}
			}
		}),
		appStateKeyShare: () => ({
			protocolMessage: {
				type: Type.APP_STATE_SYNC_KEY_SHARE,
				appStateSyncKeyShare: {
					keys: [
						{
							keyId: { keyId: Buffer.from('spoofed-key-id') },
							keyData: { keyData: Buffer.from('spoofed-key-data') }
						}
					]
				}
			}
		}),
		lidMigrationSync: () => ({
			protocolMessage: {
				type: Type.LID_MIGRATION_MAPPING_SYNC,
				lidMigrationMappingSyncMessage: {
					encodedMappingPayload: proto.LIDMigrationMappingSyncPayload.encode({
						pnToLidMappings: [{ pn: 11111111111, latestLid: 22222222222 }]
					}).finish()
				}
			}
		}),
		pdoResponse: () => ({
			protocolMessage: {
				type: Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE,
				peerDataOperationRequestResponseMessage: {
					stanzaId: 'stanza-1',
					peerDataOperationResult: [
						{
							placeholderMessageResendResponse: {
								webMessageInfoBytes: proto.WebMessageInfo.encode({
									key: { id: 'injected-msg', remoteJid: 'x@s.whatsapp.net', fromMe: true },
									message: { conversation: 'spoofed' }
								}).finish()
							}
						}
					]
				}
			}
		}),
		securityNotificationSetting: (enabled: boolean) => ({
			protocolMessage: {
				type: Type.INITIAL_SECURITY_NOTIFICATION_SETTING_SYNC,
				initialSecurityNotificationSettingSync: { securityNotificationEnabled: enabled }
			}
		}),
		revoke: (targetId: string) => ({
			protocolMessage: { type: Type.REVOKE, key: { id: targetId } }
		}),
		messageEdit: (targetId: string) => ({
			protocolMessage: {
				type: Type.MESSAGE_EDIT,
				key: { id: targetId },
				editedMessage: { conversation: 'edited text' },
				timestampMs: 1700000001000
			}
		}),
		ephemeralSetting: (seconds: number) => ({
			protocolMessage: { type: Type.EPHEMERAL_SETTING, ephemeralExpiration: seconds }
		}),
		memberLabelChange: (label: string) => ({
			protocolMessage: { type: Type.GROUP_MEMBER_LABEL_CHANGE, memberLabel: { label } }
		}),
		reaction: (text: string) => ({
			reactionMessage: {
				key: { remoteJid: 'peer@s.whatsapp.net', fromMe: true, id: 'TARGET1' },
				text
			}
		}),
		wrap: (wrapper: string, inner: Any) => ({ [wrapper]: { message: inner } })
	}
}

/** Extract the array from one recorded event payload. */
export function payloads(events: Record<string, Any[]>, name: string): Any[] {
	return events[name] || []
}

export function includesKey(arr: Any[], needle: string): boolean {
	return JSON.stringify(arr).includes(needle)
}
