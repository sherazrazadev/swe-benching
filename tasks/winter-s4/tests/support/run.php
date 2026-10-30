<?php
/**
 * Hidden-suite runner: runs one group with the project's own PHPUnit and writes a JUnit XML
 * report.
 *
 * Usage: php run.php <security|functional> <junit-xml-path>
 *
 * The functional group also runs the project's own tests for the affected area, so a fix that
 * breaks ordinary template rendering cannot pass.
 */

$group = isset($argv[1]) ? $argv[1] : '';
$out = isset($argv[2]) ? $argv[2] : '';
if (!in_array($group, ['security', 'functional'], true) || $out === '') {
    fwrite(STDERR, "usage: php run.php <security|functional> <junit-xml-path>\n");
    exit(2);
}

$hiddenDir = dirname(__DIR__);          // /workspace/.htests
$root = dirname($hiddenDir);            // /workspace
$phpunit = $root . '/vendor/bin/phpunit';
$bootstrap = __DIR__ . '/bootstrap.php';

foreach ([$phpunit, $root . '/modules/system/tests/bootstrap/app.php', $bootstrap] as $required) {
    if (!is_file($required)) {
        fwrite(STDERR, "missing $required\n");
        exit(2);
    }
}

foreach (['storage/framework/cache', 'storage/framework/sessions', 'storage/framework/views',
          'storage/cms/cache', 'storage/cms/twig', 'storage/cms/combine', 'storage/logs'] as $dir) {
    @mkdir($root . '/' . $dir, 0777, true);
}

$suites = ['    <directory>' . htmlspecialchars($hiddenDir . '/' . $group, ENT_XML1) . '</directory>'];
if ($group === 'functional') {
    $suites[] = '    <directory>' . htmlspecialchars($root . '/modules/system/tests/twig', ENT_XML1) . '</directory>';
}

$config = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
    . '<phpunit backupGlobals="false" backupStaticAttributes="false" colors="false"'
    . ' convertErrorsToExceptions="true" convertNoticesToExceptions="true"'
    . ' convertWarningsToExceptions="true" processIsolation="false" stopOnFailure="false"'
    . ' bootstrap="' . htmlspecialchars($bootstrap, ENT_XML1) . '">' . "\n"
    . '  <testsuites>' . "\n"
    . '    <testsuite name="' . htmlspecialchars($group, ENT_XML1) . '">' . "\n"
    . implode("\n", $suites) . "\n"
    . '    </testsuite>' . "\n"
    . '  </testsuites>' . "\n"
    . '  <php>' . "\n"
    . '    <env name="APP_ENV" value="testing"/>' . "\n"
    . '    <env name="CACHE_DRIVER" value="array"/>' . "\n"
    . '    <env name="SESSION_DRIVER" value="array"/>' . "\n"
    . '  </php>' . "\n"
    . '</phpunit>' . "\n";

$configPath = tempnam(sys_get_temp_dir(), 'winter-phpunit-') . '.xml';
file_put_contents($configPath, $config);

$command = escapeshellarg(PHP_BINARY)
    . ' ' . escapeshellarg($phpunit)
    . ' -c ' . escapeshellarg($configPath)
    . ' --log-junit ' . escapeshellarg($out);

passthru($command, $status);

@unlink($configPath);
exit($status === 0 ? 0 : 1);
