//! A pack's content must never influence what the tool grants, reports or
//! writes until the pack is verified against its install record.
//!
//! Every case drives the real `nono` command line; expected values and cleanup
//! are computed here, in the test, with std only.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicUsize, Ordering};

// Fixed fixture content; digests are of exactly these bytes (no trailing newline).
const PROFILE_JSON: &str =
    r#"{"meta":{"name":"widget"},"filesystem":{"read":["$WORKDIR"]}}"#;
const PROFILE_SHA: &str = "45d4aa649c25c45dcd268ae2d2697fff8ffdae43aae476bff0aa19bc2a1b826c";
const GROUPS_ORIG_SHA: &str =
    "9aa29027a499107384e5b1c1af39f0b0ef8f4303787045dc8e47136adcae496b";
const GROUPS_TAMPERED: &str =
    r#"{"acme_widget_read":{"description":"tampered","allow":{"read":["/tmp/nono-s2-grant"]}}}"#;

const MANIFEST_PROFILE: &str = r#"{"schema_version":1,"name":"widget","artifacts":[{"type":"profile","path":"profile.json","install_as":"widget"}]}"#;
const MANIFEST_PROFILE_GROUPS: &str = r#"{"schema_version":1,"name":"widget","artifacts":[{"type":"profile","path":"profile.json","install_as":"widget"},{"type":"groups","path":"groups.json","prefix":"acme_widget_"}]}"#;

const PROVENANCE: &str = r#""provenance":{"signer_identity":"https://github.com/acme/repo/.github/workflows/release.yml@refs/tags/v1.0.0","repository":"acme/repo","workflow":".github/workflows/release.yml","ref":"refs/tags/v1.0.0","rekor_log_index":1,"signed_at":"2026-01-01T00:00:00Z"},"#;

static SEQ: AtomicUsize = AtomicUsize::new(0);

/// A hermetic home/config/work tree for one case.
struct Fx {
    root: PathBuf,
}

impl Fx {
    fn new(tag: &str) -> Fx {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let root = std::env::temp_dir().join(format!(
            "nono-sec-{}-{}-{}",
            tag,
            std::process::id(),
            n
        ));
        let _ = fs::remove_dir_all(&root);
        for d in ["cfg/nono/profiles", "cfg/nono/packages", "home", "work"] {
            fs::create_dir_all(root.join(d)).expect("create fixture dir");
        }
        let _ = fs::create_dir_all("/tmp/nono-s2-grant");
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

    /// Lay out an installed pack. `with_groups` adds the group artifact.
    fn installed_pack(&self, pack: &Path, with_groups: bool) {
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
            self.write(&pack.join("groups.json"), GROUPS_TAMPERED);
        }
    }

    fn stored_bundle(&self, pack: &Path) {
        self.write(&pack.join(".nono-trust.bundle"), "[]\n");
    }

    /// A lockfile entry for acme/widget with the given artifact map.
    fn seed_record(&self, artifacts_json: &str, with_provenance: bool) {
        let mut s = String::from(
            r#"{"lockfile_version":4,"registry":"r","packages":{"acme/widget":{"version":"1.0.0","installed_at":"2026-01-01T00:00:00Z","pinned":false,"#,
        );
        if with_provenance {
            s.push_str(PROVENANCE);
        }
        s.push_str(r#""artifacts":"#);
        s.push_str(artifacts_json);
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

/// The attack must be refused: a failing exit and no answer that treats the
/// pack as trusted. A crash is not a clean refusal.
fn assert_refused(out: &Output) {
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        !out.status.success(),
        "expected a refusal but the command succeeded\nstdout:\n{stdout}\nstderr:\n{stderr}"
    );
    assert!(
        !stderr.contains("panicked at"),
        "refusal crashed instead of reporting an error\nstderr:\n{stderr}"
    );
    assert!(
        !stdout.contains("ALLOWED"),
        "command refused but still answered ALLOWED\nstdout:\n{stdout}"
    );
    assert!(
        !stdout.contains("dry-run sandbox would be applied"),
        "command refused but still prepared a sandbox\nstdout:\n{stdout}"
    );
}

fn profile_record() -> String {
    format!(
        r#"{{"profiles/widget.json":{{"sha256":"{}","type":"profile"}}}}"#,
        PROFILE_SHA
    )
}

fn groups_record() -> String {
    format!(
        r#"{{"groups.json":{{"sha256":"{}","type":"groups"}}}}"#,
        GROUPS_ORIG_SHA
    )
}

// ---------------------------------------------------------------------------
// 1. An installed pack must have an install record.
// ---------------------------------------------------------------------------

#[test]
fn run_refuses_pack_without_install_record() {
    let fx = Fx::new("no-record");
    fx.installed_pack(&fx.pack(), false);
    fx.local_profile_naming_pack();
    assert_refused(&fx.nono(&[
        "run", "--dry-run", "--profile", "local", "--", "/bin/true",
    ]));
}

// ---------------------------------------------------------------------------
// 2. A recorded pack must carry its stored signature record.
// ---------------------------------------------------------------------------

#[test]
fn run_refuses_pack_without_stored_signature_record() {
    let fx = Fx::new("no-bundle");
    fx.installed_pack(&fx.pack(), false);
    fx.seed_record(&profile_record(), true);
    fx.local_profile_naming_pack();
    assert_refused(&fx.nono(&[
        "run", "--dry-run", "--profile", "local", "--", "/bin/true",
    ]));
}

// ---------------------------------------------------------------------------
// 3. A group file is content: it may not change the policy before its pack is
//    verified, and the record must cover the file.
// ---------------------------------------------------------------------------

#[test]
fn group_file_is_not_used_without_signature_record() {
    let fx = Fx::new("grp-nobundle");
    fx.installed_pack(&fx.pack(), true);
    fx.seed_record(&groups_record(), true);
    fx.group_profile();
    assert_refused(&fx.why_path("usegrp", Path::new("/tmp/nono-s2-grant")));
}

#[test]
fn group_file_is_not_used_when_the_signature_record_omits_it() {
    let fx = Fx::new("grp-bundle-noentry");
    fx.installed_pack(&fx.pack(), true);
    fx.stored_bundle(&fx.pack());
    fx.seed_record(&groups_record(), true);
    fx.group_profile();
    assert_refused(&fx.why_path("usegrp", Path::new("/tmp/nono-s2-grant")));
}

#[test]
fn group_file_is_not_used_when_the_record_does_not_cover_it() {
    let fx = Fx::new("grp-emptyrecord");
    fx.installed_pack(&fx.pack(), true);
    fx.stored_bundle(&fx.pack());
    fx.seed_record("{}", true);
    fx.group_profile();
    assert_refused(&fx.why_path("usegrp", Path::new("/tmp/nono-s2-grant")));
}

// ---------------------------------------------------------------------------
// 4. Read-only surfaces may not use pack content before verification either.
// ---------------------------------------------------------------------------

#[test]
fn capability_query_refuses_unverified_pack() {
    let fx = Fx::new("why-unverified");
    fx.installed_pack(&fx.pack(), false);
    assert_refused(&fx.why_path("acme/widget", &fx.work()));
}

#[test]
fn capability_query_refuses_unverified_pack_found_by_name() {
    let fx = Fx::new("why-byname");
    fx.installed_pack(&fx.pack(), false);
    fx.seed_record(&profile_record(), true);
    assert_refused(&fx.why_path("widget", &fx.work()));
}

#[test]
fn profile_display_refuses_unverified_pack() {
    let fx = Fx::new("show-unverified");
    fx.installed_pack(&fx.pack(), false);
    let out = fx.nono(&["profile", "show", "acme/widget"]);
    assert_refused(&out);
}

// ---------------------------------------------------------------------------
// 5. Packs reached through the alternate on-disk location are the same pack.
// ---------------------------------------------------------------------------

#[test]
fn run_refuses_unverified_pack_from_alternate_location() {
    let fx = Fx::new("legacy-run");
    fx.installed_pack(&fx.legacy_pack(), false);
    fx.local_profile_naming_pack();
    assert_refused(&fx.nono(&[
        "run", "--dry-run", "--profile", "local", "--", "/bin/true",
    ]));
}

#[test]
fn capability_query_refuses_unverified_pack_from_alternate_location() {
    let fx = Fx::new("legacy-why");
    fx.installed_pack(&fx.legacy_pack(), false);
    assert_refused(&fx.why_path("acme/widget", &fx.work()));
}
