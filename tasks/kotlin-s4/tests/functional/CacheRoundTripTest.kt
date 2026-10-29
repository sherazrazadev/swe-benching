package functional

import org.jetbrains.kotlin.kapt.base.incremental.ClassFileStructure
import org.jetbrains.kotlin.kapt.base.incremental.SourceFileStructure
import org.jetbrains.kotlin.kapt.base.incremental.SourcesToReprocess
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import support.cacheDir
import support.openContext
import support.writeSerialized
import java.io.File

class CacheRoundTripTest {
    @Test
    fun classFileStructureSurvivesCacheReload(@TempDir tmp: File) {
        val generated = File(tmp, "Generated.class").also { it.writeText("") }
        val type = "test.Generated"

        openContext(tmp).let { context ->
            context.cacheManager!!.javaCache.addSourceStructure(ClassFileStructure(generated.toURI(), type))
            context.close()
        }

        openContext(tmp).let { context ->
            try {
                assertEquals(setOf(type), context.cacheManager!!.javaCache.getTypesForFiles(listOf(generated)))
            } finally {
                context.close()
            }
        }
    }

    @Test
    fun sourceFileDependenciesSurviveCacheReload(@TempDir tmp: File) {
        val compiled = File(tmp, "compiled").also { it.mkdirs() }
        listOf("Mentioned", "Src", "ReferencesSrc").forEach { File(compiled, "$it.class").createNewFile() }

        openContext(tmp, incremental = true).let { context ->
            val javaCache = context.cacheManager!!.javaCache
            SourceFileStructure(File("Mentioned.java").toURI()).also {
                it.addDeclaredType("test.Mentioned")
                javaCache.addSourceStructure(it)
            }
            SourceFileStructure(File("Src.java").toURI()).also {
                it.addDeclaredType("test.Src")
                it.addMentionedType("test.Mentioned")
                javaCache.addSourceStructure(it)
            }
            SourceFileStructure(File("ReferencesSrc.java").toURI()).also {
                it.addDeclaredType("test.ReferencesSrc")
                it.addPrivateType("test.Src")
                javaCache.addSourceStructure(it)
            }
            context.close()
        }

        val reloaded = openContext(
            tmp,
            incremental = true,
            changedFiles = listOf(File("Mentioned.java").absoluteFile),
            compiledSources = listOf(compiled)
        )
        val result = reloaded.sourcesToReprocess
        reloaded.close()

        assertTrue(result is SourcesToReprocess.Incremental)
        assertEquals(
            listOf(
                File("Mentioned.java").absoluteFile,
                File("Src.java").absoluteFile,
                File("ReferencesSrc.java").absoluteFile
            ),
            (result as SourcesToReprocess.Incremental).toReprocess
        )
    }

    @Test
    fun aptCacheIncrementalStateSurvivesReload(@TempDir tmp: File) {
        openContext(tmp, incremental = true).let { context ->
            context.cacheManager!!.updateCache(emptyList(), true)
            context.close()
        }

        val reloaded = openContext(tmp, incremental = true)
        val result = reloaded.sourcesToReprocess
        reloaded.close()

        assertEquals(SourcesToReprocess.FullRebuild, result)
    }

    @Test
    fun largeJavaCacheSurvivesReload(@TempDir tmp: File) {
        val files = (0 until 200).map { index ->
            File(tmp, "Generated$index.class").also { it.writeText("") }
        }

        openContext(tmp).let { context ->
            files.forEachIndexed { index, file ->
                context.cacheManager!!.javaCache.addSourceStructure(
                    ClassFileStructure(file.toURI(), "test.Generated$index")
                )
            }
            context.close()
        }

        openContext(tmp).let { context ->
            try {
                assertEquals(
                    (0 until 200).map { "test.Generated$it" }.toSet(),
                    context.cacheManager!!.javaCache.getTypesForFiles(files)
                )
            } finally {
                context.close()
            }
        }
    }

    @Test
    fun unrelatedWhitelistedRootIsDiscarded(@TempDir tmp: File) {
        writeSerialized(File(cacheDir(tmp), "apt-cache.bin"), linkedMapOf("some" to "other value"))

        openContext(tmp).close()
        openContext(tmp).close()

        assertTrue(File(cacheDir(tmp), "apt-cache.bin").isFile)
    }
}
