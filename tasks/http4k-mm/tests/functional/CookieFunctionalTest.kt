package hidden.functional

import hidden.support.Markers
import hidden.support.MutableClock
import hidden.support.cookieValue
import org.http4k.core.HttpHandler
import org.http4k.core.Method.GET
import org.http4k.core.Request
import org.http4k.core.Response
import org.http4k.core.Status.Companion.OK
import org.http4k.core.cookie.Cookie
import org.http4k.core.cookie.cookie
import org.http4k.core.then
import org.http4k.filter.ClientFilters
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.Instant

class CookieFunctionalTest {

    @Test
    fun `a client with relative uris round trips a cookie`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "/set"))

        assertEquals(Markers.A, client(Request(GET, "/get")).bodyString(),
            "a host-less request must still receive a cookie set by an earlier host-less request")
    }

    @Test
    fun `a domain cookie reaches the subdomains of its domain`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A, domain = ".Example.COM"))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example.com/set"))

        assertEquals(Markers.A, client(Request(GET, "http://b.example.com/get")).bodyString(),
            "a Domain attribute must still cover subdomains")
    }

    @Test
    fun `a path attribute matches its subtree`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/api/set" -> Response(OK).cookie(Cookie("sid", Markers.A, path = "/api"))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/api/set"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/api")).bodyString(),
            "a cookie for /api must match /api itself")
        assertEquals(Markers.A, client(Request(GET, "http://a.example/api/users")).bodyString(),
            "a cookie for /api must match its subtree")
    }

    @Test
    fun `a cookie without a path covers its sibling resources`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/a/b/c" -> Response(OK).cookie(Cookie("sid", Markers.A))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/a/b/c"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/a/b/d")).bodyString(),
            "a cookie set below /a/b must still cover sibling resources below /a/b")
    }

    @Test
    fun `a secure cookie is sent over https`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A, secure = true))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "https://a.example/set"))

        assertEquals(Markers.A, client(Request(GET, "https://a.example/get")).bodyString(),
            "a secure cookie must still be sent over https")
    }

    @Test
    fun `an expired cookie is removed and not sent`() {
        val clock = MutableClock(Instant.ofEpochMilli(0))
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A, maxAge = 5))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies(clock).then(handler)
        client(Request(GET, "http://a.example/set"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/get")).bodyString(),
            "a live cookie must be sent")
        clock.advanceSeconds(10)
        assertEquals("", client(Request(GET, "http://a.example/get")).bodyString(),
            "an expired cookie must not be sent")
    }

    @Test
    fun `each origin keeps its own cookies`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set-a" -> Response(OK).cookie(Cookie("a-cookie", Markers.A))
                "/set-b" -> Response(OK).cookie(Cookie("b-cookie", Markers.B))
                else -> Response(OK).body(
                    if (request.uri.host.startsWith("a.")) {
                        request.cookieValue("a-cookie") ?: ""
                    } else {
                        request.cookieValue("b-cookie") ?: ""
                    }
                )
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/set-a"))
        client(Request(GET, "http://b.example/set-b"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/get")).bodyString(),
            "a.example must still receive the cookie it set")
        assertEquals(Markers.B, client(Request(GET, "http://b.example/get")).bodyString(),
            "b.example must still receive the cookie it set")
    }

    @Test
    fun `a request carrying no cookie still reaches the handler`() {
        val handler: HttpHandler = { request ->
            Response(OK).body(request.cookieValue("sid") ?: "no-cookie")
        }
        val client = ClientFilters.Cookies().then(handler)

        assertEquals("no-cookie", client(Request(GET, "http://a.example/any")).bodyString())
    }
}
