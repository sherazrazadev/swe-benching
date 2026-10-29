package support

import org.jetbrains.kotlin.kapt.base.KaptContext
import org.jetbrains.kotlin.kapt.base.KaptFlag
import org.jetbrains.kotlin.kapt.base.KaptOptions
import org.jetbrains.kotlin.kapt.base.util.WriterBackedKaptLogger
import java.io.File
import java.io.ObjectOutputStream

fun buildOptions(
    base: File,
    incremental: Boolean = false,
    changedFiles: List<File> = emptyList(),
    compiledSources: List<File> = emptyList()
): KaptOptions {
    val builder = KaptOptions.Builder()
    builder.projectBaseDir = base
    builder.incrementalCache = cacheDir(base)
    builder.sourcesOutputDir = File(base, "out/sources")
    builder.classesOutputDir = File(base, "out/classes")
    builder.stubsOutputDir = File(base, "out/stubs")
    builder.changedFiles.addAll(changedFiles)
    builder.compiledSources.addAll(compiledSources)
    if (incremental) {
        builder.flags.add(KaptFlag.INCREMENTAL_APT)
    }
    return builder.build()
}

fun processorLoaderOptions(
    base: File,
    processingClasspath: List<File>,
    processors: List<String>
): KaptOptions {
    val builder = KaptOptions.Builder()
    builder.projectBaseDir = base
    builder.incrementalCache = cacheDir(base)
    builder.sourcesOutputDir = File(base, "out/sources")
    builder.classesOutputDir = File(base, "out/classes")
    builder.stubsOutputDir = File(base, "out/stubs")
    builder.processingClasspath.addAll(processingClasspath)
    builder.processors.addAll(processors)
    return builder.build()
}

fun cacheDir(base: File): File = File(base, "incremental-cache").also { it.mkdirs() }

fun openContext(
    base: File,
    incremental: Boolean = false,
    changedFiles: List<File> = emptyList(),
    compiledSources: List<File> = emptyList()
): KaptContext = KaptContext(
    buildOptions(base, incremental, changedFiles, compiledSources),
    false,
    WriterBackedKaptLogger(false)
)

fun writeSerialized(file: File, value: Any) {
    file.parentFile.mkdirs()
    ObjectOutputStream(file.outputStream()).use { it.writeObject(value) }
}
