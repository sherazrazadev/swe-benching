<?php
/**
 * Verifier-owned runner. Starts the product on loopback, runs every *Test class in the given
 * directory, and writes a JUnit XML file. No product code is loaded here.
 *
 *   php run.php <tests-dir> <out.xml>
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__.'/HttpCase.php';

$dir = isset($argv[1]) ? $argv[1] : '';
$out = isset($argv[2]) ? $argv[2] : '';
$workspace = getenv('PSI_WORKSPACE');
if (!is_string($workspace) || $workspace === '') {
    $workspace = '/workspace';
}
$port = (int) (getenv('PSI_TEST_PORT') ?: '18090');

function write_junit($out, $name, array $cases)
{
    $failures = 0;
    foreach ($cases as $case) {
        if ($case['status'] !== 'pass') {
            $failures++;
        }
    }
    $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuites>\n";
    $xml .= '<testsuite name="'.htmlspecialchars($name, ENT_QUOTES | ENT_XML1, 'UTF-8').'" tests="'
        .count($cases).'" failures="'.$failures.'" errors="0">'."\n";
    foreach ($cases as $case) {
        $class = htmlspecialchars($case['class'], ENT_QUOTES | ENT_XML1, 'UTF-8');
        $method = htmlspecialchars($case['name'], ENT_QUOTES | ENT_XML1, 'UTF-8');
        $xml .= '  <testcase classname="'.$class.'" name="'.$method.'"';
        if ($case['status'] === 'pass') {
            $xml .= "/>\n";
        } else {
            $msg = htmlspecialchars($case['msg'], ENT_QUOTES | ENT_XML1, 'UTF-8');
            $xml .= ">\n    <failure message=\"".$msg.'"/>'."\n  </testcase>\n";
        }
    }
    $xml .= "</testsuite>\n</testsuites>\n";
    if ($out !== '') {
        file_put_contents($out, $xml);
    }
    return $failures;
}

// ---- product server -------------------------------------------------------------------
$log = tempnam(sys_get_temp_dir(), 'psi-server-');
$descriptors = array(
    0 => array('file', '/dev/null', 'r'),
    1 => array('file', $log, 'a'),
    2 => array('file', $log, 'a'),
);
$proc = proc_open(array(PHP_BINARY, '-S', '127.0.0.1:'.$port, '-t', $workspace), $descriptors, $pipes, $workspace);
if (!is_resource($proc)) {
    write_junit($out, basename($dir), array(array(
        'class' => 'Verifier', 'name' => 'server', 'status' => 'fail',
        'msg' => 'the product server did not start',
    )));
    exit(2);
}
register_shutdown_function(function () use ($proc) {
    @proc_terminate($proc, 9);
});

$ready = false;
for ($i = 0; $i < 100; $i++) {
    $fp = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.25);
    if ($fp) {
        fclose($fp);
        $ready = true;
        break;
    }
    usleep(100000);
}
if (!$ready) {
    write_junit($out, basename($dir), array(array(
        'class' => 'Verifier', 'name' => 'server', 'status' => 'fail',
        'msg' => 'the product server did not become ready on port '.$port,
    )));
    exit(2);
}

HttpCase::configure($workspace, $port);

// ---- run the tests --------------------------------------------------------------------
$files = glob(rtrim($dir, '/').'/*Test.php');
sort($files);
foreach ($files as $file) {
    require_once $file;
}

$cases = array();
foreach (get_declared_classes() as $class) {
    if (substr($class, -4) !== 'Test') {
        continue;
    }
    $reflection = new ReflectionClass($class);
    if ($reflection->isAbstract() || !$reflection->isSubclassOf('HttpCase')) {
        continue;
    }
    $instance = $reflection->newInstance();
    foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
        if (strpos($method->getName(), 'test') !== 0) {
            continue;
        }
        $case = array('class' => $class, 'name' => $method->getName(), 'status' => 'pass', 'msg' => '');
        try {
            $instance->setUp();
            $instance->{$method->getName()}();
        } catch (Throwable $t) {
            $case['status'] = 'fail';
            $case['msg'] = get_class($t).': '.$t->getMessage();
        }
        try {
            $instance->tearDown();
        } catch (Throwable $t) {
            // A broken cleanup must not turn a passing test into an error.
        }
        $cases[] = $case;
    }
}

if (count($cases) === 0) {
    $cases[] = array(
        'class' => 'Verifier', 'name' => 'discovery', 'status' => 'fail',
        'msg' => 'no test classes were found in '.$dir,
    );
}

$failures = write_junit($out, basename($dir), $cases);
exit($failures === 0 ? 0 : 1);
