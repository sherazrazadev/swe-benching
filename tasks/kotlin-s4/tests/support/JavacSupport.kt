package support

import com.sun.tools.javac.api.JavacTaskImpl
import com.sun.tools.javac.tree.JCTree
import java.io.File
import javax.tools.ToolProvider

/** Parses [source] with javac and returns the compilation unit the way the kapt drivers see it. */
fun parseSource(source: File): JCTree.JCCompilationUnit {
    val compiler = ToolProvider.getSystemJavaCompiler()
    val fileManager = compiler.getStandardFileManager(null, null, null)
    try {
        val task = compiler.getTask(
            null,
            fileManager,
            null,
            listOf("-proc:none"),
            null,
            fileManager.getJavaFileObjects(source)
        ) as JavacTaskImpl
        return task.parse().first() as JCTree.JCCompilationUnit
    } finally {
        fileManager.close()
    }
}
