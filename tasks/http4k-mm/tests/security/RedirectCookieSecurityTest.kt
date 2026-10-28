package hidden.security

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

class RedirectCookieSecurityTest {

    @Test
    fun `a cookie is not forwarded to a different origin when a redirect is followed`() {
        val seen = mutableListOf<String?>()
        val handler: HttpHandler = { request ->
            when {
                request.uri.host == "a.example" && request.uri.path == "/login" ->
                    Response(OK).cookie(Cookie("sid", Markers.A, path = "/"))
                request.uri.host == "a.example" && request.uri.path == "/start" ->
                    Response(SEE_OTHER).header("Location", "http://b.example/next")
                request.uri.host == "b.example" -> {
                    seen += request.cookieValue("sid")
                    Response(OK)
                }
                else -> Response(OK)
            }
        }
        val client = ClientFilters.Cookies().then(ClientFilters.FollowRedirects()).then(handler)

        client(Request(GET, "http://a.example/login"))
        client(Request(GET, "http://a.example/start"))

        assertEquals(listOf<String?>(null), seen,
            "a.example's cookie must not be forwarded to b.example by the redirect")
    }
}
