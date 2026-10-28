package hidden.security

import hidden.support.Markers
import hidden.support.cookieValue
import org.http4k.core.HttpHandler
import org.http4k.core.Response
import org.http4k.core.Status.Companion.OK
import org.http4k.core.cookie.Cookie
import org.http4k.core.cookie.cookie
import org.http4k.webdriver.Http4kWebDriver
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.openqa.selenium.Cookie as SeleniumCookie

class WebDriverCookieSecurityTest {

    @Test
    fun `the in process browser does not send a stored cookie to another origin`() {
        val seen = mutableListOf<String?>()
        val handler: HttpHandler = { request ->
            if (request.uri.path == "/set") {
                Response(OK).cookie(Cookie("sid", Markers.A, path = "/"))
            } else {
                seen += request.cookieValue("sid")
                Response(OK)
            }
        }
        val driver = Http4kWebDriver(handler)

        driver.get("http://a.example/set")
        driver.get("http://b.example/get")

        assertEquals(listOf<String?>(null), seen,
            "a cookie stored while on a.example must not be sent to b.example")
    }

    @Test
    fun `a cookie added through the browser API is not sent to another origin`() {
        val seen = mutableListOf<String?>()
        val handler: HttpHandler = { request ->
            seen += request.cookieValue("sid")
            Response(OK)
        }
        val driver = Http4kWebDriver(handler)

        driver.get("http://a.example/home")
        driver.manage().addCookie(SeleniumCookie("sid", Markers.A))
        driver.get("http://b.example/get")

        assertEquals(listOf<String?>(null, null), seen,
            "a cookie added while on a.example must not be sent to b.example")
    }
}
