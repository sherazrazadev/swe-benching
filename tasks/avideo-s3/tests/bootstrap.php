<?php
/**
 * Bootstrap for the hidden suites.
 *
 * Installs the lightweight platform boot where the product expects the generated configuration,
 * then loads the shared harness. Nothing here imports or copies the plugin's own logic; every
 * suite drives the real HTTP entry points of the checkout under test.
 */
$root = getenv('CWE_APP_ROOT');
if (empty($root)) {
    $root = '/workspace';
}
$root = rtrim($root, '/');
putenv('CWE_APP_ROOT=' . $root);
define('CWE_ROOT', $root);

$videos = $root . '/videos';
if (!is_dir($videos)) {
    @mkdir($videos, 0775, true);
}
if (!copy(__DIR__ . '/support/configuration.php', $videos . '/configuration.php')) {
    fwrite(STDERR, "bootstrap: cannot install the platform boot into {$videos}\n");
    exit(1);
}

require_once __DIR__ . '/support/AnetHarness.php';
require_once __DIR__ . '/support/AnetTestCase.php';
