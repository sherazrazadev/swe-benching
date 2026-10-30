import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../support/initial-data';
import { fixtureCsv, makeTestConfig } from '../support/harness';
import {
    createEmptyCollection,
    disableProduct,
    findByName,
    idsOf,
    loadCatalogue,
    SHOP_COLLECTIONS,
    SHOP_FACETS,
    SHOP_PRODUCTS,
    UPDATE_FACET,
} from '../support/catalogue';

describe('Shop catalogue list queries', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(makeTestConfig(3111));
    let disabledProductId: string;
    let privateCollectionId: string;
    let privateFacetId: string;

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: fixtureCsv, customerCount: 1 });
        await adminClient.asSuperAdmin();

        const catalogue = await loadCatalogue(adminClient);
        disabledProductId = findByName(catalogue.products, 'Thingamajig').id;
        await disableProduct(adminClient, disabledProductId);

        privateCollectionId = await createEmptyCollection(adminClient, 'Private Shelf', 'private-shelf', true);

        privateFacetId = findByName(catalogue.facets, 'category').id;
        await adminClient.query(UPDATE_FACET, { id: privateFacetId, isPrivate: true });
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    async function idsFor(document: any, options: any, pick: (r: any) => Array<{ id: string }>) {
        try {
            const result = await shopClient.query(document, { options });
            return idsOf(pick(result));
        } catch (error) {
            return [] as string[];
        }
    }

    it('does not return a disabled product when the caller combines filters with OR', async () => {
        const ids = await idsFor(
            SHOP_PRODUCTS,
            {
                take: 100,
                filter: { name: { contains: 'Thingamajig' }, slug: { contains: 'no-such-slug' } },
                filterOperator: LogicalOperator.OR,
            },
            r => r.products.items,
        );
        expect(ids).not.toContain(disabledProductId);
    });

    it('does not return a private collection when the caller combines filters with OR', async () => {
        const ids = await idsFor(
            SHOP_COLLECTIONS,
            {
                take: 100,
                filter: { name: { contains: 'Private Shelf' }, slug: { contains: 'no-such-slug' } },
                filterOperator: LogicalOperator.OR,
            },
            r => r.collections.items,
        );
        expect(ids).not.toContain(privateCollectionId);
    });

    it('does not return a private facet when the caller combines filters with OR', async () => {
        const ids = await idsFor(
            SHOP_FACETS,
            {
                take: 100,
                filter: { name: { contains: 'category' }, code: { contains: 'no-such-code' } },
                filterOperator: LogicalOperator.OR,
            },
            r => r.facets.items,
        );
        expect(ids).not.toContain(privateFacetId);
    });
});
