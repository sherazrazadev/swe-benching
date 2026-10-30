/*
 * Every URL-building entry point of the package: a route parameter value is
 * data, and must never add path, query or fragment structure to the URL.
 */
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/application/factories'
import { EncryptionFactory } from '@boringnode/encryption/factories'

import { RouterFactory } from '../../factories/router.ts'
import { URLBuilderFactory } from '../../factories/url_builder_factory.ts'
import { parseRoute, createURL, createSignedURL } from '../../src/helpers.ts'
import { createURL as clientCreateURL } from '../../src/client/url_builder.ts'
import { assertConfined } from './_support.ts'

const BASE_URL = new URL('./app/', import.meta.url)
const app = new AppFactory().create(BASE_URL, () => {})
const encryption = new EncryptionFactory().create()

function makeRouter() {
  const router = new RouterFactory().merge({ app, encryption }).create()
  router.get('/:page', 'PagesController.show').as('pages.show')
  router.get('/users/:id', 'UsersController.show').as('users.show')
  router.get('/:page?', 'PagesController.optional').as('pages.optional')
  router.commit()
  return router
}

function makeDomainRouter() {
  const router = new RouterFactory().merge({ app, encryption }).create()
  router.get('/posts/:id', 'PostsController.show').as('posts.show').domain('blog.adonisjs.com')
  router.commit()
  return router
}

const stringify = (params: Record<string, any>) => new URLSearchParams(params).toString()

test.group('URL builder', () => {
  test('urlFor keeps a named param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('pages.show', { page: '/evil.example.com' } as any), { segments: 1 })
  })

  test('urlFor keeps query and fragment markers inside the segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('pages.show', { page: '?admin=true#top' } as any), { segments: 1 })
  })

  test('urlFor keeps a backslash inside the segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('pages.show', { page: '\\evil.example.com' } as any), { segments: 1 })
  })

  test('urlFor keeps an optional param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('pages.optional', { page: '/evil.example.com' } as any), {
      segments: 1,
    })
  })

  test('urlFor keeps a positional param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('users.show', ['/evil.example.com'] as any), { segments: 2 })
  })

  test('method builders keep the value inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor.get('pages.show', { page: '/evil.example.com' } as any).url, {
      segments: 1,
    })
    assertConfined(assert, urlFor.method('GET', 'pages.show', { page: '\\evil.example.com' } as any).url, {
      segments: 1,
    })
  })

  test('the prefix is not lost and the value does not escape it', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(
      assert,
      urlFor('pages.show', { page: '/evil.example.com' } as any, {
        prefixUrl: 'https://app.test',
      }),
      { origin: 'https://app.test', segments: 1 }
    )
  })

  test('makeUrl keeps a named param inside its segment', ({ assert }) => {
    const router = makeRouter()

    assertConfined(assert, router.makeUrl('pages.show', { page: '/evil.example.com' }), {
      segments: 1,
    })
  })

  test('makeUrl keeps a query marker out of the URL', ({ assert }) => {
    const router = makeRouter()

    assertConfined(assert, router.makeUrl('users.show', { id: '?role=admin' }), { segments: 2 })
  })

  test('makeSignedUrl keeps a named param inside its segment', ({ assert }) => {
    const router = makeRouter()

    assertConfined(assert, router.makeSignedUrl('pages.show', { page: '/evil.example.com' }), {
      segments: 1,
      params: ['signature'],
    })
  })

  test('the legacy builder keeps a named param inside its segment', ({ assert }) => {
    const router = makeRouter()

    assertConfined(assert, router.builder().params({ page: '\\evil.example.com' }).make('pages.show'), {
      segments: 1,
    })
  })

  test('the domain builder keeps a named param inside its segment', ({ assert }) => {
    const router = makeDomainRouter()

    assertConfined(
      assert,
      router.builderForDomain('blog.adonisjs.com').params({ id: '/evil' }).make('posts.show'),
      { segments: 2 }
    )
  })

  test('the signed url builder keeps a named param inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { signedUrlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, signedUrlFor('pages.show', { page: '/evil.example.com' } as any), {
      segments: 1,
      params: ['signature'],
    })
  })

  test('the lower level createURL keeps the value inside its segment', ({ assert }) => {
    assertConfined(
      assert,
      createURL('/:page', parseRoute('/:page'), stringify, { page: '\\evil.example.com' }),
      { segments: 1 }
    )
  })

  test('the lower level createSignedURL keeps the value inside its segment', ({ assert }) => {
    assertConfined(
      assert,
      createSignedURL('/:page', parseRoute('/:page'), stringify, encryption, {
        page: '/evil.example.com',
      }),
      { segments: 1, params: ['signature'] }
    )
  })

  test('the client builder keeps the value inside its segment', ({ assert }) => {
    assertConfined(
      assert,
      clientCreateURL(
        '/:page',
        parseRoute('/:page'),
        stringify,
        { page: '/evil.example.com' },
        undefined
      ),
      { segments: 1 }
    )
  })
})
