<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Product;

const RAW_VALUE = "<tag> & \"quoted\" 'single' / ünïcode";

it('keeps raw characters in the array form', function () {
    $type = new Product();
    $type->name(RAW_VALUE);

    expect($type->toArray()['name'])->toBe(RAW_VALUE);
});

it('keeps the plain JSON form decoding back to the raw values', function () {
    $type = new Product();
    $type->name(RAW_VALUE);

    $decoded = json_decode(json_encode($type), true);

    expect($decoded['name'])->toBe(RAW_VALUE);
});

it('keeps slashes and non-ascii characters readable in the rendered body', function () {
    $type = new Product();
    $type->url('https://example.com/catalog/grüße');

    $block = ScriptBlock::parse($type->toScript());

    expect($block['body'])->toContain('https://example.com/catalog/grüße');
    expect($block['data']['url'])->toBe('https://example.com/catalog/grüße');
});

it('renders ordinary values without changing them', function () {
    $type = new Product();
    $type->name('Spatie');
    $type->url('https://example.com/');

    $block = ScriptBlock::parse($type->toScript());

    expect($block['data'])->toBe([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => 'Spatie',
        'url' => 'https://example.com/',
    ]);
});
