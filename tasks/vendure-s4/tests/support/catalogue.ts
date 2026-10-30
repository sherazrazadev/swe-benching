import gql from 'graphql-tag';

export const ADMIN_PRODUCTS = gql(`
    query AdminProducts {
        products(options: { take: 100 }) {
            items {
                id
                name
                enabled
                variants {
                    id
                    name
                    sku
                    enabled
                }
            }
        }
    }
`);

export const ADMIN_FACETS = gql(`
    query AdminFacets {
        facets(options: { take: 100 }) {
            items {
                id
                name
                code
                isPrivate
                values {
                    id
                    code
                    name
                }
            }
        }
    }
`);

export const SHOP_PRODUCTS = gql(`
    query ShopProducts($options: ProductListOptions) {
        products(options: $options) {
            totalItems
            items {
                id
                name
            }
        }
    }
`);

export const SHOP_COLLECTIONS = gql(`
    query ShopCollections($options: CollectionListOptions) {
        collections(options: $options) {
            totalItems
            items {
                id
                name
            }
        }
    }
`);

export const SHOP_FACETS = gql(`
    query ShopFacets($options: FacetListOptions) {
        facets(options: $options) {
            totalItems
            items {
                id
                name
                code
            }
        }
    }
`);

export const SHOP_COLLECTION_VARIANTS = gql(`
    query ShopCollectionVariants($id: ID!, $options: ProductVariantListOptions) {
        collection(id: $id) {
            id
            productVariants(options: $options) {
                totalItems
                items {
                    id
                    name
                    sku
                }
            }
        }
    }
`);

export const SHOP_PRODUCT_VARIANTS = gql(`
    query ShopProductVariants($id: ID!, $options: ProductVariantListOptions) {
        product(id: $id) {
            id
            variants {
                id
                name
            }
            variantList(options: $options) {
                totalItems
                items {
                    id
                    name
                    sku
                }
            }
        }
    }
`);

export const SHOP_VARIANT_LIST = gql(`
    query ShopVariantList($options: ProductVariantListOptions) {
        productVariants(options: $options) {
            totalItems
            items {
                id
                name
                sku
            }
        }
    }
`);

export const ADMIN_PRODUCT_VARIANTS = gql(`
    query AdminProductVariants($id: ID!) {
        product(id: $id) {
            id
            variants {
                id
                name
            }
            variantList(options: { take: 50 }) {
                items {
                    id
                    name
                }
            }
        }
    }
`);

export const UPDATE_PRODUCT = gql(`
    mutation UpdateProduct($id: ID!, $enabled: Boolean!) {
        updateProduct(input: { id: $id, enabled: $enabled }) {
            id
        }
    }
`);

export const UPDATE_VARIANTS = gql(`
    mutation UpdateVariants($input: [UpdateProductVariantInput!]!) {
        updateProductVariants(input: $input) {
            id
        }
    }
`);

export const CREATE_COLLECTION = gql(`
    mutation CreateCollection($input: CreateCollectionInput!) {
        createCollection(input: $input) {
            id
            name
        }
    }
`);

export const UPDATE_COLLECTION = gql(`
    mutation UpdateCollection($id: ID!, $isPrivate: Boolean!) {
        updateCollection(input: { id: $id, isPrivate: $isPrivate }) {
            id
        }
    }
`);

export const CREATE_FACET = gql(`
    mutation CreateFacet($input: CreateFacetInput!) {
        createFacet(input: $input) {
            id
            name
        }
    }
`);

export const UPDATE_FACET = gql(`
    mutation UpdateFacet($id: ID!, $isPrivate: Boolean!) {
        updateFacet(input: { id: $id, isPrivate: $isPrivate }) {
            id
        }
    }
`);

export interface AdminProduct {
    id: string;
    name: string;
    enabled: boolean;
    variants: Array<{ id: string; name: string; sku: string; enabled: boolean }>;
}

export interface Catalogue {
    products: AdminProduct[];
    facets: Array<{
        id: string;
        name: string;
        code: string;
        isPrivate: boolean;
        values: Array<{ id: string; code: string; name: string }>;
    }>;
}

export async function loadCatalogue(adminClient: any): Promise<Catalogue> {
    const products = await adminClient.query(ADMIN_PRODUCTS);
    const facets = await adminClient.query(ADMIN_FACETS);
    return { products: products.products.items, facets: facets.facets.items };
}

export async function createEmptyCollection(
    adminClient: any,
    name: string,
    slug: string,
    isPrivate: boolean,
): Promise<string> {
    const result = await adminClient.query(CREATE_COLLECTION, {
        input: {
            isPrivate,
            filters: [],
            translations: [{ languageCode: 'en', name, description: '', slug }],
        },
    });
    return result.createCollection.id;
}

const RUNNING_JOBS = gql(`
    query RunningJobs {
        jobs(options: { filter: { isSettled: { eq: false } } }) {
            totalItems
        }
    }
`);

export async function awaitRunningJobs(adminClient: any, timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, 200));
    for (;;) {
        const result = await adminClient.query(RUNNING_JOBS);
        if (result.jobs.totalItems === 0) {
            return;
        }
        if (Date.now() - start > timeoutMs) {
            throw new Error('Background jobs did not settle');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

export async function createCollectionForFacetValue(
    adminClient: any,
    name: string,
    slug: string,
    facetValueId: string,
): Promise<string> {
    const result = await adminClient.query(CREATE_COLLECTION, {
        input: {
            isPrivate: false,
            filters: [
                {
                    code: 'facet-value-filter',
                    arguments: [
                        { name: 'facetValueIds', value: JSON.stringify([facetValueId]) },
                        { name: 'containsAny', value: 'true' },
                    ],
                },
            ],
            translations: [{ languageCode: 'en', name, description: '', slug }],
        },
    });
    await awaitRunningJobs(adminClient);
    return result.createCollection.id;
}

export async function createFacet(
    adminClient: any,
    name: string,
    code: string,
    isPrivate: boolean,
): Promise<string> {
    const result = await adminClient.query(CREATE_FACET, {
        input: {
            code,
            isPrivate,
            translations: [{ languageCode: 'en', name }],
        },
    });
    return result.createFacet.id;
}

export function idsOf(list: Array<{ id: string }> | undefined): string[] {
    return (list ?? []).map(item => item.id).sort();
}

export function findByName<T extends { name: string }>(items: T[], name: string): T {
    const found = items.find(item => item.name === name);
    if (!found) {
        throw new Error(`Fixture item "${name}" was not created`);
    }
    return found;
}

export async function disableProduct(adminClient: any, id: string): Promise<void> {
    await adminClient.query(UPDATE_PRODUCT, { id, enabled: false });
}

export async function disableVariant(adminClient: any, id: string): Promise<void> {
    await adminClient.query(UPDATE_VARIANTS, { input: [{ id, enabled: false }] });
}

export interface ShopQueryResult<T> {
    data?: T;
    error?: unknown;
}

/** Runs a shop query; an error is reported rather than thrown (a refusal is also "blocked"). */
export async function shopQuery<T>(
    shopClient: any,
    document: any,
    variables: Record<string, unknown>,
    pick: (result: any) => T,
): Promise<ShopQueryResult<T>> {
    try {
        const result = await shopClient.query(document, variables);
        return { data: pick(result) };
    } catch (error) {
        return { error };
    }
}
