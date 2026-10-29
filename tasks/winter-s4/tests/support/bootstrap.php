<?php
/**
 * Bootstrap for the hidden suites: the project's own test bootstrap (autoloader, module
 * registration and aliases) plus the shared hidden-case base class.
 */

require dirname(dirname(__DIR__)) . '/modules/system/tests/bootstrap/app.php';
require __DIR__ . '/harness.php';
