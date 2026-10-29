package security

import org.jetbrains.kotlin.kapt.base.incremental.DeserializationProbe
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import support.cacheDir
import support.openContext
import support.writeSerialized
import java.io.File

class CacheDeserializationTest {
    @Test
    fun poisonedAptCacheIsNotDeserialized(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "apt-cache.bin"), DeserializationProbe())

        openContext(tmp).close()

        assertFalse(DeserializationProbe.wasDeserialized)
    }

    @Test
    fun poisonedJavaCacheIsNotDeserialized(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "java-cache.bin"), DeserializationProbe())

        openContext(tmp).close()

        assertFalse(DeserializationProbe.wasDeserialized)
    }

    @Test
    fun deserializationHappensBeforeAnyRootTypeCheck(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "apt-cache.bin"), linkedMapOf("key" to DeserializationProbe()))

        openContext(tmp).close()

        assertFalse(DeserializationProbe.wasDeserialized)
    }

    @Test
    fun nestedObjectInJavaCacheIsNotDeserialized(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "java-cache.bin"), linkedMapOf("key" to DeserializationProbe()))

        openContext(tmp).close()

        assertFalse(DeserializationProbe.wasDeserialized)
    }

    @Test
    fun rejectedCacheDoesNotStopTheNextBuild(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "apt-cache.bin"), DeserializationProbe())
        writeSerialized(File(cacheDir(tmp), "java-cache.bin"), DeserializationProbe())

        openContext(tmp).close()
        openContext(tmp).close()

        assertFalse(DeserializationProbe.wasDeserialized)
    }
}
