<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';
require_once dirname(__DIR__).'/support/GeneratorHarness.php';

use CweBench\SchemaOrg\GeneratorHarness;
use CweBench\SchemaOrg\ScriptBlock;

const GENERATED_CLOSING_VALUE = '</script><script>alert("generated")</script>';
const GENERATED_TAG_OPTION = '"><script>alert("generated-option")</script>';

it('generates a type renderer that keeps a script-closing value inside the block', function () {
    $destination = GeneratorHarness::generate();

    try {
        $block = ScriptBlock::parse(GeneratorHarness::render($destination, 'body', GENERATED_CLOSING_VALUE));

        expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
        expect($block['data']['name'])->toBe(GENERATED_CLOSING_VALUE);
    } finally {
        GeneratorHarness::cleanup($destination);
    }
});

it('generates a graph renderer that keeps a script-closing value inside the block', function () {
    $destination = GeneratorHarness::generate();

    try {
        $block = ScriptBlock::parse(GeneratorHarness::render($destination, 'graph', GENERATED_CLOSING_VALUE));

        expect($block['data']['@graph'][0]['name'])->toBe(GENERATED_CLOSING_VALUE);
    } finally {
        GeneratorHarness::cleanup($destination);
    }
});

it('generates a multi-typed renderer that keeps a script-closing value inside the block', function () {
    $destination = GeneratorHarness::generate();

    try {
        $block = ScriptBlock::parse(GeneratorHarness::render($destination, 'multi-typed', GENERATED_CLOSING_VALUE));

        expect($block['data']['name'])->toBe(GENERATED_CLOSING_VALUE);
    } finally {
        GeneratorHarness::cleanup($destination);
    }
});

it('generates a reference renderer that keeps a script-closing identifier inside the block', function () {
    $destination = GeneratorHarness::generate();

    try {
        $block = ScriptBlock::parse(GeneratorHarness::render($destination, 'reference', GENERATED_CLOSING_VALUE));

        expect($block['data'])->toBe(['@id' => GENERATED_CLOSING_VALUE]);
    } finally {
        GeneratorHarness::cleanup($destination);
    }
});

it('generates tag options that cannot break the script attributes', function () {
    $destination = GeneratorHarness::generate();

    try {
        foreach (['option-type', 'option-graph', 'option-multi-typed'] as $case) {
            $block = ScriptBlock::parse(GeneratorHarness::render($destination, $case, GENERATED_TAG_OPTION));

            expect($block['attributes']['nonce'])->toBe(GENERATED_TAG_OPTION);
            expect(count($block['attributes']))->toBe(2);
        }
    } finally {
        GeneratorHarness::cleanup($destination);
    }
});
