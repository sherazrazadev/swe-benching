// Hidden security suite: the command-line tool must never write outside the
// output directory chosen with -o, for crafted module names and for paths that
// pass through an existing directory link.

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
    path.push(format!("wakaru-sec-{tag}-{}-{nanos}", std::process::id()));
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

fn webpack5_bundle(module_id: &str, token: &str) -> String {
    format!(
        r#"
(() => {{
  var __webpack_modules__ = ({{
    "{module_id}": ((module) => {{ module.exports = "{token}"; }}),
    "./src/index.js": ((module) => {{ module.exports = 1; }})
  }});
  var __webpack_module_cache__ = {{}};
  function __webpack_require__(moduleId) {{
    var module = __webpack_module_cache__[moduleId] = {{ exports: {{}} }};
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    return module.exports;
  }}
  console.log(__webpack_require__("./src/index.js"));
}})();
"#
    )
}

#[test]
fn unpack_overlapping_dot_module_id_does_not_overwrite_file_outside_output_dir() {
    let base = fresh_dir("overlap");
    let out = base.join("out");
    let marker = base.join("node_modules").join("evil").join("marker.js");
    fs::create_dir_all(marker.parent().expect("marker parent")).expect("create marker dir");
    fs::write(&marker, "original").expect("write marker");
    let bundle = base.join("crafted.js");
    fs::write(&bundle, webpack5_bundle("....//node_modules/evil/marker.js", "pwned"))
        .expect("write bundle");

    let _ = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.into_os_string(),
    ]);

    assert_eq!(
        fs::read_to_string(&marker).expect("marker readable"),
        "original",
        "a file outside the output directory must not be created or overwritten"
    );
    cleanup(&base);
}

#[test]
fn unpack_absolute_module_id_does_not_overwrite_file_outside_output_dir() {
    let base = fresh_dir("absolute");
    let out = base.join("out");
    let external = base.join("external").join("marker.js");
    fs::create_dir_all(external.parent().expect("external parent")).expect("create external dir");
    fs::write(&external, "original").expect("write external marker");
    let absolute = external.to_string_lossy().to_string();
    let bundle = base.join("crafted.js");
    fs::write(&bundle, webpack5_bundle(&absolute, "pwned")).expect("write bundle");

    let _ = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.into_os_string(),
    ]);

    assert_eq!(
        fs::read_to_string(&external).expect("external marker readable"),
        "original",
        "an absolute module name must not cause a write outside the output directory"
    );
    cleanup(&base);
}

#[cfg(unix)]
#[test]
fn unpack_does_not_follow_existing_directory_link_out_of_output_dir() {
    let base = fresh_dir("symlink");
    let out = base.join("out");
    let external = base.join("external");
    fs::create_dir_all(&out).expect("create out");
    fs::create_dir_all(&external).expect("create external");
    std::os::unix::fs::symlink(&external, out.join("link")).expect("create link");
    let bundle = base.join("crafted.js");
    fs::write(&bundle, webpack5_bundle("link/pwn.js", "pwned")).expect("write bundle");

    let _ = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.into_os_string(),
        OsString::from("--force"),
    ]);

    assert!(
        !external.join("pwn.js").exists(),
        "a module path that runs through a directory link must not write outside the output directory"
    );
    cleanup(&base);
}

#[cfg(unix)]
#[test]
fn unpack_does_not_overwrite_outside_file_through_existing_file_link() {
    let base = fresh_dir("file-link");
    let out = base.join("out");
    let external = base.join("external").join("marker.js");
    fs::create_dir_all(&out).expect("create out");
    fs::create_dir_all(external.parent().expect("external parent")).expect("create external dir");
    fs::write(&external, "original").expect("write external marker");
    std::os::unix::fs::symlink(&external, out.join("pwn.js")).expect("create file link");
    let bundle = base.join("crafted.js");
    fs::write(&bundle, webpack5_bundle("pwn.js", "pwned")).expect("write bundle");

    let _ = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.into_os_string(),
        OsString::from("--force"),
    ]);

    assert_eq!(
        fs::read_to_string(&external).expect("external marker readable"),
        "original",
        "a write that lands on a link to a file outside the output directory must be refused"
    );
    cleanup(&base);
}

fn webpack5_runtime_entry_bundle() -> String {
    r#"
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
"#
    .to_string()
}

#[test]
fn unpack_map_file_name_does_not_overwrite_file_outside_output_dir() {
    let base = fresh_dir("map-file");
    let out = base.join("out");
    let external = base.join("escape.js");
    fs::write(&external, "original").expect("write external marker");
    let bundle = base.join("runtime.js");
    fs::write(&bundle, webpack5_runtime_entry_bundle()).expect("write bundle");
    let map = base.join("bundle.js.map");
    fs::write(
        &map,
        r#"{"version":3,"file":"../escape.js","sources":[],"names":[],"mappings":""}"#,
    )
    .expect("write map");

    let _ = wakaru(&[
        bundle.into_os_string(),
        OsString::from("--unpack"),
        OsString::from("-o"),
        out.into_os_string(),
        OsString::from("-m"),
        map.into_os_string(),
    ]);

    assert_eq!(
        fs::read_to_string(&external).expect("external marker readable"),
        "original",
        "a module name recovered from the source map must not write outside the output directory"
    );
    cleanup(&base);
}

#[cfg(unix)]
#[test]
fn extract_does_not_follow_existing_directory_link_out_of_output_dir() {
    let base = fresh_dir("extract-link");
    let out = base.join("out");
    let external = base.join("external");
    fs::create_dir_all(&out).expect("create out");
    fs::create_dir_all(&external).expect("create external");
    std::os::unix::fs::symlink(&external, out.join("link")).expect("create link");
    let map = base.join("bundle.js.map");
    fs::write(
        &map,
        r#"{"version":3,"sources":["link/pwn.js"],"names":[],"mappings":"","sourcesContent":["PWNED"]}"#,
    )
    .expect("write map");

    let _ = wakaru(&[
        OsString::from("extract"),
        map.into_os_string(),
        OsString::from("-o"),
        out.into_os_string(),
        OsString::from("--force"),
    ]);

    assert!(
        !external.join("pwn.js").exists(),
        "a source path that runs through a directory link must not write outside the output directory"
    );
    cleanup(&base);
}
