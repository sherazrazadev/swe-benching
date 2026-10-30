import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../support/initial-data';
import { fixtureCsv, makeTestConfig } from '../support/harness';
import {
    createEmptyCollection,
    createFacet,
    disableProduct,
    findByName,
    idsOf,
    loadCatalogue,
    SHOP_COLLECTIONS,
    SHOP_FACETS,
    SHOP_PRODUCTS,
} from '../support/catalogue';

describe('Shop catalogue filters keep working', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(makeTestConfig(3115));
    const ids: Record<string, string> = {};

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: fixtureCsv, customerCount: 1 });
        await adminClient.asSuperAdmin();

        const catalogue = await loadCatalogue(adminClient);
        for (const product of catalogue.products) {
            ids[product.name] = product.id;
        }
        await disableProduct(adminClient, ids['Thingamajig']);

        ids['Shelf One'] = await createEmptyCollection(adminClient, 'Shelf One', 'shelf-one', false);
        ids['Shelf Two'] = await createEmptyCollection(adminClient, 'Shelf Two', 'shelf-two', false);
        ids['Hidden Shelf'] = await createEmptyCollection(adminClient, 'Hidden Shelf', 'hidden-shelf', true);

        ids['Color'] = await createFacet(adminClient, 'Color', 'color', false);
        ids['Shape'] = await createFacet(adminClient, 'Shape', 'shape', false);
        ids['Secret'] = await createFacet(adminClient, 'Secret', 'secret', true);
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('returns the public products by default', async () => {
        const result = await shopClient.query(SHOP_PRODUCTS, { options: { take: 100 } });
        expect(idsOf(result.products.items)).toEqual(
            [ids['Widget'], ids['Gadget'], ids['Doohickey'], ids['Gizmo']].sort(),
        );
    });

    it('narrows the products by a caller filter', async () => {
        const result = await shopClient.query(SHOP_PRODUCTS, {
            options: { take: 100, filter: { name: { contains: 'Gadget' } } },
        });
        expect(idsOf(result.products.items)).toEqual([ids['Gadget']]);
    });

    it('keeps OR semantics across the caller filter fields for products', async () => {
        const result = await shopClient.query(SHOP_PRODUCTS, {
            options: {
                take: 100,
                filter: { name: { contains: 'Widget' }, slug: { contains: 'gizmo' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        const returned = idsOf(result.products.items);
        expect(returned).toContain(ids['Widget']);
        expect(returned).toContain(ids['Gizmo']);
    });

    it('keeps a nested OR block in the caller filter for products', async () => {
        const result = await shopClient.query(SHOP_PRODUCTS, {
            options: {
                take: 100,
                filter: { _or: [{ name: { contains: 'Widget' } }, { name: { contains: 'Gizmo' } }] },
            },
        });
        const returned = idsOf(result.products.items);
        expect(returned).toContain(ids['Widget']);
        expect(returned).toContain(ids['Gizmo']);
    });

    it('narrows the collections by a caller filter', async () => {
        const result = await shopClient.query(SHOP_COLLECTIONS, {
            options: { take: 100, filter: { name: { contains: 'Shelf One' } } },
        });
        expect(idsOf(result.collections.items)).toEqual([ids['Shelf One']]);
    });

    it('keeps OR semantics across the caller filter fields for collections', async () => {
        const result = await shopClient.query(SHOP_COLLECTIONS, {
            options: {
                take: 100,
                filter: { name: { contains: 'Shelf One' }, slug: { contains: 'shelf-two' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        const returned = idsOf(result.collections.items);
        expect(returned).toContain(ids['Shelf One']);
        expect(returned).toContain(ids['Shelf Two']);
    });

    it('narrows the facets by a caller filter', async () => {
        const result = await shopClient.query(SHOP_FACETS, {
            options: { take: 100, filter: { name: { contains: 'Color' } } },
        });
        expect(idsOf(result.facets.items)).toEqual([ids['Color']]);
    });

    it('keeps OR semantics across the caller filter fields for facets', async () => {
        const result = await shopClient.query(SHOP_FACETS, {
            options: {
                take: 100,
                filter: { name: { contains: 'Color' }, code: { contains: 'shape' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        const returned = idsOf(result.facets.items);
        expect(returned).toContain(ids['Color']);
        expect(returned).toContain(ids['Shape']);
    });

    it('keeps the admin catalogue unfiltered and keeps admin OR semantics', async () => {
        const all = await adminClient.query(SHOP_PRODUCTS, { options: { take: 100 } });
        expect(idsOf(all.products.items)).toContain(ids['Thingamajig']);

        const or = await adminClient.query(SHOP_PRODUCTS, {
            options: {
                take: 100,
                filter: { name: { contains: 'Thingamajig' }, slug: { contains: 'gizmo' } },
                filterOperator: LogicalOperator.OR,
            },
        });
        const returned = idsOf(or.products.items);
        expect(returned).toContain(ids['Thingamajig']);
        expect(returned).toContain(ids['Gizmo']);
    });
});
