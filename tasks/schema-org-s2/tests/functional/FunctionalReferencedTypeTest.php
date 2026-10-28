<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Product;

it('keeps a reference as a plain identifier in the array form', function () {
    $type = new Product();
    $type->identifier('object#1');

    expect($type->referenced()->toArray())->toBe(['@id' => 'object#1']);
});

it('renders a reference block carrying the identifier', function () {
    $type = new Product();
    $type->identifier('object#1');

    $block = ScriptBlock::parse($type->referenced()->toScript());

    expect($block['data'])->toBe(['@id' => 'object#1']);
    expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
});

it('keeps a reference inside a parent type as an identifier', function () {
    $target = new Product();
    $target->identifier('#1');
    $target->name('another-object');

    $parent = new Product();
    $parent->addProperties(['isSimilarTo' => $target->referenced()]);

    $block = ScriptBlock::parse($parent->toScript());

    expect($block['data']['isSimilarTo'])->toBe(['@id' => '#1']);
});
