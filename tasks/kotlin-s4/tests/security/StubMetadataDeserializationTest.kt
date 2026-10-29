package security

import org.jetbrains.kotlin.kapt.base.stubs.DeserializationProbe
import org.jetbrains.kotlin.kapt.base.stubs.FileInfo
import org.jetbrains.kotlin.kapt.base.stubs.KaptStubLineInformation
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import support.parseSource
import java.io.File
import java.io.ObjectOutputStream

class StubMetadataDeserializationTest {
    @Test
    fun poisonedStubMetadataIsNotDeserialized(@TempDir tmp: File) {
        val source = File(tmp, "Sample.java").also { it.writeText("class Sample {}") }
        val metadata = File(tmp, "Sample.kapt_metadata")
        DeserializationProbe.wasDeserialized = false
        ObjectOutputStream(metadata.outputStream()).use { out ->
            out.writeInt(KaptStubLineInformation.METADATA_VERSION)
            out.writeObject(DeserializationProbe())
        }

        val info = assertDoesNotThrow<FileInfo> {
            KaptStubLineInformation.parseFileInfo(parseSource(source))
        }

        assertFalse(DeserializationProbe.wasDeserialized)
        assertNull(info.getPositionFor("test.Sample"))
    }

    @Test
    fun poisonedStubMetadataNestedPayloadIsNotDeserialized(@TempDir tmp: File) {
        val source = File(tmp, "Nested.java").also { it.writeText("class Nested {}") }
        val metadata = File(tmp, "Nested.kapt_metadata")
        DeserializationProbe.wasDeserialized = false
        ObjectOutputStream(metadata.outputStream()).use { out ->
            out.writeInt(KaptStubLineInformation.METADATA_VERSION)
            out.writeObject(linkedMapOf("key" to DeserializationProbe()))
            out.writeObject(linkedMapOf<String, String>())
        }

        val info = assertDoesNotThrow<FileInfo> {
            KaptStubLineInformation.parseFileInfo(parseSource(source))
        }

        assertFalse(DeserializationProbe.wasDeserialized)
        assertNull(info.getPositionFor("test.Nested"))
    }
}
