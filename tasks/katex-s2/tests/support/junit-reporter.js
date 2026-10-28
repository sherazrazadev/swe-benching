/* Minimal JUnit XML reporter for the hidden jest runs.
 * Writes one <testsuite> with one <testcase> per jest test to `output`.
 * A file that could not be executed (transform/import error) becomes one
 * <testcase> with an <error>, so a broken submission is a failed test, not a
 * missing result file.
 */
"use strict";
const fs = require("fs");
const path = require("path");

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

class JUnitReporter {
  constructor(globalConfig, options) {
    this._options = options || {};
    this._cases = [];
    this._seen = new Map();
  }

  onTestResult(test, testResult) {
    const file = path.basename(test.path);
    const rel = path.basename(path.dirname(test.path));
    const suiteName = rel + "/" + file;
    if (testResult.testExecError) {
      const e = testResult.testExecError;
      this._cases.push({
        classname: suiteName,
        name: "(suite)",
        time: 0,
        status: "error",
        message: e.message || String(e),
      });
      return;
    }
    for (const r of testResult.testResults || []) {
      const ancestors = (r.ancestorTitles || []).join(" > ");
      const classname = ancestors ? suiteName + " > " + ancestors : suiteName;
      const rawName = r.title || r.fullName || "(unnamed)";
      // Two distinct cases can share a classname and title; keep both results separate.
      const key = classname + "\u0000" + rawName;
      const n = (this._seen.get(key) || 0) + 1;
      this._seen.set(key, n);
      this._cases.push({
        classname,
        name: n === 1 ? rawName : rawName + " [#" + n + "]",
        time: (r.duration || 0) / 1000,
        status: r.status,
        message: (r.failureMessages || []).join("\n"),
      });
    }
  }

  onRunComplete() {
    const cases = this._cases;
    const failures = cases.filter((c) => c.status === "failed").length;
    const errors = cases.filter((c) => c.status === "error").length;
    const skipped = cases.filter((c) => c.status !== "passed" && c.status !== "failed" && c.status !== "error").length;
    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<testsuites>');
    parts.push(
      '  <testsuite name="hidden" tests="' + cases.length + '" failures="' + failures +
      '" errors="' + errors + '" skipped="' + skipped + '">'
    );
    for (const c of cases) {
      parts.push(
        '    <testcase classname="' + esc(c.classname) + '" name="' + esc(c.name) +
        '" time="' + c.time.toFixed(4) + '">'
      );
      if (c.status === "failed") {
        parts.push('      <failure message="' + esc((c.message || "").split("\n")[0]) + '">' + esc(c.message) + "</failure>");
      } else if (c.status === "error") {
        parts.push('      <error message="' + esc((c.message || "").split("\n")[0]) + '">' + esc(c.message) + "</error>");
      } else if (c.status !== "passed") {
        parts.push("      <skipped/>");
      }
      parts.push("    </testcase>");
    }
    parts.push("  </testsuite>");
    parts.push("</testsuites>");
    const out = this._options.output;
    if (out) {
      fs.mkdirSync(path.dirname(out), {recursive: true});
      fs.writeFileSync(out, parts.join("\n") + "\n");
    }
  }
}

module.exports = JUnitReporter;
