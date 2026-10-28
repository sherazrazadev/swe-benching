<?php

require_once dirname(__DIR__).'/support/ScriptBlock.php';

use CweBench\SchemaOrg\ScriptBlock;
use Spatie\SchemaOrg\MultiTypedEntity;
use Spatie\SchemaOrg\Product;
use Spatie\SchemaOrg\Schema;

it('merges multiple types in a multi-typed entity', function () {
    $entity = new MultiTypedEntity();
    $entity->hotelRoom()->name('The Presidential Suite');
    $entity->product()->offers(
        Schema::offer()
            ->name('One Night')
            ->price(100000.00)
            ->priceCurrency('USD')
    );

    $block = ScriptBlock::parse($entity->toScript());

    expect($block['data']['@type'])->toBe(['HotelRoom', 'Product']);
    expect($block['data']['name'])->toBe('The Presidential Suite');
    expect($block['data']['offers'])->toBe([
        '@type' => 'Offer',
        'name' => 'One Night',
        'price' => 100000,
        'priceCurrency' => 'USD',
    ]);
});

it('renders a product added to a multi-typed entity', function () {
    $entity = new MultiTypedEntity();
    $entity->add((new Product())->name('Widget'));

    $block = ScriptBlock::parse((string) $entity);

    expect($block['data']['name'])->toBe('Widget');
    expect($block['data']['@type'])->toBe(['Product']);
});
