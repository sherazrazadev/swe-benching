// Hidden functional suite: benign bundles keep their module names and every
// accepted format and option still produces the modules it does today.

use wakaru_core::{unpack, DecompileOptions};

const WEBPACK5_NESTED: &str = r#"
(() => {
  var __webpack_modules__ = ({
    "./src/index.js": ((module) => { module.exports = "root-token"; }),
    "./node_modules/pkg/lib/util.js": ((module) => { module.exports = "nested-token"; }),
    "lib/..cache/data.js": ((module) => { module.exports = "dots-token"; })
  });
  var __webpack_module_cache__ = {};
  function __webpack_require__(moduleId) {
    var module = __webpack_module_cache__[moduleId] = { exports: {} };
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    return module.exports;
  }
  console.log(__webpack_require__("./src/index.js"));
})();
"#;

const WEBPACK4_NESTED: &str = r#"
(function(modules) {
    var installedModules = {};
    function __webpack_require__(moduleId) {
        if (installedModules[moduleId]) return installedModules[moduleId].exports;
        var module = installedModules[moduleId] = { i: moduleId, l: false, exports: {} };
        modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
        module.l = true;
        return module.exports;
    }
    return __webpack_require__(__webpack_require__.s = "./src/index.js");
})({
    "./src/utils/helper.js": function(module, exports) { module.exports = "helper-token"; },
    "./src/index.js": function(module, exports, __webpack_require__) { module.exports = "index-token"; }
});
"#;

const SYSTEMJS_NAMED: &str = r#"
System.register("./chunks/main", [], function (exports) {
  return { execute: function () { exports("default", "main-token"); } };
});
"#;

const ESBUILD_NAMED: &str = r#"
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_a = __commonJS({ "src/foo.js"(exports, module) { module.exports = "foo-token"; } });
var require_b = __commonJS({ "src/b.js"(exports, module) { module.exports = 2; } });
var require_c = __commonJS({ "src/c.js"(exports, module) { module.exports = 3; } });
var require_d = __commonJS({ "src/d.js"(exports, module) { module.exports = 4; } });
var require_e = __commonJS({ "src/e.js"(exports, module) { module.exports = 5; } });
require_a(); require_b(); require_c(); require_d(); require_e();
"#;

const BROWSERIFY_STRING_IDS: &str = r#"
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var a=new Error("missing");throw a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){return o(e[i][1][r]||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var i=0;i<t.length;i++)o(t[i]);return o}return r})()({
  "./lib/util.js": [function(require,module,exports){ module.exports = "util-token"; }, {}],
  "./lib/main.js": [function(require,module,exports){ module.exports = 1; }, {}]
}, {}, ["./lib/main.js"]);
"#;

const BROWSERIFY_BARE_IDS: &str = r#"
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var a=new Error("missing");throw a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){return o(e[i][1][r]||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var i=0;i<t.length;i++)o(t[i]);return o}return r})()({
  "lodash/fp.js": [function(require,module,exports){ module.exports = "bare-token"; }, {}],
  "./lib/main.js": [function(require,module,exports){ module.exports = 1; }, {}]
}, {}, ["./lib/main.js"]);
"#;

const WEBPACK5_RUNTIME_ENTRY: &str = r#"
(() => {
  var modules = {};
  function require(id) { return {}; }
  require.m = modules;
  require.f = {};
  require.e = function(id) { return Promise.resolve(id); };
  require.u = function(id) { return id + ".bundle.js"; };
  require.t = function(value) { return value; };
  require.e(529).then(require.t.bind(require, 529, 19));
})();
"#;

const WEBPACK5_GENERATED_NAMES: &str = r#"
(() => {
  var __webpack_modules__ = ({
    "./generated/one.js": ((module) => { module.exports = 1; }),
    "./generated/two.js": ((module) => { module.exports = 2; })
  });
  var __webpack_module_cache__ = {};
  function __webpack_require__(moduleId) {
    var module = __webpack_module_cache__[moduleId] = { exports: {} };
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    return module.exports;
  }
  console.log(__webpack_require__("./generated/one.js"));
})();
"#;

fn options() -> DecompileOptions {
    DecompileOptions::default()
}

fn names(source: &str) -> Vec<String> {
    unpack(source, options())
        .expect("benign bundle should unpack")
        .modules
        .into_iter()
        .map(|(name, _)| name)
        .collect()
}

#[test]
fn webpack5_keeps_nested_and_dot_directory_module_paths() {
    let names = names(WEBPACK5_NESTED);
    for expected in [
        "src/index.js",
        "node_modules/pkg/lib/util.js",
        "lib/..cache/data.js",
    ] {
        assert!(
            names.iter().any(|name| name == expected),
            "expected module {expected}, got {names:?}"
        );
    }
}

#[test]
fn every_accepted_format_keeps_its_module_names() {
    assert!(
        names(WEBPACK4_NESTED).iter().any(|name| name == "src/utils/helper.js"),
        "webpack4 lost its nested module name"
    );
    assert!(
        names(SYSTEMJS_NAMED).iter().any(|name| name == "chunks/main.js"),
        "systemjs lost its named module"
    );
    assert!(
        names(ESBUILD_NAMED).iter().any(|name| name == "src/foo.js"),
        "esbuild lost its source path module name"
    );
    let browserify = names(BROWSERIFY_STRING_IDS);
    assert!(
        browserify.iter().any(|name| name == "lib/util.js"),
        "browserify lost its string-key module name: {browserify:?}"
    );
    assert!(
        browserify.iter().any(|name| name == "entry.js"),
        "browserify lost its entry module: {browserify:?}"
    );
}

#[test]
fn supplied_source_map_still_names_the_modules() {
    let map = br#"{"version":3,"sources":["src/alpha.js","src/beta.js"],"names":[],"mappings":"","sourcesContent":["A","B"]}"#;
    let unpacked = unpack(
        WEBPACK5_GENERATED_NAMES,
        DecompileOptions {
            sourcemap: Some(map.to_vec()),
            ..Default::default()
        },
    )
    .expect("benign bundle with a source map should unpack");
    let names: Vec<String> = unpacked.modules.into_iter().map(|(name, _)| name).collect();
    assert_eq!(
        names,
        vec!["src/alpha.js".to_string(), "src/beta.js".to_string()],
        "the source map's original names must still be applied"
    );
}

#[test]
fn bare_module_names_keep_their_package_path() {
    let names = names(BROWSERIFY_BARE_IDS);
    assert!(
        names.iter().any(|name| name == "lodash/fp.js"),
        "browserify lost its bare module name: {names:?}"
    );
    assert!(
        names.iter().any(|name| name == "entry.js"),
        "browserify lost its entry module: {names:?}"
    );
}

#[test]
fn supplied_source_map_file_still_names_the_entry_module() {
    let map = br#"{"version":3,"file":"dist/app.js","sources":[],"names":[],"mappings":""}"#;
    let unpacked = unpack(
        WEBPACK5_RUNTIME_ENTRY,
        DecompileOptions {
            sourcemap: Some(map.to_vec()),
            ..Default::default()
        },
    )
    .expect("benign runtime entry with a source map should unpack");
    let names: Vec<String> = unpacked.modules.into_iter().map(|(name, _)| name).collect();
    assert_eq!(
        names,
        vec!["dist/app.js".to_string()],
        "the map's bundle name must still name the entry module"
    );
}
