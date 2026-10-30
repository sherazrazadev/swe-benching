import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../support/initial-data';
import { fixtureCsv, makeTestConfig } from '../support/harness';
import {
    createCollectionForFacetValue,
    disableVariant,
    findByName,
    idsOf,
    loadCatalogue,
    SHOP_COLLECTION_VARIANTS,
} from '../support/catalogue';

describe('Collection product variants', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(makeTestConfig(3112));
    let shelfId: string;
    let disabledVariantId: string;

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: fixtureCsv, customerCount: 1 });
        await adminClient.asSuperAdmin();

        const catalogue = await loadCatalogue(adminClient);
        const category = findByName(catalogue.facets, 'category');
        const widgetValue = findByName(category.values, 'widget');
        shelfId = await createCollectionForFacetValue(adminClient, 'Widget Shelf', 'widget-shelf', widgetValue.id);

        const widget = findByName(catalogue.products, 'Widget');
        disabledVariantId = findByName(widget.variants, 'Widget Small').id;
        await disableVariant(adminClient, disabledVariantId);
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('does not return a disabled variant when the caller combines filters with OR', async () => {
        let ids: string[] = [];
        try {
            const result = await shopClient.query(SHOP_COLLECTION_VARIANTS, {
                id: shelfId,
                options: {
                    take: 100,
                    filter: { name: { contains: 'Widget Small' }, sku: { contains: 'no-such-sku' } },
                    filterOperator: LogicalOperator.OR,
                },
            });
            ids = idsOf(result.collection.productVariants.items);
        } catch (error) {
            ids = [];
        }
        expect(ids).not.toContain(disabledVariantId);
    });
});
