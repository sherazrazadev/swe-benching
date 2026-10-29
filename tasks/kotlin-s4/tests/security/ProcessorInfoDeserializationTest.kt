package security

import org.jetbrains.kotlin.kapt.base.ProcessorLoaderImpl
import org.jetbrains.kotlin.kapt.base.incremental.DeserializationProbe
import org.jetbrains.kotlin.kapt.base.util.WriterBackedKaptLogger
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import support.cacheDir
import support.processorLoaderOptions
import support.writeSerialized
import java.io.File

class ProcessorInfoDeserializationTest {
    @Test
    fun poisonedProcessorInfoCacheIsNotDeserialized(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "processor-info.bin"), DeserializationProbe())

        val options = processorLoaderOptions(tmp, emptyList(), emptyList())
        ProcessorLoaderImpl(options, WriterBackedKaptLogger(false)).use { loader ->
            loader.loadProcessors()
        }

        assertFalse(DeserializationProbe.wasDeserialized)
    }

    @Test
    fun poisonedProcessorInfoCacheDoesNotStopProcessorLoading(@TempDir tmp: File) {
        DeserializationProbe.wasDeserialized = false
        writeSerialized(File(cacheDir(tmp), "processor-info.bin"), linkedMapOf("key" to DeserializationProbe()))

        val options = processorLoaderOptions(tmp, emptyList(), listOf(ProbeProcessorName))
        val loaded = ProcessorLoaderImpl(options, WriterBackedKaptLogger(false)).use { loader ->
            loader.loadProcessors()
        }

        assertFalse(DeserializationProbe.wasDeserialized)
        assertFalse(loaded.processors.isEmpty())
    }

    private companion object {
        const val ProbeProcessorName = "bench.ProbeProcessor"
    }
}
