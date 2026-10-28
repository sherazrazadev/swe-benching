<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Product;

const SCRIPT_CLOSING_VALUE = '</script><script>alert("feed")</script>';

it('keeps a script-closing value in a plain property inside the block', function () {
    $type = new Product();
    $type->name(SCRIPT_CLOSING_VALUE);

    $block = ScriptBlock::parse($type->toScript());

    expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
    expect($block['data'])->toBe([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => SCRIPT_CLOSING_VALUE,
    ]);
});

it('keeps a script-closing value in a nested type inside the block', function () {
    $child = new Product();
    $child->name(SCRIPT_CLOSING_VALUE);

    $parent = new Product();
    $parent->addProperties(['isSimilarTo' => $child]);

    $block = ScriptBlock::parse($parent->toScript());

    expect($block['data']['isSimilarTo'])->toBe([
        '@type' => 'Product',
        'name' => SCRIPT_CLOSING_VALUE,
    ]);
});

it('keeps a script-closing value in an array property inside the block', function () {
    $type = new Product();
    $type->setProperty('keywords', [SCRIPT_CLOSING_VALUE, 'ordinary']);

    $block = ScriptBlock::parse($type->toScript());

    expect($block['data']['keywords'])->toBe([SCRIPT_CLOSING_VALUE, 'ordinary']);
});

it('keeps a script-closing identifier inside the block', function () {
    $type = new Product();
    $type->identifier(SCRIPT_CLOSING_VALUE);

    $block = ScriptBlock::parse($type->toScript());

    expect($block['data']['@id'])->toBe(SCRIPT_CLOSING_VALUE);
});

it('keeps the same guarantee when the type is cast to a string', function () {
    $type = new Product();
    $type->name(SCRIPT_CLOSING_VALUE);

    $block = ScriptBlock::parse((string) $type);

    expect($block['data']['name'])->toBe(SCRIPT_CLOSING_VALUE);
});
