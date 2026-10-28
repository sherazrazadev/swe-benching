<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';
require_once dirname(__DIR__).'/support/GeneratorHarness.php';

use CweBench\SchemaOrg\GeneratorHarness;
use CweBench\SchemaOrg\ScriptBlock;

it('still generates every builder and renders ordinary values', function () {
    $destination = GeneratorHarness::generate();

    try {
        foreach (['BaseType', 'Graph', 'MultiTypedEntity', 'ReferencedType', 'Schema'] as $class) {
            expect(is_file($destination.'/src/'.$class.'.php'))->toBeTrue();
        }

        $body = ScriptBlock::parse(GeneratorHarness::render($destination, 'body', 'Spatie'));
        expect($body['data']['name'])->toBe('Spatie');
        expect($body['data']['@type'])->toBe('GeneratedProbeType');

        $graph = ScriptBlock::parse(GeneratorHarness::render($destination, 'graph', 'Spatie'));
        expect($graph['data']['@graph'][0]['name'])->toBe('Spatie');

        $entity = ScriptBlock::parse(GeneratorHarness::render($destination, 'multi-typed', 'Spatie'));
        expect($entity['data']['name'])->toBe('Spatie');

        $reference = ScriptBlock::parse(GeneratorHarness::render($destination, 'reference', '#1'));
        expect($reference['data'])->toBe(['@id' => '#1']);

        $option = ScriptBlock::parse(GeneratorHarness::render($destination, 'option-type', 'abc123'));
        expect($option['attributes']['nonce'])->toBe('abc123');
    } finally {
        GeneratorHarness::cleanup($destination);
    }
});
