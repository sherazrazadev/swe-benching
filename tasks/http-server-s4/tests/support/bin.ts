/*
 * Hidden-suite runner. Same runner and plugins as the project's own bin/test.ts,
 * plus a JUnit reporter that writes to JUNIT_OUT.
 */
import { assert } from '@japa/assert'
import { snapshot } from '@japa/snapshot'
import { fileSystem } from '@japa/file-system'
import { expectTypeOf } from '@japa/expect-type'
import { processCLIArgs, configure, run } from '@japa/runner'
import { spec } from '@japa/runner/reporters'

import { JunitReporter } from './junit_reporter.ts'

processCLIArgs(process.argv.splice(2))
configure({
  files: (process.env.HIDDEN_FILES || 'htests/security/**/*.spec.ts').split(','),
  plugins: [assert(), expectTypeOf(), snapshot(), fileSystem()],
  reporters: {
    activated: ['spec', 'junit'],
    list: [
      spec(),
      {
        name: 'junit',
        handler: (runner: any, emitter: any) => new JunitReporter().boot(runner, emitter),
      },
    ],
  },
})

run()
