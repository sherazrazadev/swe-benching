package bench

import javax.annotation.processing.AbstractProcessor
import javax.annotation.processing.RoundEnvironment
import javax.lang.model.SourceVersion
import javax.lang.model.element.TypeElement

/** A processor used only to make the incremental processor discovery path observable. */
class ProbeProcessor : AbstractProcessor() {
    override fun getSupportedAnnotationTypes(): MutableSet<String> = mutableSetOf("bench.Observed")

    override fun process(annotations: MutableSet<out TypeElement>, roundEnv: RoundEnvironment): Boolean = false

    override fun getSupportedSourceVersion(): SourceVersion = SourceVersion.latest()
}
