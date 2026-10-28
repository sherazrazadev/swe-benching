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

class ClientApiFunctionalTest {

    private val handler: HttpHandler = { request ->
        when (request.uri.path) {
            "/set" -> Response(OK).cookie(Cookie("sid", Markers.A))
            else -> Response(OK).body(request.cookieValue("sid") ?: "")
        }
    }

    @Test
    fun `the default client construction round trips a cookie`() {
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/set"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/get")).bodyString())
    }

    @Test
    fun `a caller supplied clock construction still works`() {
        val clock = MutableClock(Instant.ofEpochMilli(0))
        val client = ClientFilters.Cookies(clock).then(handler)
        client(Request(GET, "http://a.example/set"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/get")).bodyString())
    }

    @Test
    fun `a caller supplied time source construction still works`() {
        val clock = MutableClock(Instant.ofEpochMilli(0))
        val client = ClientFilters.Cookies({ clock.instant() }).then(handler)
        client(Request(GET, "http://a.example/set"))

        assertEquals(Markers.A, client(Request(GET, "http://a.example/get")).bodyString())
    }
}
