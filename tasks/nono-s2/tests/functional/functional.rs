//! Legitimate use of packs keeps working: a fully recorded pack is verified,
//! and a profile that names a pack which was never installed behaves as today.
//!
//! Every case drives the real `nono` command line; expected values and cleanup
//! are computed here, in the test, with std only.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicUsize, Ordering};

const PROFILE_JSON: &str =
    r#"{"meta":{"name":"widget"},"filesystem":{"read":["$WORKDIR"]}}"#;
const PROFILE_SHA: &str = "45d4aa649c25c45dcd268ae2d2697fff8ffdae43aae476bff0aa19bc2a1b826c";
const GROUPS_ORIG: &str =
    r#"{"acme_widget_read":{"description":"original","allow":{"read":["/tmp/nono-s2-original"]}}}"#;
const GROUPS_ORIG_SHA: &str =
    "9aa29027a499107384e5b1c1af39f0b0ef8f4303787045dc8e47136adcae496b";

const MANIFEST_PROFILE: &str = r#"{"schema_version":1,"name":"widget","artifacts":[{"type":"profile","path":"profile.json","install_as":"widget"}]}"#;
const MANIFEST_PROFILE_GROUPS: &str = r#"{"schema_version":1,"name":"widget","artifacts":[{"type":"profile","path":"profile.json","install_as":"widget"},{"type":"groups","path":"groups.json","prefix":"acme_widget_"}]}"#;

const PROVENANCE: &str = r#""provenance":{"signer_identity":"https://github.com/acme/repo/.github/workflows/release.yml@refs/tags/v1.0.0","repository":"acme/repo","workflow":".github/workflows/release.yml","ref":"refs/tags/v1.0.0","rekor_log_index":1,"signed_at":"2026-01-01T00:00:00Z"},"#;

static SEQ: AtomicUsize = AtomicUsize::new(0);

struct Fx {
    root: PathBuf,
}

impl Fx {
    fn new(tag: &str) -> Fx {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let root = std::env::temp_dir().join(format!(
            "nono-fun-{}-{}-{}",
            tag,
            std::process::id(),
            n
        ));
        let _ = fs::remove_dir_all(&root);
        for d in ["cfg/nono/profiles", "cfg/nono/packages", "home", "work"] {
            fs::create_dir_all(root.join(d)).expect("create fixture dir");
        }
        let _ = fs::create_dir_all("/tmp/nono-s2-original");
        Fx { root }
    }

    fn cfg(&self) -> PathBuf {
        self.root.join("cfg")
    }
    fn home(&self) -> PathBuf {
        self.root.join("home")
    }
    fn work(&self) -> PathBuf {
        self.root.join("work")
    }
    fn pack(&self) -> PathBuf {
        self.cfg().join("nono").join("packages").join("acme").join("widget")
    }
    fn legacy_pack(&self) -> PathBuf {
        self.home().join(".nono").join("packages").join("acme").join("widget")
    }

    fn write(&self, path: &Path, data: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        fs::write(path, data).expect("write fixture file");
    }

    fn verified_pack(&self, pack: &Path, with_groups: bool) {
        self.write(
            &pack.join("package.json"),
            if with_groups {
                MANIFEST_PROFILE_GROUPS
            } else {
                MANIFEST_PROFILE
            },
        );
        self.write(&pack.join("profiles").join("widget.json"), PROFILE_JSON);
        if with_groups {
            self.write(&pack.join("groups.json"), GROUPS_ORIG);
        }
        self.write(&pack.join(".nono-trust.bundle"), "[]\n");
        let artifacts = if with_groups {
            format!(
                r#"{{"profiles/widget.json":{{"sha256":"{}","type":"profile"}},"groups.json":{{"sha256":"{}","type":"groups"}}}}"#,
                PROFILE_SHA, GROUPS_ORIG_SHA
            )
        } else {
            format!(
                r#"{{"profiles/widget.json":{{"sha256":"{}","type":"profile"}}}}"#,
                PROFILE_SHA
            )
        };
        let mut s = String::from(
            r#"{"lockfile_version":4,"registry":"r","packages":{"acme/widget":{"version":"1.0.0","installed_at":"2026-01-01T00:00:00Z","pinned":false,"#,
        );
        s.push_str(PROVENANCE);
        s.push_str(r#""artifacts":"#);
        s.push_str(&artifacts);
        s.push_str(r#","wiring_record":[]}}}"#);
        self.write(
            &self.cfg().join("nono").join("packages").join("lockfile.json"),
            &s,
        );
    }

    fn local_profile_naming_pack(&self) {
        self.write(
            &self.cfg().join("nono").join("profiles").join("local.json"),
            r#"{"meta":{"name":"local"},"packs":["acme/widget"]}"#,
        );
    }

    fn plain_profile(&self) {
        self.write(
            &self.cfg().join("nono").join("profiles").join("plain.json"),
            r#"{"meta":{"name":"plain"}}"#,
        );
    }

    fn group_profile(&self) {
        self.write(
            &self.cfg().join("nono").join("profiles").join("usegrp.json"),
            r#"{"meta":{"name":"usegrp"},"groups":{"include":["acme_widget_read"]}}"#,
        );
    }

    fn nono(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_nono"))
            .args(args)
            .env("XDG_CONFIG_HOME", self.cfg())
            .env("HOME", self.home())
            .env("NONO_NO_UPDATE_CHECK", "1")
            .env("NONO_NO_MIGRATE", "1")
            .env_remove("NONO_PROFILE")
            .current_dir(self.work())
            .output()
            .expect("failed to run nono")
    }

    fn why_path(&self, profile: &str, path: &Path) -> Output {
        self.nono(&[
            "why",
            "--profile",
            profile,
            "--workdir",
            self.work().to_str().unwrap(),
            "--path",
            path.to_str().unwrap(),
            "--op",
            "read",
        ])
    }
}

impl Drop for Fx {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn assert_ok(out: &Output) {
    assert!(
        out.status.success(),
        "expected success\nstdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
}

fn assert_allowed(out: &Output) {
    assert_ok(out);
    assert!(
        String::from_utf8_lossy(&out.stdout).contains("ALLOWED"),
        "expected the path to be reported as allowed\nstdout:\n{}",
        String::from_utf8_lossy(&out.stdout)
    );
}

// ---------------------------------------------------------------------------

#[test]
fn run_accepts_verified_pack() {
    let fx = Fx::new("verified");
    fx.verified_pack(&fx.pack(), false);
    fx.local_profile_naming_pack();
    let out = fx.nono(&["run", "--dry-run", "--profile", "local", "--", "/bin/true"]);
    assert_ok(&out);
    assert!(
        String::from_utf8_lossy(&out.stderr).contains("Verified 1 pack(s)"),
        "stderr:\n{}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn run_accepts_profile_naming_an_uninstalled_pack() {
    let fx = Fx::new("missing");
    fx.local_profile_naming_pack();
    let out = fx.nono(&["run", "--dry-run", "--profile", "local", "--", "/bin/true"]);
    assert_ok(&out);
}

#[test]
fn run_accepts_a_profile_without_packs() {
    let fx = Fx::new("plain");
    fx.plain_profile();
    let out = fx.nono(&["run", "--dry-run", "--profile", "plain", "--", "/bin/true"]);
    assert_ok(&out);
}

#[test]
fn capability_query_accepts_verified_pack() {
    let fx = Fx::new("why-verified");
    fx.verified_pack(&fx.pack(), false);
    assert_allowed(&fx.why_path("acme/widget", &fx.work()));
}

#[test]
fn capability_query_accepts_verified_pack_found_by_name() {
    let fx = Fx::new("why-name");
    fx.verified_pack(&fx.pack(), false);
    assert_allowed(&fx.why_path("widget", &fx.work()));
}

#[test]
fn profile_display_accepts_verified_pack() {
    let fx = Fx::new("show-verified");
    fx.verified_pack(&fx.pack(), false);
    let out = fx.nono(&["profile", "show", "acme/widget"]);
    assert_ok(&out);
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("$WORKDIR"),
        "expected the profile's grant to be displayed\nstdout:\n{stdout}"
    );
}

#[test]
fn group_from_verified_pack_still_binds() {
    let fx = Fx::new("grp-verified");
    fx.verified_pack(&fx.pack(), true);
    fx.group_profile();
    assert_allowed(&fx.why_path("usegrp", Path::new("/tmp/nono-s2-original")));
}

#[test]
fn run_accepts_verified_pack_from_alternate_location() {
    let fx = Fx::new("legacy-verified");
    fx.verified_pack(&fx.legacy_pack(), false);
    let out = fx.nono(&["run", "--dry-run", "--profile", "acme/widget", "--", "/bin/true"]);
    assert_ok(&out);
    assert!(
        String::from_utf8_lossy(&out.stderr).contains("Verified 1 pack(s)"),
        "stderr:\n{}",
        String::from_utf8_lossy(&out.stderr)
    );
}
