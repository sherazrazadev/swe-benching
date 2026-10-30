import { builders, openSocket } from '../support/harness'

const credUpdates = (events: Record<string, any[]>) => events['creds.update'] || []

describe('control messages sent by another user never change local state', () => {
	test('a history-sync notification from another user is not applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.historyNotification(false).content)
			expect(h.events['messaging-history.status']).toEqual([])
			expect(h.events['messaging-history.set']).toEqual([])
			expect(credUpdates(h.events).filter(u => u && u.processedHistoryMessages)).toEqual([])
		} finally {
			await h.close()
		}
	})

	test('an app-state sync key share from another user is not stored', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.appStateKeyShare())
			expect(h.keyWrites).toEqual([])
			expect(credUpdates(h.events).filter(u => u && u.myAppStateKeyId)).toEqual([])
		} finally {
			await h.close()
		}
	})

	test('an identity-mapping sync from another user is not stored or migrated', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.lidMigrationSync())
			expect(h.lidCalls).toEqual([])
		} finally {
			await h.close()
		}
	})

	test('a requested-message response from another user is not re-injected', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.pdoResponse())
			// The ordinary upsert of the received message is expected; the attacker-chosen
			// message carried inside the response must never be added to the message store.
			expect(JSON.stringify(h.events['messages.upsert'])).not.toContain('injected-msg')
		} finally {
			await h.close()
		}
	})

	test('an account-setting sync from another user does not change stored settings', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.securityNotificationSetting(false))
			const settingsChanges = credUpdates(h.events).filter(
				u => u && u.accountSettings && u.accountSettings.securityNotifications === false
			)
			expect(settingsChanges).toEqual([])
		} finally {
			await h.close()
		}
	})

	test.each(['ephemeralMessage', 'viewOnceMessage', 'documentWithCaptionMessage', 'editedMessage'])(
		'a key share wrapped in %s is not stored',
		async wrapper => {
			const b = await builders()
			const h = await openSocket()
			try {
				await h.deliver(b.wrap(wrapper, b.appStateKeyShare()) as any)
				expect(h.keyWrites).toEqual([])
			} finally {
				await h.close()
			}
		}
	)

	test.each(['ephemeralMessage', 'viewOnceMessageV2', 'groupStatusMessage'])(
		'a history-sync notification wrapped in %s is not applied',
		async wrapper => {
			const b = await builders()
			const h = await openSocket()
			try {
				await h.deliver(b.wrap(wrapper, b.historyNotification(false).content) as any)
				expect(h.events['messaging-history.status']).toEqual([])
				expect(h.events['messaging-history.set']).toEqual([])
			} finally {
				await h.close()
			}
		}
	)
})
