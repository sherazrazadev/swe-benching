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

class StoreDomainSecurityTest {

    @Test
    fun `a response cannot place its cookie on an unrelated domain`() {
        val handler: HttpHandler = { request ->
            when (request.uri.host) {
                "a.example" -> Response(OK).cookie(Cookie("sid", Markers.A, domain = "victim.example"))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://a.example/set"))

        assertEquals("", client(Request(GET, "http://victim.example/get")).bodyString(),
            "a.example must not be able to grant a cookie to victim.example")
    }

    @Test
    fun `a domain suffix that only looks similar is not accepted`() {
        val handler: HttpHandler = { request ->
            when (request.uri.host) {
                "notevil.example" -> Response(OK).cookie(Cookie("sid", Markers.A, domain = "evil.example"))
                else -> Response(OK).body(request.cookieValue("sid") ?: "")
            }
        }
        val client = ClientFilters.Cookies().then(handler)
        client(Request(GET, "http://notevil.example/set"))

        assertEquals("", client(Request(GET, "http://evil.example/get")).bodyString(),
            "notevil.example must not be able to grant a cookie to evil.example")
    }
}
