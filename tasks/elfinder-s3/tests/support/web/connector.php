<?php
/**
 * Test deployment of the file manager: one local volume in front of a throw-away folder, with the
 * server's scratch area beside it. The paths arrive from the harness, so the suite exercises the
 * product code in /workspace exactly as a normal deployment would.
 */

$base = getenv('EF_PRODUCT_ROOT');
if (!$base) {
	$base = '/workspace';
}
require rtrim($base, DIRECTORY_SEPARATOR) . '/php/autoload.php';

$root = getenv('EF_FIXTURE_ROOT');
$tmp = getenv('EF_FIXTURE_TMP');
if (!$root || !$tmp) {
	http_response_code(500);
	echo 'fixture is not configured';
	exit;
}

$options = array('commonTempPath' => $tmp);
$options['roots'] = array(
	array(
		'path'          => $root . '/',
		'driver' => 'LocalFileSystem',
		'winHashFix'    => false,
		'uploadOrder'   => array('deny','allow'),
		'uploadAllow'   => array('image','text/plain'),
	),
);

$connector = new elFinderConnector(new elFinder($options));
$connector->run();
