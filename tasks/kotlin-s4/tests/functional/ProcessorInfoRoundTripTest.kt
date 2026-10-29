package functional

import org.jetbrains.kotlin.kapt.base.ProcessorLoaderImpl
import org.jetbrains.kotlin.kapt.base.util.WriterBackedKaptLogger
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import support.processorLoaderOptions
import java.io.File

class ProcessorInfoRoundTripTest {
    @Test
    fun declaredProcessorKindSurvivesReload(@TempDir tmp: File) {
        val apClasspath = File(tmp, "ap-classpath")
        val marker = File(apClasspath, "META-INF/gradle/incremental.annotation.processors")
        marker.parentFile.mkdirs()
        marker.writeText("bench.ProbeProcessor,ISOLATING\n")

        val first = processorLoaderOptions(tmp, listOf(apClasspath), listOf(PROCESSOR_NAME))
        ProcessorLoaderImpl(first, WriterBackedKaptLogger(false)).use { loader ->
            val loaded = loader.loadProcessors()
            assertEquals("ISOLATING", loaded.processors.single().incrementalSupportType)
        }

        val second = processorLoaderOptions(tmp, emptyList(), listOf(PROCESSOR_NAME))
        ProcessorLoaderImpl(second, WriterBackedKaptLogger(false)).use { loader ->
            val loaded = loader.loadProcessors()
            assertEquals("ISOLATING", loaded.processors.single().incrementalSupportType)
        }
    }

    @Test
    fun processorWithoutSavedKindIsStillLoaded(@TempDir tmp: File) {
        val options = processorLoaderOptions(tmp, emptyList(), listOf(PROCESSOR_NAME))
        ProcessorLoaderImpl(options, WriterBackedKaptLogger(false)).use { loader ->
            val loaded = loader.loadProcessors()
            assertEquals(PROCESSOR_NAME, loaded.processors.single().processorName)
        }
    }

    private companion object {
        const val PROCESSOR_NAME = "bench.ProbeProcessor"
    }
}
