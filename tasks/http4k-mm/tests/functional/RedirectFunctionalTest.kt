package hidden.functional

import hidden.support.Markers
import hidden.support.cookieValue
import org.http4k.core.HttpHandler
import org.http4k.core.Method.GET
import org.http4k.core.Request
import org.http4k.core.Response
import org.http4k.core.Status.Companion.OK
import org.http4k.core.Status.Companion.SEE_OTHER
import org.http4k.core.cookie.Cookie
import org.http4k.core.cookie.cookie
import org.http4k.core.then
import org.http4k.filter.ClientFilters
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class RedirectFunctionalTest {

    @Test
    fun `a same origin redirect keeps the cookie`() {
        val seen = mutableListOf<String?>()
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/login" -> Response(OK).cookie(Cookie("sid", Markers.A, path = "/"))
                "/start" -> Response(SEE_OTHER).header("Location", "http://a.example/final")
                else -> {
                    seen += request.cookieValue("sid")
                    Response(OK)
                }
            }
        }
        val client = ClientFilters.Cookies().then(ClientFilters.FollowRedirects()).then(handler)

        client(Request(GET, "http://a.example/login"))
        client(Request(GET, "http://a.example/start"))

        assertEquals(listOf<String?>(Markers.A), seen,
            "a same origin redirect must still carry the cookie")
    }

    @Test
    fun `a redirect is still followed and its response returned`() {
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/jump" -> Response(SEE_OTHER).header("Location", "http://a.example/landing")
                else -> Response(OK).body("landed")
            }
        }
        val client = ClientFilters.Cookies().then(ClientFilters.FollowRedirects()).then(handler)

        assertEquals("landed", client(Request(GET, "http://a.example/jump")).bodyString())
    }
}
