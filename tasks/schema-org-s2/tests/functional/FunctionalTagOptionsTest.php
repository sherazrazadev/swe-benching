<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Product;

it('renders an ordinary tag option exactly as supplied', function () {
    $type = new Product();
    $type->name('ordinary');

    $returned = $type->setNonce('dGVzdC1ub25jZQ==');

    expect($returned)->toBe($type);

    $block = ScriptBlock::parse($type->toScript());

    expect($block['attributes'])->toBe([
        'type' => 'application/ld+json',
        'nonce' => 'dGVzdC1ub25jZQ==',
    ]);
    expect($block['data']['name'])->toBe('ordinary');
});

it('leaves the tag without a tag option when none was set', function () {
    $type = new Product();
    $type->name('ordinary');

    $block = ScriptBlock::parse($type->toScript());

    expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
});

it('keeps an ordinary tag option on graphs and multi-typed entities', function () {
    $graph = new \Spatie\SchemaOrg\Graph();
    $graph->add(\Spatie\SchemaOrg\Schema::product()->name('ordinary'));
    $graph->setNonce('abc123');

    $graphBlock = ScriptBlock::parse($graph->toScript());
    expect($graphBlock['attributes']['nonce'])->toBe('abc123');

    $entity = new \Spatie\SchemaOrg\MultiTypedEntity();
    $entity->add(\Spatie\SchemaOrg\Schema::product()->name('ordinary'));
    $entity->setNonce('abc123');

    $entityBlock = ScriptBlock::parse($entity->toScript());
    expect($entityBlock['attributes']['nonce'])->toBe('abc123');
});
