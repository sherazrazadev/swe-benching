/*
 * URLs built from a route pattern instead of a registered route name: the
 * caller supplies the pattern, but the values are still data.
 */
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/application/factories'
import { EncryptionFactory } from '@boringnode/encryption/factories'

import { RouterFactory } from '../../factories/router.ts'
import { URLBuilderFactory } from '../../factories/url_builder_factory.ts'
import { assertConfined } from './_support.ts'

const BASE_URL = new URL('./app/', import.meta.url)
const app = new AppFactory().create(BASE_URL, () => {})
const encryption = new EncryptionFactory().create()

function makeRouter() {
  return new RouterFactory().merge({ app, encryption }).create()
}

test.group('Pattern URLs', () => {
  test('makeUrl keeps a pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router.makeUrl('/:page', { page: '/evil.example.com' }, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 1 })
  })

  test('makeUrl keeps a backslash pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router.makeUrl('/users/:id', { id: '\\evil.example.com' }, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 2 })
  })

  test('makeUrl keeps query markers out of a pattern URL', ({ assert }) => {
    const router = makeRouter()
    const url = router.makeUrl('/users/:id', { id: '?role=admin#top' }, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 2 })
  })

  test('makeUrl keeps an optional pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router.makeUrl('/:page?', { page: '/evil.example.com' }, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 1 })
  })

  test('the legacy builder keeps a pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router
      .builder()
      .params({ page: '/evil.example.com' })
      .disableRouteLookup()
      .make('/:page')

    assertConfined(assert, url, { segments: 1 })
  })

  test('the legacy builder keeps a positional pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router.builder().params(['\\evil.example.com']).disableRouteLookup().make('/:page')

    assertConfined(assert, url, { segments: 1 })
  })

  test('a pattern wildcard element stays inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router.makeUrl('/*', { '*': ['/evil.example.com'] }, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 1 })
  })

  test('makeSignedUrl keeps a pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router.makeSignedUrl('/:page', { page: '/evil.example.com' }, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 1, params: ['signature'] })
  })

  test('the legacy builder keeps a signed pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const url = router
      .builder()
      .params({ page: '/evil.example.com' })
      .disableRouteLookup()
      .makeSigned('/:page')

    assertConfined(assert, url, { segments: 1, params: ['signature'] })
  })

  test('signedUrlFor keeps a pattern param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { signedUrlFor } = new URLBuilderFactory().merge({ router, encryption }).create()
    const url = signedUrlFor('/:page', { page: '/evil.example.com' } as any, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 1, params: ['signature'] })
  })

  test('signedUrlFor keeps query markers out of a pattern URL', ({ assert }) => {
    const router = makeRouter()
    const { signedUrlFor } = new URLBuilderFactory().merge({ router, encryption }).create()
    const url = signedUrlFor('/users/:id', { id: '?role=admin' } as any, {
      disableRouteLookup: true,
    } as any)

    assertConfined(assert, url, { segments: 2, params: ['signature'] })
  })
})
