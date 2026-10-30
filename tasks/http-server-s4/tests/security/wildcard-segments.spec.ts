/*
 * Wildcard params are given as a list: each element fills one segment and is
 * itself data.
 */
import supertest from 'supertest'
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/application/factories'
import { EncryptionFactory } from '@boringnode/encryption/factories'

import { RouterFactory } from '../../factories/router.ts'
import { httpServer } from '../../factories/http_server.ts'
import { HttpResponseFactory } from '../../factories/response.ts'
import { URLBuilderFactory } from '../../factories/url_builder_factory.ts'
import { assertConfined } from './_support.ts'

const BASE_URL = new URL('./app/', import.meta.url)
const app = new AppFactory().create(BASE_URL, () => {})
const encryption = new EncryptionFactory().create()

function makeRouter() {
  const router = new RouterFactory().merge({ app, encryption }).create()
  router.get('/*', 'FilesController.show').as('files.show')
  router.get('/download/*', 'FilesController.download').as('files.download')
  router.commit()
  return router
}

test.group('Wildcard params', () => {
  test('an object wildcard element cannot change the host', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('files.show', { '*': ['/evil.example.com'] } as any), {
      segments: 1,
    })
  })

  test('a positional wildcard element cannot change the host', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('files.show', ['\\evil.example.com'] as any), { segments: 1 })
  })

  test('a wildcard element cannot add a query or fragment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('files.download', { '*': ['?admin=true#top'] } as any), {
      segments: 2,
    })
  })

  test('a wildcard element cannot add a path segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('files.download', { '*': ['nested/file'] } as any), {
      segments: 2,
    })
  })

  test('the first element of a wildcard list cannot change the host', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor('files.show', { '*': ['/evil.example.com', 'x'] } as any), {
      segments: 2,
    })
  })

  test('a method builder keeps the wildcard element inside its segment', ({ assert }) => {
    const router = makeRouter()
    const { urlFor } = new URLBuilderFactory().merge({ router, encryption }).create()

    assertConfined(assert, urlFor.get('files.download', { '*': ['/evil'] } as any).url, {
      segments: 2,
    })
  })

  test('a redirect to a wildcard route keeps each element inside its segment', async ({
    assert,
  }) => {
    const router = makeRouter()
    const { url } = await httpServer.create((req, res) => {
      const response = new HttpResponseFactory().merge({ req, res, encryption, router }).create()
      const next = new URL(req.url!, 'http://localhost').searchParams.get('next') || ''
      // @ts-expect-error "Because RoutesList is empty"
      response.redirect().toRoute('files.show', { '*': [next] })
      response.finish()
    })

    const response = await supertest(url).get('/go?next=%2Fevil.example.com').redirects(0)
    assertConfined(assert, response.headers.location, { segments: 1 }, url)
  })
})
