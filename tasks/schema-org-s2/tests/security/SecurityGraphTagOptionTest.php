<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Graph;
use Spatie\SchemaOrg\Schema;

const GRAPH_TAG_OPTION = '"><script>alert("graph-option")</script>';

it('does not let a supplied tag option break a graph script tag', function () {
    $graph = new Graph();
    $graph->add(Schema::product()->name('ordinary'));
    $graph->setNonce(GRAPH_TAG_OPTION);

    $block = ScriptBlock::parse($graph->toScript());

    expect($block['attributes']['type'])->toBe('application/ld+json');
    expect($block['attributes']['nonce'])->toBe(GRAPH_TAG_OPTION);
    expect(count($block['attributes']))->toBe(2);
    expect($block['data']['@graph'][0]['name'])->toBe('ordinary');
});
