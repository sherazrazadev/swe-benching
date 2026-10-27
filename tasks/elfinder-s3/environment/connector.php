<?php
/**
 * Sample deployment shipped with the project: serve the files/ folder over the HTTP API.
 * Start it from the project root with: php -S 127.0.0.1:8080 -t .
 */
require __DIR__ . '/php/autoload.php';

$opts = array(
	'commonTempPath' => __DIR__ . '/.tmp',
	'roots' => array(
		array(
			'driver'      => 'LocalFileSystem',
			'path'        => __DIR__ . '/files/',
			'URL'         => '/files/',
			'uploadAllow' => array('image', 'text/plain'),
		),
	),
);

$connector = new elFinderConnector(new elFinder($opts));
$connector->run();
