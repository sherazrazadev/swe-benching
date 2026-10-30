import '../support/angular_setup';
import '../support/framework';
import './host_bindings';
import {runTests} from '../support/framework';

export async function runSuite() {
  return {group: 'functional', results: await runTests()};
}
