package hidden.functional

import hidden.support.Markers
import hidden.support.cookieValue
import org.http4k.core.HttpHandler
import org.http4k.core.Response
import org.http4k.core.Status.Companion.OK
import org.http4k.core.Status.Companion.SEE_OTHER
import org.http4k.core.cookie.Cookie
import org.http4k.core.cookie.cookie
import org.http4k.webdriver.Http4kWebDriver
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.openqa.selenium.Cookie as SeleniumCookie

class WebDriverFunctionalTest {

    @Test
    fun `the browser keeps a cookie across pages on the same origin`() {
        val seen = mutableListOf<String?>()
        val handler: HttpHandler = { request ->
            when (request.uri.path) {
                "/set" -> Response(OK).cookie(Cookie("sid", Markers.A, path = "/"))
                else -> {
                    seen += request.cookieValue("sid")
                    Response(OK)
                }
            }
        }
        val driver = Http4kWebDriver(handler)

        driver.get("http://a.example/set")
        driver.get("http://a.example/next")

        assertEquals(listOf<String?>(Markers.A), seen,
            "a cookie must still be sent while browsing within one origin")
    }

    @Test
    fun `the browser keeps a cookie across a same origin redirect`() {
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
        val driver = Http4kWebDriver(handler)

        driver.get("http://a.example/login")
        driver.get("http://a.example/start")

        assertEquals(listOf<String?>(Markers.A), seen,
            "a same origin redirect must still carry the cookie")
    }

    @Test
    fun `a cookie added through the browser API is visible and sent on the same origin`() {
        val seen = mutableListOf<String?>()
        val handler: HttpHandler = { request ->
            seen += request.cookieValue("sid")
            Response(OK)
        }
        val driver = Http4kWebDriver(handler)

        driver.get("http://a.example/home")
        driver.manage().addCookie(SeleniumCookie("sid", Markers.A))
        driver.get("http://a.example/check")

        assertTrue(driver.manage().cookies.any { it.name == "sid" },
            "a cookie added through the browser API must be visible to the browser API")
        assertEquals(Markers.A, seen.lastOrNull(),
            "a cookie added through the browser API must be sent on the same origin")
    }
}
