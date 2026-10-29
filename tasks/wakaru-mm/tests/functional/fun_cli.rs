// Hidden functional suite: the command-line tool keeps writing benign module
// layouts where it does today, including nested paths, embedded dots and
// disambiguated repeated names, and keeps extracting source-map content.

use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

fn fresh_dir(tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let mut path = std::env::temp_dir();
    path.push(format!("wakaru-fun-{tag}-{}-{nanos}", std::process::id()));
    fs::create_dir_all(&path).expect("create temp dir");
    path
}

fn cleanup(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

fn wakaru(args: &[OsString]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_wakaru"))
        .args(args)
        .output()
        .expect("run wakaru")
}

fn nested_bundle() -> String {
    r#"
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
"#
    .to_string()
}

fn duplicate_bundle() -> String {
    r#"
(() => {
  var __webpack_modules__ = ({
    "./src/dup.js": ((module) => { module.exports = "first-token"; }),
    "src/dup.js": ((module) => { module.exports = "second-token"; })
  });
  var __webpack_module_cache__ = {};
  function __webpack_require__(moduleId) {
    var module = __webpack_module_cache__[moduleId] = { exports: {} };
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    return module.exports;
  }
  console.log(__webpack_require__("./src/dup.js"));
})();
"#
    .to_string()
}

fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()))
}

#[test]
fn unpack_writes_nested_paths_and_embedded_dots_under_output_dir() {
    let base = fresh_dir("nested");
    let out = base.join("out");
    let bundle = base.join("bundle.js");
    fs::write(&bundle, nested_bundle()).expect("write bundle");

    let result = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.clone().into_os_string(),
    ]);
    assert!(
        result.status.success(),
        "benign unpack failed: {}",
        String::from_utf8_lossy(&result.stderr)
    );

    assert!(
        read(&out.join("src/index.js")).contains("root-token"),
        "nested module src/index.js missing or wrong"
    );
    assert!(
        read(&out.join("node_modules/pkg/lib/util.js")).contains("nested-token"),
        "deeply nested module missing or wrong"
    );
    assert!(
        read(&out.join("lib/..cache/data.js")).contains("dots-token"),
        "module whose component contains extra dots missing or wrong"
    );
    cleanup(&base);
}

#[test]
fn unpack_disambiguates_repeated_module_names() {
    let base = fresh_dir("dedup");
    let out = base.join("out");
    let bundle = base.join("bundle.js");
    fs::write(&bundle, duplicate_bundle()).expect("write bundle");

    let result = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.clone().into_os_string(),
    ]);
    assert!(
        result.status.success(),
        "benign unpack failed: {}",
        String::from_utf8_lossy(&result.stderr)
    );

    assert!(
        read(&out.join("src/dup.js")).contains("first-token"),
        "first module of a repeated name missing or wrong"
    );
    assert!(
        read(&out.join("src/dup_2.js")).contains("second-token"),
        "repeated module name was not disambiguated"
    );
    cleanup(&base);
}

#[test]
fn extract_writes_source_map_sources_under_output_dir() {
    let base = fresh_dir("extract");
    let out = base.join("out");
    let map = base.join("bundle.js.map");
    fs::write(
        &map,
        r#"{"version":3,"sources":["../src/a.js","webpack:///src/b.js"],"names":[],"mappings":"","sourcesContent":["alpha-content","beta-content"]}"#,
    )
    .expect("write map");

    let result = wakaru(&[
        OsString::from("extract"),
        map.into_os_string(),
        OsString::from("-o"),
        out.clone().into_os_string(),
    ]);
    assert!(
        result.status.success(),
        "benign extraction failed: {}",
        String::from_utf8_lossy(&result.stderr)
    );

    assert_eq!(
        read(&out.join("src/a.js")),
        "alpha-content",
        "first extracted source missing or wrong"
    );
    assert_eq!(
        read(&out.join("src/b.js")),
        "beta-content",
        "second extracted source missing or wrong"
    );
    cleanup(&base);
}
