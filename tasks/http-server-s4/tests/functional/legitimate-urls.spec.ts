/*
 * Legitimate URL generation keeps producing exactly the URLs it produced
 * before: plain values, optional params, multi segment wildcard lists,
 * prefixes, query strings, signed URLs and declarative redirects.
 */
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/application/factories'
import { EncryptionFactory } from '@boringnode/encryption/factories'

import { RouterFactory } from '../../factories/router.ts'
import { UrlBuilder } from '../../src/router/legacy/url_builder.ts'
import { URLBuilderFactory } from '../../factories/url_builder_factory.ts'
import { HttpResponseFactory } from '../../factories/response.ts'
import { HttpRequestFactory } from '../../factories/request.ts'

const BASE_URL = new URL('./app/', import.meta.url)
const app = new AppFactory().create(BASE_URL, () => {})
const encryption = new EncryptionFactory().create()

function makeRouter() {
  const router = new RouterFactory().merge({ app, encryption }).create()
  router.get('/users/:id', 'UsersController.show').as('users.show')
  router.get('/users/:id?', 'UsersController.optional').as('users.optional')
  router.get('/files/*', 'FilesController.show').as('files.show')
  router.get('/health', 'HealthController.show').as('health')
  router.commit()
  return router
}

function makeDomainRouter() {
  const router = new RouterFactory().merge({ app, encryption }).create()
  router.get('/posts/:id', 'PostsController.show').as('posts.show').domain('blog.adonisjs.com')
  router.commit()
  return router
}

test.group('Legitimate URLs', () => {
  test('builds the same URL for a plain param', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assert.equal(urlFor('users.show', { id: '42' } as any), '/users/42')
    assert.equal(urlFor('users.show', ['abc-def'] as any), '/users/abc-def')
    assert.equal(urlFor('users.show', { id: 'invoice.pdf' } as any), '/users/invoice.pdf')
  })

  test('builds the same URL for an omitted optional param', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assert.equal(urlFor('users.optional' as any), '/users')
    assert.equal(urlFor('users.optional', { id: '1' } as any), '/users/1')
  })

  test('keeps a multi segment wildcard list', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assert.equal(urlFor('files.show', { '*': ['1', '2', '3'] } as any), '/files/1/2/3')
    assert.equal(urlFor('files.show', ['reports', '2026', 'q1.pdf'] as any), '/files/reports/2026/q1.pdf')
  })

  test('keeps the prefix url untouched', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assert.equal(
      urlFor('users.show', { id: '42' } as any, { prefixUrl: 'https://adonisjs.com' }),
      'https://adonisjs.com/users/42'
    )
    assert.equal(urlFor('health', undefined, { prefixUrl: 'https://adonisjs.com/' }), 'https://adonisjs.com/health')
  })

  test('keeps the query string untouched', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assert.equal(
      urlFor('users.show', { id: '42' } as any, {
        qs: { sort: 'id', fields: ['username', 'email'] },
      }),
      '/users/42?sort=id&fields%5B0%5D=username&fields%5B1%5D=email'
    )
  })

  test('keeps method builders and their form action', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()
    const get = urlFor.get('users.show', { id: '42' } as any)

    assert.equal(get.url, '/users/42')
    assert.equal(get.form.action, '/users/42')
    assert.equal(get.method, 'GET')
    assert.equal(`${get}`, '/users/42')
  })

  test('keeps makeUrl for names and patterns', ({ assert }) => {
    const router = makeRouter()

    assert.equal(router.makeUrl('users.show', { id: '42' }), '/users/42')
    assert.equal(router.makeUrl('/users/:id', { id: '42' }, { disableRouteLookup: true } as any), '/users/42')
    assert.equal(router.makeUrl('/files/*', ['1', '2'] as any, { disableRouteLookup: true } as any), '/files/1/2')
    assert.equal(
      router.makeUrl('/users/:id', { id: '42' }, {
        disableRouteLookup: true,
        prefixUrl: 'https://adonisjs.com',
        qs: { page: 1 },
      } as any),
      'https://adonisjs.com/users/42?page=1'
    )
  })

  test('keeps the legacy builder', ({ assert }) => {
    const router = makeRouter()
    const builder = new UrlBuilder(router)
      .params({ id: '42' })
      .disableRouteLookup()
      .prefixUrl('https://adonisjs.com')
      .qs({ page: 1 })

    assert.equal(builder.make('/users/:id'), 'https://adonisjs.com/users/42?page=1')
    assert.equal(router.builder().params(['42']).make('users.show'), '/users/42')
  })

  test('keeps the domain builder', ({ assert }) => {
    const router = makeDomainRouter()

    assert.equal(
      router.builderForDomain('blog.adonisjs.com').params({ id: '42' }).make('posts.show'),
      '/posts/42'
    )
  })

  test('signed URLs still verify', ({ assert }) => {
    const router = makeRouter()
    const { signedUrlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    const signed = signedUrlFor('users.show', { id: '42' } as any)
    const request = new HttpRequestFactory().merge({ encryption, url: signed }).create()
    assert.isTrue(request.hasValidSignature())

    const patternSigned = signedUrlFor('/users/:id', { id: '42' } as any, {
      disableRouteLookup: true,
    } as any)
    const patternRequest = new HttpRequestFactory().merge({ encryption, url: patternSigned }).create()
    assert.isTrue(patternRequest.hasValidSignature())
  })

  test('signed URLs keep their prefix and query string', ({ assert }) => {
    const router = makeRouter()
    const { signedUrlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    const signed = signedUrlFor('/files/:key', { key: 'invoice.pdf' } as any, {
      disableRouteLookup: true,
      prefixUrl: 'http://localhost:4000',
      qs: { download: true },
    } as any)

    const url = new URL(signed)
    assert.equal(url.origin, 'http://localhost:4000')
    assert.equal(url.pathname, '/files/invoice.pdf')
    assert.equal(url.searchParams.get('download'), 'true')
  })

  test('redirects to a route with a plain param', ({ assert }) => {
    const router = makeRouter()
    const response = new HttpResponseFactory().merge({ encryption, router }).create()

    // @ts-expect-error "Because RoutesList is empty"
    response.redirect().toRoute('users.show', { id: '42' })
    assert.equal(response.getHeader('location'), '/users/42')
  })

  test('redirects with an optional param omitted', ({ assert }) => {
    const router = makeRouter()
    const response = new HttpResponseFactory().merge({ encryption, router }).create()

    // @ts-expect-error "Because RoutesList is empty"
    response.redirect().toRoute('users.optional')
    assert.equal(response.getHeader('location'), '/users')
  })

  test('declarative pattern redirects keep plain params', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/:id').redirectToPattern('/users/:id')
    const response = new HttpResponseFactory().merge({ encryption, router }).create()

    route.toJSON().handler({ response, params: { id: '42' } } as any, {} as any)
    assert.equal(response.getHeader('location'), '/users/42')
  })

  test('declarative pattern redirects keep multi segment wildcards', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/*').redirectToPattern('/files/*')
    const response = new HttpResponseFactory().merge({ encryption, router }).create()

    route.toJSON().handler({ response, params: { '*': ['1', '2', '3'] } } as any, {} as any)
    assert.equal(response.getHeader('location'), '/files/1/2/3')
  })
})
