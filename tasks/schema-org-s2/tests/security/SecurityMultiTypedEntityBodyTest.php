<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\MultiTypedEntity;
use Spatie\SchemaOrg\Schema;

const MULTI_TYPED_CLOSING_VALUE = '</script><script>alert("multi-typed")</script>';

it('keeps a script-closing node value inside a multi-typed block', function () {
    $entity = new MultiTypedEntity();
    $entity->add(Schema::product()->name(MULTI_TYPED_CLOSING_VALUE));

    $block = ScriptBlock::parse($entity->toScript());

    expect($block['attributes'])->toBe(['type' => 'application/ld+json']);
    expect($block['data']['name'])->toBe(MULTI_TYPED_CLOSING_VALUE);
});

it('keeps a script-closing node identifier inside a multi-typed block', function () {
    $entity = new MultiTypedEntity();
    $entity->add(Schema::product()->identifier(MULTI_TYPED_CLOSING_VALUE));

    $block = ScriptBlock::parse((string) $entity);

    expect($block['data']['@id'])->toBe(MULTI_TYPED_CLOSING_VALUE);
});
