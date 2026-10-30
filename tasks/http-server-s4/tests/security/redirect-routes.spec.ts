/*
 * Redirects to routes: the value a caller (or a request) supplies for a route
 * parameter must never decide where the browser is sent.
 */
import supertest from 'supertest'
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/application/factories'
import { EncryptionFactory } from '@boringnode/encryption/factories'

import { RouterFactory } from '../../factories/router.ts'
import { httpServer } from '../../factories/http_server.ts'
import { HttpResponseFactory } from '../../factories/response.ts'
import { APP_ORIGIN, assertConfined } from './_support.ts'

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

function makeWildcardRouter() {
  const router = new RouterFactory().merge({ app, encryption }).create()
  router.get('/*', 'FilesController.show').as('files.show')
  router.commit()
  return router
}

test.group('Redirect routes', () => {
  test('a query supplied page cannot change the redirect host', async ({ assert }) => {
    const router = makeRouter()
    const { url } = await httpServer.create((req, res) => {
      const response = new HttpResponseFactory().merge({ req, res, encryption, router }).create()
      const next = new URL(req.url!, 'http://localhost').searchParams.get('next') || ''
      // @ts-expect-error "Because RoutesList is empty"
      response.redirect().toRoute('pages.show', { page: next })
      response.finish()
    })

    const response = await supertest(url).get('/login?next=%2Fevil.example.com').redirects(0)
    assertConfined(assert, response.headers.location, { segments: 1 }, url)
  })

  test('a query supplied backslash cannot change the redirect host', async ({ assert }) => {
    const router = makeRouter()
    const { url } = await httpServer.create((req, res) => {
      const response = new HttpResponseFactory().merge({ req, res, encryption, router }).create()
      const next = new URL(req.url!, 'http://localhost').searchParams.get('next') || ''
      // @ts-expect-error "Because RoutesList is empty"
      response.redirect().toRoute('pages.show', { page: next })
      response.finish()
    })

    const response = await supertest(url).get('/login?next=%5Cevil.example.com').redirects(0)
    assertConfined(assert, response.headers.location, { segments: 1 }, url)
  })

  test('a query supplied page cannot add a query string to the redirect', async ({ assert }) => {
    const router = makeRouter()
    const { url } = await httpServer.create((req, res) => {
      const response = new HttpResponseFactory().merge({ req, res, encryption, router }).create()
      const next = new URL(req.url!, 'http://localhost').searchParams.get('next') || ''
      // @ts-expect-error "Because RoutesList is empty"
      response.redirect().toRoute('pages.show', { page: next })
      response.finish()
    })

    const response = await supertest(url)
      .get('/login?next=' + encodeURIComponent('?admin=true#top'))
      .redirects(0)
    assertConfined(assert, response.headers.location, { segments: 1 }, url)
  })

  test('a query supplied id cannot add path segments to a prefixed redirect', async ({ assert }) => {
    const router = makeRouter()
    const { url } = await httpServer.create((req, res) => {
      const response = new HttpResponseFactory().merge({ req, res, encryption, router }).create()
      const id = new URL(req.url!, 'http://localhost').searchParams.get('id') || ''
      // @ts-expect-error "Because RoutesList is empty"
      response.redirect().toRoute('users.show', { id })
      response.finish()
    })

    const response = await supertest(url).get('/go?id=' + encodeURIComponent('/evil')).redirects(0)
    assertConfined(assert, response.headers.location, { segments: 2 }, url)
  })

  test('toRoute keeps an unsafe optional param inside its segment', async ({ assert }) => {
    const router = makeRouter()
    const response = new HttpResponseFactory().merge({ encryption, router }).create()

    // @ts-expect-error "Because RoutesList is empty"
    response.redirect().toRoute('pages.optional', { page: '/evil.example.com' })
    assertConfined(assert, response.getHeader('location') as string, { segments: 1 })
  })

  test('toRoute keeps an unsafe named param inside its segment', async ({ assert }) => {
    const router = makeRouter()
    const response = new HttpResponseFactory().merge({ encryption, router }).create()

    // @ts-expect-error "Because RoutesList is empty"
    response.redirect().toRoute('users.show', { id: '/evil.example.com?x=1' })
    assertConfined(assert, response.getHeader('location') as string, { segments: 2 })
  })

  test('a wildcard redirect target stays inside its segments', async ({ assert }) => {
    const router = makeWildcardRouter()
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

  test('a redirect with a prefix keeps the prefix origin', async ({ assert }) => {
    const router = makeRouter()
    const { url } = await httpServer.create((req, res) => {
      const response = new HttpResponseFactory().merge({ req, res, encryption, router }).create()
      const next = new URL(req.url!, 'http://localhost').searchParams.get('next') || ''
      // @ts-expect-error "Because RoutesList is empty"
      response.redirect().toRoute('pages.show', { page: next }, { prefixUrl: APP_ORIGIN })
      response.finish()
    })

    const response = await supertest(url).get('/login?next=%2Fevil.example.com').redirects(0)
    assertConfined(assert, response.headers.location, { segments: 1 }, APP_ORIGIN)
  })
})
