<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Graph;
use Spatie\SchemaOrg\Schema;

it('keeps references and nodes working in a graph', function () {
    $graph = new Graph();

    $graph->blogPosting()
        ->identifier('https://example.com/blog/my-post/#blogPosting')
        ->author($graph->organization()->name('organization')->referenced())
        ->publisher($graph->organization()->url('https://example.com')->referenced());

    $graph->organization()
        ->identifier('https://example.com/#organization')
        ->email('contact@example.com');

    $block = ScriptBlock::parse($graph->toScript());

    expect($block['data']['@context'])->toBe('https://schema.org');
    expect($block['data']['@graph'][0]['author'])->toBe([
        '@id' => 'https://example.com/#organization',
    ]);
    expect($block['data']['@graph'][0]['publisher'])->toBe([
        '@id' => 'https://example.com/#organization',
    ]);
    expect($block['data']['@graph'][1]['name'])->toBe('organization');
});

it('keeps hide and show working', function () {
    $graph = new Graph();
    $graph->organization()->name('organization');
    $graph->hide(\Spatie\SchemaOrg\Organization::class);

    expect(ScriptBlock::parse($graph->toScript())['data']['@graph'])->toBe([]);

    $graph->show(\Spatie\SchemaOrg\Organization::class);

    expect(ScriptBlock::parse($graph->toScript())['data']['@graph'][0]['name'])->toBe('organization');
});

it('keeps a custom graph context working', function () {
    $graph = new Graph('https://example.com/context');

    $block = ScriptBlock::parse($graph->toScript());

    expect($block['data']['@context'])->toBe('https://example.com/context');
});
