import { LogicalOperator } from '@vendure/common/lib/generated-types';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../support/initial-data';
import { fixtureCsv, makeTestConfig } from '../support/harness';
import {
    disableProduct,
    disableVariant,
    findByName,
    idsOf,
    loadCatalogue,
    SHOP_VARIANT_LIST,
} from '../support/catalogue';

describe('Shop variant listing', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(makeTestConfig(3114));
    let disabledProductVariantId: string;
    let disabledVariantId: string;

    beforeAll(async () => {
        await server.init({ initialData, productsCsvPath: fixtureCsv, customerCount: 1 });
        await adminClient.asSuperAdmin();

        const catalogue = await loadCatalogue(adminClient);
        const gadget = findByName(catalogue.products, 'Gadget');
        disabledProductVariantId = gadget.variants[0].id;
        await disableProduct(adminClient, gadget.id);

        const widget = findByName(catalogue.products, 'Widget');
        disabledVariantId = findByName(widget.variants, 'Widget Small').id;
        await disableVariant(adminClient, disabledVariantId);
    }, 120000);

    afterAll(async () => {
        await server.destroy();
    });

    it('does not return variants of a disabled product', async () => {
        let ids: string[] = [];
        try {
            const result = await shopClient.query(SHOP_VARIANT_LIST, { options: { take: 100 } });
            ids = idsOf(result.productVariants.items);
        } catch (error) {
            ids = [];
        }
        expect(ids).not.toContain(disabledProductVariantId);
    });

    it('does not return a disabled variant when the caller combines filters with OR', async () => {
        let ids: string[] = [];
        try {
            const result = await shopClient.query(SHOP_VARIANT_LIST, {
                options: {
                    take: 100,
                    filter: { name: { contains: 'Widget Small' }, sku: { contains: 'no-such-sku' } },
                    filterOperator: LogicalOperator.OR,
                },
            });
            ids = idsOf(result.productVariants.items);
        } catch (error) {
            ids = [];
        }
        expect(ids).not.toContain(disabledVariantId);
    });
});
