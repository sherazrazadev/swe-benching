// Hidden security suite: module names reported by the unpacking API must be safe
// relative paths for every accepted bundle shape. A refused input (Err/None) is
// an acceptable way to block the attack; a reported name with a parent, root or
// drive component is not.

use std::path::Component;

use wakaru_core::unpacker::unpack_bundle;
use wakaru_core::{unpack, unpack_files, unpack_raw, DecompileOptions, UnpackInput};

const WEBPACK5_OVERLAP: &str = r#"
(() => {
  var __webpack_modules__ = ({
    "....//node_modules/evil/marker.js": ((module) => { module.exports = "pwned"; }),
    "./src/index.js": ((module) => { module.exports = 1; })
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

const WEBPACK5_ABSOLUTE: &str = r#"
(() => {
  var __webpack_modules__ = ({
    "/tmp/wakaru-absolute-escape/marker.js": ((module) => { module.exports = "pwned"; }),
    "./src/index.js": ((module) => { module.exports = 1; })
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

const WEBPACK4_OVERLAP: &str = r#"
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
    "....//evil/marker.js": function(module, exports) { module.exports = "pwned"; },
    "./src/index.js": function(module, exports, __webpack_require__) { module.exports = 1; }
});
"#;

const SYSTEMJS_OVERLAP: &str = r#"
System.register("....//chunks/main", [], function (exports) {
  return { execute: function () { exports("default", 1); } };
});
"#;

const ESBUILD_MIDPATH: &str = r#"
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_a = __commonJS({ "src/../../escape.js"(exports, module) { module.exports = 1; } });
var require_b = __commonJS({ "src/b.js"(exports, module) { module.exports = 2; } });
var require_c = __commonJS({ "src/c.js"(exports, module) { module.exports = 3; } });
var require_d = __commonJS({ "src/d.js"(exports, module) { module.exports = 4; } });
var require_e = __commonJS({ "src/e.js"(exports, module) { module.exports = 5; } });
require_a(); require_b(); require_c(); require_d(); require_e();
"#;

const BROWSERIFY_STRING_KEY: &str = r#"
(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var a=new Error("missing");throw a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){return o(e[i][1][r]||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var i=0;i<t.length;i++)o(t[i]);return o}return r})()({
  "....//evil/marker.js": [function(require,module,exports){ module.exports = "pwned"; }, {}],
  "./lib/main.js": [function(require,module,exports){ module.exports = 1; }, {}]
}, {}, ["./lib/main.js"]);
"#;

const WEBPACK5_PLAIN: &str = r#"
(() => {
  var __webpack_modules__ = ({
    "./src/alpha.js": ((module) => { module.exports = 1; }),
    "./src/beta.js": ((module) => { module.exports = 2; })
  });
  var __webpack_module_cache__ = {};
  function __webpack_require__(moduleId) {
    var module = __webpack_module_cache__[moduleId] = { exports: {} };
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    return module.exports;
  }
  console.log(__webpack_require__("./src/alpha.js"));
})();
"#;

fn sourcemap_with_unsafe_source() -> Vec<u8> {
    br#"{"version":3,"sources":["....//node_modules/evil/marker.js","src/ok.js"],"names":[],"mappings":"","sourcesContent":["A","B"]}"#.to_vec()
}

fn is_safe_relative_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    let mut saw_normal = false;
    for component in std::path::Path::new(name).components() {
        match component {
            Component::Normal(_) => saw_normal = true,
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return false,
        }
    }
    saw_normal
}

fn check_names<E: std::fmt::Debug>(label: &str, result: Result<Vec<String>, E>) {
    match result {
        // Refusing the whole input is an acceptable way to block the attack.
        Err(_) => {}
        Ok(names) => {
            let unsafe_names: Vec<&String> =
                names.iter().filter(|name| !is_safe_relative_name(name)).collect();
            assert!(
                unsafe_names.is_empty(),
                "{label}: reported module name(s) that are not safe relative paths: {names:?}"
            );
        }
    }
}

fn default_decompile_options() -> DecompileOptions {
    DecompileOptions::default()
}

fn unpack_names(source: &str) -> Result<Vec<String>, String> {
    unpack(source, default_decompile_options())
        .map(|out| out.modules.into_iter().map(|(name, _)| name).collect())
        .map_err(|e| e.to_string())
}

fn unpack_raw_names(source: &str) -> Result<Vec<String>, String> {
    unpack_raw(source, &default_decompile_options())
        .map(|out| out.modules.into_iter().map(|(name, _)| name).collect())
        .map_err(|e| e.to_string())
}

#[test]
fn webpack5_overlapping_dot_module_id_is_not_reported_as_parent_path() {
    check_names("webpack5 overlapping dots", unpack_names(WEBPACK5_OVERLAP));
}

#[test]
fn webpack5_absolute_module_id_is_not_reported_as_absolute_path() {
    check_names("webpack5 absolute", unpack_names(WEBPACK5_ABSOLUTE));
}

#[test]
fn webpack4_overlapping_dot_module_id_is_not_reported_as_parent_path() {
    check_names("webpack4 overlapping dots", unpack_names(WEBPACK4_OVERLAP));
}

#[test]
fn systemjs_overlapping_dot_register_name_is_not_reported_as_parent_path() {
    check_names(
        "systemjs overlapping dots (raw)",
        unpack_raw_names(SYSTEMJS_OVERLAP),
    );
}

#[test]
fn esbuild_mid_path_parent_component_is_not_reported() {
    let names = unpack_bundle(ESBUILD_MIDPATH)
        .map(|result| result.modules.into_iter().map(|module| module.filename).collect())
        .ok_or_else(|| "esbuild bundle not detected".to_string());
    check_names("esbuild mid-path parent", names);
}

#[test]
fn multi_file_unpack_keeps_module_names_relative() {
    let inputs = vec![
        UnpackInput {
            filename: "first.js".to_string(),
            source: WEBPACK4_OVERLAP.to_string(),
        },
        UnpackInput {
            filename: "second.js".to_string(),
            source: WEBPACK5_OVERLAP.to_string(),
        },
    ];
    let names = unpack_files(inputs, default_decompile_options())
        .map(|out| out.modules.into_iter().map(|(name, _)| name).collect())
        .map_err(|e| e.to_string());
    check_names("unpack_files", names);
}

#[test]
fn sourcemap_derived_module_name_is_not_reported_as_parent_path() {
    let result = unpack(
        WEBPACK5_PLAIN,
        DecompileOptions {
            sourcemap: Some(sourcemap_with_unsafe_source()),
            ..Default::default()
        },
    )
    .map(|out| out.modules.into_iter().map(|(name, _)| name).collect())
    .map_err(|e| e.to_string());
    check_names("source map derived", result);
}

#[test]
fn browserify_string_module_id_is_not_reported_as_parent_path() {
    check_names(
        "browserify string id",
        unpack_names(BROWSERIFY_STRING_KEY),
    );
}
