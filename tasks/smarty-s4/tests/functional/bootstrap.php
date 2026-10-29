<?php
$product = getenv('SMARTY_PRODUCT_DIR') ?: '/workspace';
require $product . '/vendor/autoload.php';
require __DIR__ . '/../support/SmartyS4FakeOrigin.php';
require __DIR__ . '/../support/SmartyS4RemoteTestCase.php';
SmartyS4FakeOrigin::register();
