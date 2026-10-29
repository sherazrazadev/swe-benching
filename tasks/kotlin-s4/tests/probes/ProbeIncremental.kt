package org.jetbrains.kotlin.kapt.base.incremental

import java.io.ObjectInputStream
import java.io.Serializable

class DeserializationProbe : Serializable {
    private fun readObject(input: ObjectInputStream) {
        input.defaultReadObject()
        wasDeserialized = true
    }

    companion object {
        private const val serialVersionUID = 0L

        @JvmStatic
        var wasDeserialized = false
    }
}
