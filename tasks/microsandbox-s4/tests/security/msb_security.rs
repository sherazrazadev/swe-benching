//! Hidden security suite: secret values configured for a sandbox must not be
//! readable from the command line of the host process the library launches.

mod msb_support;

use microsandbox::runtime::SpawnMode;
use msb_support::{base, secret_on_command_line, spawn_and_dump};

const ENV_SECRET: &str = "msb-env-secret-7f3a91";
const NET_SECRET: &str = "msb-net-secret-2c8e44";
const START_SECRET: &str = "msb-start-secret-5d1b70";
const DETACH_SECRET: &str = "msb-detach-secret-9a6c22";
const INIT_SECRET: &str = "msb-init-secret-4e8f13";

fn assert_hidden(dump: &msb_support::Dump, marker: &str) {
    assert!(
        !secret_on_command_line(dump, marker),
        "secret {marker} is readable from the launched process command line"
    );
}

#[tokio::test]
async fn environment_secret_is_not_readable_from_the_launch_command_line() {
    let config = base("sec-env")
        .env("API_TOKEN", ENV_SECRET)
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    assert_hidden(&dump, ENV_SECRET);
}

#[tokio::test]
async fn network_secret_is_not_readable_from_the_launch_command_line() {
    let config = base("sec-net")
        .secret_env("PROXY_TOKEN", NET_SECRET, "api.example.com")
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    assert_hidden(&dump, NET_SECRET);
}

#[tokio::test]
async fn startup_workload_secret_is_not_readable_from_the_launch_command_line() {
    let config = base("sec-start")
        .env("WORKLOAD_TOKEN", START_SECRET)
        .persistent_initial_command(["/bin/sh", "-lc", "run-workload"])
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    assert_hidden(&dump, START_SECRET);
}

#[tokio::test]
async fn detached_secret_is_not_readable_from_the_launch_command_line() {
    let config = base("sec-detached")
        .env("DETACH_TOKEN", DETACH_SECRET)
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Detached).await;
    assert_hidden(&dump, DETACH_SECRET);
}

#[tokio::test]
async fn init_handoff_secret_is_not_readable_from_the_launch_command_line() {
    let config = base("sec-init")
        .init_with("/sbin/init-probe", |init| init.env("INIT_TOKEN", INIT_SECRET))
        .build()
        .await
        .expect("config builds");
    let dump = spawn_and_dump(&config, SpawnMode::Attached).await;
    assert_hidden(&dump, INIT_SECRET);
}
