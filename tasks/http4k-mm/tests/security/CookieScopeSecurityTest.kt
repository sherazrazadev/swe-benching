package hidden.security

import hidden.support.Markers
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

class CookieScopeSecurityTest {

    private fun valueSeen(handler: HttpHandler, url: String): String =
        handler(Request(GET, url)).bodyString()

    @Test
    fun `a host only cookie is not sent to a different host`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/set"))

        assertEquals(Markers.A, valueSeen(client, "http://a.example/get"),
            "the setting host must still receive its own cookie")
        assertEquals("", valueSeen(client, "http://b.example/get"),
            "a cookie set by a.example must never reach b.example")
    }

    @Test
    fun `a path scoped cookie is not sent outside its path`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/api/set" -> Response(OK).cookie(Cookie("sid", Markers.A, path = "/api"))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/api/set"))

        assertEquals("", valueSeen(client, "http://a.example/apiv2"),
            "a cookie for /api must not match /apiv2 (no label boundary)")
    }

    @Test
    fun `a cookie without a path uses the default path of the request that set it`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/a/b/c" -> Response(OK).cookie(Cookie("sid", Markers.A))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/a/b/c"))

        assertEquals("", valueSeen(client, "http://a.example/other"),
            "a cookie set below /a/b must not be sent to /other")
    }

    @Test
    fun `a secure cookie is not sent over plain http`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A, secure = true))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "https://a.example/set"))

        assertEquals("", valueSeen(client, "http://a.example/get"),
            "a secure cookie must not be sent over http")
    }

    @Test
    fun `cookies of the same name from two hosts stay separate`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set-a" -> Response(OK).cookie(Cookie("sid", Markers.A))
                "/set-b" -> Response(OK).cookie(Cookie("sid", Markers.B))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/set-a"))
        client(Request(GET, "http://b.example/set-b"))

        assertEquals(Markers.A, valueSeen(client, "http://a.example/get"),
            "b.example's cookie must not replace a.example's cookie")
        assertEquals(Markers.B, valueSeen(client, "http://b.example/get"),
            "b.example must keep its own cookie")
    }
}
