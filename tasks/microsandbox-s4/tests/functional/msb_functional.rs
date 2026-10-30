//! Hidden functional suite: the sandbox still starts, keeps its identity
//! visible to the operator, and the launched process still receives the
//! complete configuration.

mod msb_support;

use microsandbox::LogLevel;
use microsandbox::runtime::SpawnMode;
use microsandbox::sandbox::RlimitResource;
use msb_support::{base, spawn_and_dump, value_delivered};

fn assert_delivered(dump: &msb_support::Dump, marker: &str) {
    assert!(
        value_delivered(dump, marker),
        "configured value {marker} never reached the launched process"
    );
}

#[tokio::test]
async fn a_normal_sandbox_starts_and_stays_identifiable() {
    let config = base("fun-labels")
        .log_level(LogLevel::Debug)
        .env("APP_MODE", "production-xyz")
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;

    assert!(dump.argv_pair("--name", "fun-labels"), "sandbox name must stay visible");
    assert!(dump.argv_pair("--sandbox-id", "42"), "sandbox id must stay visible");
    assert!(dump.argv_pair("--vcpus", "1"), "cpu count must stay visible");
    assert!(dump.argv_pair("--memory-mib", "512"), "memory size must stay visible");
    assert!(dump.argv.iter().any(|arg| arg == "--debug"), "log level must stay visible");
}

#[tokio::test]
async fn the_complete_configuration_reaches_the_launched_process() {
    let config = base("fun-config")
        .env("APP_MODE", "production-xyz")
        .workdir("/srv/app")
        .user("1000:1000")
        .rlimit(RlimitResource::Nofile, 1024)
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;

    for marker in ["production-xyz", "/srv/app", "1000:1000", "nofile=1024:1024"] {
        assert_delivered(&dump, marker);
    }
}

#[tokio::test]
async fn a_network_secret_still_takes_effect() {
    let config = base("fun-net")
        .secret_env("PROXY_TOKEN", "msb-fun-net-value-1a2b3c", "api.example.com")
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    assert_delivered(&dump, "msb-fun-net-value-1a2b3c");
}

#[tokio::test]
async fn a_startup_workload_still_takes_effect() {
    let config = base("fun-start")
        .env("WORKLOAD_TOKEN", "msb-fun-start-value-4d5e6f")
        .persistent_initial_command(["/bin/sh", "-lc", "run-workload"])
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    for marker in ["/bin/sh", "-lc", "run-workload", "msb-fun-start-value-4d5e6f"] {
        assert_delivered(&dump, marker);
    }
}

#[tokio::test]
async fn an_init_handoff_still_takes_effect() {
    let config = base("fun-init")
        .init_with("/sbin/init-probe", |init| init.env("INIT_TOKEN", "msb-fun-init-value-7a8b9c"))
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    for marker in ["/sbin/init-probe", "msb-fun-init-value-7a8b9c"] {
        assert_delivered(&dump, marker);
    }
}

#[tokio::test]
async fn detached_sandboxes_still_start_and_receive_their_configuration() {
    let config = base("fun-detached")
        .env("APP_MODE", "detached-mode-xyz")
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Detached).await;

    assert!(dump.argv_pair("--name", "fun-detached"), "sandbox name must stay visible");
    assert_delivered(&dump, "detached-mode-xyz");
}
