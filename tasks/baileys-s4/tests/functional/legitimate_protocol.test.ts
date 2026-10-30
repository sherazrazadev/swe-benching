import { builders, openSocket } from '../support/harness'

const credUpdates = (events: Record<string, any[]>) => events['creds.update'] || []

describe('control messages other users are allowed to send are still applied', () => {
	test('a revoke from another user is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.revoke('ORIGINAL1'))
			const updates = h.events['messages.update'] || []
			expect(JSON.stringify(updates)).toContain('ORIGINAL1')
		} finally {
			await h.close()
		}
	})

	test('an edit from another user is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.messageEdit('ORIGINAL2'))
			const updates = h.events['messages.update'] || []
			expect(JSON.stringify(updates)).toContain('edited text')
		} finally {
			await h.close()
		}
	})

	test('a disappearing-setting change from another user is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.ephemeralSetting(86400))
			const updates = h.events['chats.update'] || []
			expect(JSON.stringify(updates)).toContain('86400')
		} finally {
			await h.close()
		}
	})

	test('a label change from another user is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.memberLabelChange('vip'), {
				remoteJid: '123456@g.us',
				participant: 'sender@s.whatsapp.net'
			})
			const updates = h.events['group.member-tag.update'] || []
			expect(JSON.stringify(updates)).toContain('vip')
		} finally {
			await h.close()
		}
	})

	test('a reaction from another user is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.reaction('nice'))
			expect(h.events['messages.reaction'].length).toBeGreaterThan(0)
		} finally {
			await h.close()
		}
	})
})

describe('control messages from the account own devices are still applied', () => {
	test('a history-sync notification from an own device is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.historyNotification(true).content, { fromMe: true })
			const status = JSON.stringify(h.events['messaging-history.status'])
			expect(status).toContain('complete')
			expect(h.events['messaging-history.set'].length).toBeGreaterThan(0)
			expect(credUpdates(h.events).filter(u => u && u.processedHistoryMessages).length).toBeGreaterThan(0)
		} finally {
			await h.close()
		}
	})

	test('an app-state key share from an own device is stored', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.appStateKeyShare(), { fromMe: true })
			expect(h.keyWrites.length).toBeGreaterThan(0)
			expect(credUpdates(h.events).filter(u => u && u.myAppStateKeyId).length).toBeGreaterThan(0)
		} finally {
			await h.close()
		}
	})

	test('an identity-mapping sync from an own device is stored and migrated', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.lidMigrationSync(), { fromMe: true })
			expect(h.lidCalls.length).toBeGreaterThan(0)
		} finally {
			await h.close()
		}
	})

	test('a requested-message response from an own device is re-injected', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.pdoResponse(), { fromMe: true })
			expect(JSON.stringify(h.events['messages.upsert'])).toContain('injected-msg')
		} finally {
			await h.close()
		}
	})

	test('an account-setting sync from an own device is applied', async () => {
		const b = await builders()
		const h = await openSocket()
		try {
			await h.deliver(b.securityNotificationSetting(false), { fromMe: true })
			const changes = credUpdates(h.events).filter(
				u => u && u.accountSettings && u.accountSettings.securityNotifications === false
			)
			expect(changes.length).toBeGreaterThan(0)
		} finally {
			await h.close()
		}
	})
})
