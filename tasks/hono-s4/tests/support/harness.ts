import * as path from 'node:path'
import type { FileSystemModule } from '../../src/helper/ssg/ssg'

export interface Call {
  op: 'mkdir' | 'writeFile'
  path: string
  data?: string | Uint8Array
}

/** In-memory FileSystemModule that records every path the generator touches. */
export const recordingFs = (): { fs: FileSystemModule; calls: Call[] } => {
  const calls: Call[] = []
  const fs: FileSystemModule = {
    mkdir: async (p) => {
      calls.push({ op: 'mkdir', path: p })
    },
    writeFile: async (p, data) => {
      calls.push({ op: 'writeFile', path: p, data })
    },
  }
  return { fs, calls }
}

const toPosix = (p: string): string => p.replace(/\\/g, '/')

/** Resolve a path the way the operating system would, for containment comparisons. */
export const resolvePath = (p: string): string =>
  path.posix.resolve(process.cwd(), toPosix(p))

export const isInside = (outDir: string, p: string): boolean => {
  const root = resolvePath(outDir)
  const target = resolvePath(p)
  if (target === root) {
    return true
  }
  return root === '/' ? target.startsWith('/') : target.startsWith(`${root}/`)
}

/** Every recorded filesystem touch that lands outside the given output directory. */
export const callsOutside = (calls: Call[], outDir: string): Call[] =>
  calls.filter((call) => !isInside(outDir, call.path))

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown }

/** Run a call and capture either its value or its rejection. */
export const attempt = async <T>(run: Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, value: await run }
  } catch (error) {
    return { ok: false, error }
  }
}

interface GenerationResult {
  success: boolean
}

/** A generation is refused when it throws or completes with success === false. */
export const refused = (outcome: Outcome<GenerationResult>): boolean =>
  outcome.ok === false || outcome.value.success === false

/**
 * Every path the call reports having produced resolves inside the output directory.
 * A refused call reports nothing, so it satisfies this.
 */
export const reportedInside = (outcome: Outcome<unknown>, outDir: string): boolean => {
  if (!outcome.ok) {
    return true
  }
  const value = outcome.value
  if (typeof value === 'string') {
    return isInside(outDir, value)
  }
  const files = (value as { files?: unknown } | undefined)?.files
  if (Array.isArray(files)) {
    return files.every((file) => typeof file === 'string' && isInside(outDir, file))
  }
  return true
}
