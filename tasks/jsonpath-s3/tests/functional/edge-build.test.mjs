import {test} from 'node:test';
import assert from 'node:assert/strict';

const {JSONPath} = await import('jsonpath-plus/edge');

const book = {
    category: 'reference',
    author: 'Nigel Rees',
    title: 'Sayings of the Century',
    shelf: 1,
    price: [8.95, 8.94],
    meta: '12'
};
const books = [{
    category: 'fiction',
    author: 'Evelyn Waugh',
    title: 'Sword of Honour',
    shelf: 2,
    price: [10.99, 12.29],
    meta: 1073741822
}, {
    category: 'fiction',
    author: 'Herman Melville',
    title: 'Moby Dick',
    isbn: '0-553-21311-3',
    shelf: 3,
    price: [8.99, 6.95],
    emptyArray: []
}];
const json = {store: {book, books}};
const sandbox = {
    category: 'reference',
    filter (item) {
        return item.category === 'reference';
    }
};

const cases = [
    ['comparison filter', '$..[?(@.price && @.price[0] > 8)]', [book, books[0], books[1]]],
    ['array expression and method call', '$..[?(["book", "books"].includes(@property))]', [book, books]],
    ['sandbox function call', '$..[?(filter(@))]', [book]],
    ['typeof operator', '$..[?(@ && typeof @.meta === "number")]', [books[0]]],
    [
        'conditional operator',
        "$..[?(@ && @.price && ((@.price[0] + @.price[1]) > ((@.category === 'reference') ? 16 : 20)))]",
        [book, books[0]]
    ],
    ['property comparison', '$..[?(@.shelf > 1)]', [books[0], books[1]]]
];

for (const [name, path, expected] of cases) {
    test(`the other-runtime build keeps working: ${name}`, () => {
        assert.deepEqual(JSONPath({json, path, sandbox}), expected);
    });
}
