package functional

import org.jetbrains.kotlin.kapt.base.stubs.KaptStubLineInformation
import org.jetbrains.kotlin.kapt.base.stubs.KotlinPosition
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import support.parseSource
import java.io.File
import java.io.ObjectOutputStream

class StubMetadataRoundTripTest {
    @Test
    fun stubPositionsSurviveReload(@TempDir tmp: File) {
        val source = File(tmp, "Mapped.java").also { it.writeText("class Mapped { void f() {} }") }
        val metadata = File(tmp, "Mapped.kapt_metadata")
        val positions = linkedMapOf("test.Mapped" to KotlinPosition("Mapped.kt", true, 11))
        val signatures = linkedMapOf("f()" to "()V")
        ObjectOutputStream(metadata.outputStream()).use { out ->
            out.writeInt(KaptStubLineInformation.METADATA_VERSION)
            out.writeObject(positions)
            out.writeObject(signatures)
        }

        val info = KaptStubLineInformation.parseFileInfo(parseSource(source))

        assertEquals(KotlinPosition("Mapped.kt", true, 11), info.getPositionFor("test.Mapped"))
    }

    @Test
    fun manyStubPositionsSurviveReload(@TempDir tmp: File) {
        val source = File(tmp, "Many.java").also { it.writeText("class Many { void f() {} }") }
        val metadata = File(tmp, "Many.kapt_metadata")
        val positions = linkedMapOf<String, KotlinPosition>()
        (0 until 100).forEach { positions["test.Type$it"] = KotlinPosition("Many$it.kt", it % 2 == 0, it) }
        ObjectOutputStream(metadata.outputStream()).use { out ->
            out.writeInt(KaptStubLineInformation.METADATA_VERSION)
            out.writeObject(positions)
            out.writeObject(linkedMapOf<String, String>())
        }

        val info = KaptStubLineInformation.parseFileInfo(parseSource(source))

        assertEquals(KotlinPosition("Many42.kt", true, 42), info.getPositionFor("test.Type42"))
    }
}
