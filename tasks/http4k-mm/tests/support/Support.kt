package hidden.support

import org.http4k.core.Request
import org.http4k.core.cookie.cookie
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** Harmless marker values. The tests only check whether these values cross an origin. */
object Markers {
    const val A = "marker-alpha-4f1c"
    const val B = "marker-bravo-8e27"
}

class MutableClock(private var current: Instant) : Clock() {
    override fun withZone(zone: ZoneId?): Clock = this
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun instant(): Instant = current

    fun advanceSeconds(seconds: Long) {
        current = current.plusSeconds(seconds)
    }
}

fun Request.cookieValue(name: String): String? = cookie(name)?.value
