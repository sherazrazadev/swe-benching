<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Product;

const BASE_TYPE_TAG_OPTION = '"><script>alert("option")</script>';

it('does not let a supplied tag option break the script attributes', function () {
    $type = new Product();
    $type->name('ordinary');
    $type->setNonce(BASE_TYPE_TAG_OPTION);

    $block = ScriptBlock::parse($type->toScript());

    expect($block['attributes']['type'])->toBe('application/ld+json');
    expect($block['attributes']['nonce'])->toBe(BASE_TYPE_TAG_OPTION);
    expect(count($block['attributes']))->toBe(2);
    expect($block['data']['name'])->toBe('ordinary');
});

it('does not let a quote in a tag option open another attribute', function () {
    $type = new Product();
    $type->name('ordinary');
    $type->setNonce('plain" onload="alert(1)');

    $block = ScriptBlock::parse($type->toScript());

    expect($block['attributes']['nonce'])->toBe('plain" onload="alert(1)');
    expect(count($block['attributes']))->toBe(2);
});
