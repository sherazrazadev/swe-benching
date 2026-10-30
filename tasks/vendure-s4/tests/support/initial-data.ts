import { LanguageCode } from '@vendure/common/lib/generated-types';
import { InitialData } from '@vendure/core/dist/data-import/index';

export const initialData: InitialData = {
    defaultLanguage: LanguageCode.en,
    defaultZone: 'Europe',
    taxRates: [{ name: 'Standard Tax', percentage: 20 }],
    shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
    paymentMethods: [],
    countries: [
        { name: 'Austria', code: 'AT', zone: 'Europe' },
        { name: 'United Kingdom', code: 'GB', zone: 'Europe' },
    ],
    collections: [],
};
