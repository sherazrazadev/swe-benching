<?php
/**
 * Runs one hidden group with the project's own Pest runner and writes JUnit XML.
 *
 * Usage: php run.php <security|functional> <junit-xml-path>
 *
 * The functional group also runs the project's own tests for the rendered area, so a fix that
 * breaks existing behaviour cannot pass.
 */

$group = $argv[1] ?? '';
$out = $argv[2] ?? '';

if (! in_array($group, ['security', 'functional'], true) || $out === '') {
    fwrite(STDERR, "usage: php run.php <security|functional> <junit-xml-path>\n");
    exit(2);
}

$hidden = dirname(__DIR__);          // /workspace/.htests
$root = dirname($hidden);            // /workspace
$pest = $root.'/vendor/bin/pest';
$autoload = $root.'/vendor/autoload.php';

foreach ([$pest, $autoload, __DIR__.'/ScriptBlock.php', __DIR__.'/GeneratorHarness.php'] as $required) {
    if (! is_file($required)) {
        fwrite(STDERR, "missing {$required}\n");
        exit(2);
    }
}

$suites = ['    <directory>'.htmlspecialchars($hidden.'/'.$group, ENT_XML1).'</directory>'];

if ($group === 'functional') {
    // The project's own tests for the rendered area. The whole-suite analysis smoke test is
    // omitted: it reflects over every generated class and is not part of this surface.
    foreach (['BaseTypeTest.php', 'GraphTest.php', 'MultiTypedEntityTest.php', 'GraphIdentifierTest.php', 'GeneratedTypeSmokeTest.php'] as $file) {
        $suites[] = '    <file>'.htmlspecialchars($root.'/tests/'.$file, ENT_XML1).'</file>';
    }
}

$config = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
    .'<phpunit bootstrap="'.htmlspecialchars($autoload, ENT_XML1).'"'."\n"
    .'         colors="false" cacheDirectory="'.htmlspecialchars(sys_get_temp_dir().'/schema-org-s2-pest-cache', ENT_XML1).'">'."\n"
    .'  <testsuites>'."\n"
    .'    <testsuite name="'.htmlspecialchars($group, ENT_XML1).'">'."\n"
    .implode("\n", $suites)."\n"
    .'    </testsuite>'."\n"
    .'  </testsuites>'."\n"
    .'</phpunit>'."\n";

$configPath = tempnam(sys_get_temp_dir(), 'schema-org-s2-phpunit-').'.xml';
file_put_contents($configPath, $config);

$command = escapeshellarg(PHP_BINARY)
    .' -d memory_limit=768M'
    .' '.escapeshellarg($pest)
    .' -c '.escapeshellarg($configPath)
    .' --log-junit '.escapeshellarg($out)
    .' --colors=never';

passthru($command, $status);

@unlink($configPath);

exit($status === 0 ? 0 : 1);
