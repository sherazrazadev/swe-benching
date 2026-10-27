<?php
/**
 * Hidden-suite runner: loads every test case in a group, runs them against one fixture, and
 * writes a JUnit XML report for the verifier's score.py.
 *
 * Usage: php run.php <security|functional> <junit-xml-path>
 */

$group = isset($argv[1]) ? $argv[1] : '';
$out = isset($argv[2]) ? $argv[2] : '';
if (!in_array($group, array('security', 'functional'), true) || $out === '') {
    fwrite(STDERR, "usage: php run.php <security|functional> <junit-xml-path>\n");
    exit(2);
}

require __DIR__ . '/harness.php';

$files = glob(__DIR__ . '/../' . $group . '/*.php');
sort($files);
if (!$files) {
    fwrite(STDERR, "no tests in $group\n");
    exit(2);
}

$cases = array();
foreach ($files as $file) {
    $case = include $file;
    if (!is_array($case) || !isset($case['name']) || !isset($case['run'])) {
        fwrite(STDERR, 'invalid test file: ' . $file . "\n");
        exit(2);
    }
    $cases[] = $case;
}

$ctx = new ElFinderTestContext();
$results = array();
foreach ($cases as $case) {
    try {
        $ctx->fresh();
        call_user_func($case['run'], $ctx);
        $results[] = array('name' => $case['name'], 'status' => 'pass', 'message' => '');
    } catch (Throwable $e) {
        $results[] = array('name' => $case['name'], 'status' => 'fail', 'message' => $e->getMessage());
    }
}
$ctx->stop();

$failures = 0;
foreach ($results as $r) {
    if ($r['status'] !== 'pass') {
        $failures++;
    }
}

$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<testsuite name="' . htmlspecialchars($group, ENT_QUOTES, 'UTF-8') . '" tests="' . count($results)
    . '" failures="' . $failures . '" errors="0">' . "\n";
foreach ($results as $r) {
    $xml .= '  <testcase classname="' . htmlspecialchars($group, ENT_QUOTES, 'UTF-8')
        . '" name="' . htmlspecialchars($r['name'], ENT_QUOTES, 'UTF-8') . '">';
    if ($r['status'] === 'pass') {
        $xml .= '</testcase>' . "\n";
    } else {
        $xml .= '<failure message="' . htmlspecialchars($r['message'], ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($r['message'], ENT_QUOTES, 'UTF-8') . '</failure></testcase>' . "\n";
    }
}
$xml .= '</testsuite>' . "\n";

if (@file_put_contents($out, $xml) === false) {
    fwrite(STDERR, "cannot write $out\n");
    exit(2);
}
printf("%s: %d/%d passed\n", $group, count($results) - $failures, count($results));
exit(0);
