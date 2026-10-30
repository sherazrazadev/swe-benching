/*
 * Declarative redirects to a route pattern: the handler forwards the request
 * params (or the ones the caller supplies) into the pattern.
 */
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/application/factories'
import { EncryptionFactory } from '@boringnode/encryption/factories'

import { RouterFactory } from '../../factories/router.ts'
import { HttpResponseFactory } from '../../factories/response.ts'
import { assertConfined } from './_support.ts'

const BASE_URL = new URL('./app/', import.meta.url)
const app = new AppFactory().create(BASE_URL, () => {})
const encryption = new EncryptionFactory().create()

function makeRouter() {
  return new RouterFactory().merge({ app, encryption }).create()
}

function runHandler(router: any, handler: any, params: Record<string, any>) {
  const response = new HttpResponseFactory().merge({ encryption, router }).create()
  handler({ response, params } as any)
  return response.getHeader('location') as string
}

test.group('Declarative pattern redirects', () => {
  test('a request param cannot change the redirect host', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/:page').redirectToPattern('/:page')

    const location = runHandler(router, route.toJSON().handler, { page: '/evil.example.com' })
    assertConfined(assert, location, { segments: 1 })
  })

  test('a request param cannot add a backslash redirect', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/:page').redirectToPattern('/:page')

    const location = runHandler(router, route.toJSON().handler, { page: '\\evil.example.com' })
    assertConfined(assert, location, { segments: 1 })
  })

  test('a request param cannot add a query string to the redirect', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/:page').redirectToPattern('/:page')

    const location = runHandler(router, route.toJSON().handler, { page: '?admin=true#top' })
    assertConfined(assert, location, { segments: 1 })
  })

  test('caller supplied params stay inside their segment', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy').redirectToPattern('/:page', {
      page: '/evil.example.com',
    })

    const location = runHandler(router, route.toJSON().handler, {})
    assertConfined(assert, location, { segments: 1 })
  })

  test('a prefixed pattern keeps its segments', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/:id').redirectToPattern('/users/:id')

    const location = runHandler(router, route.toJSON().handler, { id: '/evil' })
    assertConfined(assert, location, { segments: 2 })
  })

  test('a wildcard pattern keeps each element inside its segment', ({ assert }) => {
    const router = makeRouter()
    const route = router.on('/legacy/*').redirectToPattern('/*')

    const location = runHandler(router, route.toJSON().handler, { '*': ['/evil.example.com'] })
    assertConfined(assert, location, { segments: 1 })
  })
})
