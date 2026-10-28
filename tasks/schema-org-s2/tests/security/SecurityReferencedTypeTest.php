<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\Schema;

const REFERENCE_CLOSING_VALUE = '</script><script>alert("reference")</script>';

it('keeps a script-closing identifier inside a reference block', function () {
    $type = Schema::product();
    $type->identifier(REFERENCE_CLOSING_VALUE);

    $block = ScriptBlock::parse($type->referenced()->toScript());

    expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
    expect($block['data'])->toBe(['@id' => REFERENCE_CLOSING_VALUE]);
});

it('keeps a script-closing identifier inside a reference cast to a string', function () {
    $type = Schema::product();
    $type->identifier(REFERENCE_CLOSING_VALUE);

    $block = ScriptBlock::parse((string) $type->referenced());

    expect($block['data'])->toBe(['@id' => REFERENCE_CLOSING_VALUE]);
});
