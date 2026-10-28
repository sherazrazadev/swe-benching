<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\MultiTypedEntity;
use Spatie\SchemaOrg\Schema;

const MULTI_TYPED_TAG_OPTION = '"><script>alert("multi-typed-option")</script>';

it('does not let a supplied tag option break a multi-typed script tag', function () {
    $entity = new MultiTypedEntity();
    $entity->add(Schema::product()->name('ordinary'));
    $entity->setNonce(MULTI_TYPED_TAG_OPTION);

    $block = ScriptBlock::parse($entity->toScript());

    expect($block['attributes']['type'])->toBe('application/ld+json');
    expect($block['attributes']['nonce'])->toBe(MULTI_TYPED_TAG_OPTION);
    expect(count($block['attributes']))->toBe(2);
    expect($block['data']['name'])->toBe('ordinary');
});
