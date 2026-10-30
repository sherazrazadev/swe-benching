import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAll } from "./runner.ts";

const [dir, outFile] = process.argv.slice(2);
if (!dir || !outFile) {
  console.error("usage: run_hidden.mjs <test-dir> <junit-xml>");
  process.exit(2);
}

const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith(".test.ts"))
  .sort();

for (const file of files) {
  await import(pathToFileURL(path.join(dir, file)).href);
}

const result = await runAll();
fs.writeFileSync(outFile, result.xml);
console.log(`ran ${result.total} tests, ${result.failed} failed`);
process.exit(result.failed === 0 ? 0 : 1);
