import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../support/initial-data';
import { fixtureCsv, makeTestConfig } from '../support/harness';
import {
    disableVariant,
    findByName,
    idsOf,
    loadCatalogue,
    SHOP_PRODUCT_VARIANTS,
} from '../support/catalogue';

describe('Product variant lists', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(makeTestConfig(3113));
    let productId: string;
    let disabledVariantId: string;

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: fixtureCsv, customerCount: 1 });
        await adminClient.asSuperAdmin();

        const catalogue = await loadCatalogue(adminClient);
        const widget = findByName(catalogue.products, 'Widget');
        productId = widget.id;
        disabledVariantId = findByName(widget.variants, 'Widget Small').id;
        await disableVariant(adminClient, disabledVariantId);
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('does not return a disabled variant when the caller combines filters with OR', async () => {
        let ids: string[] = [];
        try {
            const result = await shopClient.query(SHOP_PRODUCT_VARIANTS, {
                id: productId,
                options: {
                    take: 100,
                    filter: { name: { contains: 'Widget Small' }, sku: { contains: 'no-such-sku' } },
                    filterOperator: LogicalOperator.OR,
                },
            });
            ids = idsOf(result.product.variantList.items);
        } catch (error) {
            ids = [];
        }
        expect(ids).not.toContain(disabledVariantId);
    });
});
