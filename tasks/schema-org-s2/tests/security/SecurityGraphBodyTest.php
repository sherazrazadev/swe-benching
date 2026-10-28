<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Graph;
use Spatie\SchemaOrg\Schema;

const GRAPH_CLOSING_VALUE = '</script><script>alert("graph")</script>';

it('keeps a script-closing node value inside a graph block', function () {
    $node = Schema::product();
    $node->name(GRAPH_CLOSING_VALUE);

    $graph = new Graph();
    $graph->add($node);

    $block = ScriptBlock::parse($graph->toScript());

    expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
    expect($block['data']['@graph'])->toBe([
        ['@type' => 'Product', 'name' => GRAPH_CLOSING_VALUE],
    ]);
});

it('keeps a script-closing node identifier inside a graph block', function () {
    $node = Schema::organization();
    $node->identifier(GRAPH_CLOSING_VALUE);

    $graph = new Graph();
    $graph->add($node);

    $block = ScriptBlock::parse($graph->toScript());

    expect($block['data']['@graph'][0]['@id'])->toBe(GRAPH_CLOSING_VALUE);
});

it('keeps a script-closing context inside a graph block', function () {
    $graph = new Graph(GRAPH_CLOSING_VALUE);

    $block = ScriptBlock::parse($graph->toScript());

    expect($block['data']['@context'])->toBe(GRAPH_CLOSING_VALUE);
});
