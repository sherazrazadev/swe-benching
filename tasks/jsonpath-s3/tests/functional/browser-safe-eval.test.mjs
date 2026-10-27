import {test} from 'node:test';
import assert from 'node:assert/strict';

const {JSONPath} = await import('../../dist/index-browser-esm.js');

const book = {
    category: 'reference',
    shelf: 1,
    price: [8.95, 8.94],
    meta: '12'
};
const books = [{
    category: 'fiction',
    shelf: 2,
    price: [10.99, 12.29],
    meta: 1073741822
}, {
    category: 'fiction',
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
    [
        'multi-statement filter',
        '$..[?(var sum = @.price && @.price[0]+@.price[1];sum > 20;)]',
        [books[0]]
    ],
    [
        'strict multi-statement filter',
        '$..[?("use strict";var sum = @.price && @.price[0]+@.price[1];sum > 20;)]',
        [books[0]]
    ],
    [
        'current path',
        "$..[?(@path==\"$['store']['books'][1]\")]",
        [books[1]]
    ],
    [
        'sandbox value',
        '$..[?(@.category === category)]',
        [book]
    ],
    [
        'sandbox function call',
        '$..[?(filter(@))]',
        [book]
    ],
    [
        'conditional operator',
        "$..[?(@ && @.price && ((@.price[0] + @.price[1]) > ((@.category === 'reference') ? 16 : 20)))]",
        [book, books[0]]
    ],
    [
        'unary minus',
        '$..[?(@ && @.price && -10 < -(@.price[0]))]',
        [book, books[1]]
    ],
    [
        'array expression and method call',
        '$..[?(["book", "books"].includes(@property))]',
        [book, books]
    ],
    [
        'bit shift operator',
        '$..[?(@ && @.meta === -5 >>> 2)]',
        [books[0]]
    ]
];

for (const [name, path, expected] of cases) {
    test(`the browser build keeps working: ${name}`, () => {
        assert.deepEqual(JSONPath({json, path, sandbox}), expected);
    });
}
