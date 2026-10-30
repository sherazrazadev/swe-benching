import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../support/initial-data';
import { fixtureCsv, makeTestConfig } from '../support/harness';
import {
    ADMIN_PRODUCT_VARIANTS,
    createCollectionForFacetValue,
    disableProduct,
    disableVariant,
    findByName,
    idsOf,
    loadCatalogue,
    SHOP_COLLECTION_VARIANTS,
    SHOP_PRODUCT_VARIANTS,
    SHOP_VARIANT_LIST,
} from '../support/catalogue';

describe('Shop variant visibility keeps working', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(makeTestConfig(3116));
    let widgetId: string;
    let shelfId: string;
    let smallId: string;
    let largeId: string;
    let publicVariantIds: string[] = [];

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: fixtureCsv, customerCount: 1 });
        await adminClient.asSuperAdmin();

        const catalogue = await loadCatalogue(adminClient);
        const widget = findByName(catalogue.products, 'Widget');
        widgetId = widget.id;
        smallId = findByName(widget.variants, 'Widget Small').id;
        largeId = findByName(widget.variants, 'Widget Large').id;

        const category = findByName(catalogue.facets, 'category');
        const widgetValue = findByName(category.values, 'widget');
        shelfId = await createCollectionForFacetValue(adminClient, 'Widget Shelf', 'widget-shelf', widgetValue.id);

        const gadget = findByName(catalogue.products, 'Gadget');
        await disableProduct(adminClient, gadget.id);
        await disableVariant(adminClient, smallId);

        publicVariantIds = [largeId, findByName(catalogue.products, 'Doohickey').variants[0].id,
            findByName(catalogue.products, 'Gizmo').variants[0].id];
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('returns the enabled variants of a collection by default', async () => {
        const result = await shopClient.query(SHOP_COLLECTION_VARIANTS, {
            id: shelfId,
            options: { take: 100 },
        });
        expect(idsOf(result.collection.productVariants.items)).toEqual([largeId]);
    });

    it('keeps OR semantics across the caller filter fields for collection variants', async () => {
        const result = await shopClient.query(SHOP_COLLECTION_VARIANTS, {
            id: shelfId,
            options: {
                take: 100,
                filter: { name: { contains: 'Small' }, sku: { contains: 'SKU-W-L' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        expect(idsOf(result.collection.productVariants.items)).toContain(largeId);
    });

    it('returns the enabled variants of a product by default', async () => {
        const result = await shopClient.query(SHOP_PRODUCT_VARIANTS, {
            id: widgetId,
            options: { take: 100 },
        });
        expect(idsOf(result.product.variants)).toEqual([largeId]);
        expect(idsOf(result.product.variantList.items)).toEqual([largeId]);
    });

    it('keeps OR semantics across the caller filter fields for a product variant list', async () => {
        const result = await shopClient.query(SHOP_PRODUCT_VARIANTS, {
            id: widgetId,
            options: {
                take: 100,
                filter: { name: { contains: 'Small' }, sku: { contains: 'SKU-W-L' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        expect(idsOf(result.product.variantList.items)).toContain(largeId);
    });

    it('returns the public variants from the shop variant listing', async () => {
        const result = await shopClient.query(SHOP_VARIANT_LIST, { options: { take: 100 } });
        const returned = idsOf(result.productVariants.items);
        for (const id of publicVariantIds) {
            expect(returned).toContain(id);
        }
    });

    it('narrows the shop variant listing by a caller filter', async () => {
        const result = await shopClient.query(SHOP_VARIANT_LIST, {
            options: { take: 100, filter: { sku: { contains: 'SKU-W-L' } } },
        });
        expect(idsOf(result.productVariants.items)).toEqual([largeId]);
    });

    it('keeps OR semantics across the caller filter fields for the shop variant listing', async () => {
        const result = await shopClient.query(SHOP_VARIANT_LIST, {
            options: {
                take: 100,
                filter: { name: { contains: 'Small' }, sku: { contains: 'SKU-W-L' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        expect(idsOf(result.productVariants.items)).toContain(largeId);
    });

    it('keeps disabled variants visible to administrators', async () => {
        const result = await adminClient.query(ADMIN_PRODUCT_VARIANTS, { id: widgetId });
        expect(idsOf(result.product.variantList.items)).toContain(smallId);
    });
});
