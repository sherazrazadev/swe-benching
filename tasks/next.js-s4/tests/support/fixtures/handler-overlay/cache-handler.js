const fs = require('node:fs')
const path = require('node:path')

const FileSystemCache =
  require('next/dist/server/lib/incremental-cache/file-system-cache').default

// A user-supplied cache handler that composes the built-in storage and keeps a
// record of the response operations it receives. Keys are opaque strings.
module.exports = class RecordingCacheHandler extends FileSystemCache {
  record(operation, key, value) {
    fs.appendFileSync(
      path.join(process.cwd(), 'cache-operations.jsonl'),
      JSON.stringify({
        operation,
        key,
        kind: value?.kind,
        route: value?.pageData?.route,
      }) + '\n'
    )
  }

  async get(key, context) {
    const value = await super.get(key, context)
    if (context.kind !== 'FETCH' && context.kind !== 'IMAGE') {
      this.record('get', key, value?.value)
    }
    return value
  }

  async set(key, value, context) {
    if (!context.fetchCache && value?.kind !== 'IMAGE') {
      this.record('set', key, value)
    }
    return super.set(key, value, context)
  }
}
