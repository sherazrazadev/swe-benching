import {test} from 'node:test';
import assert from 'node:assert/strict';

const {JSONPath} = await import('jsonpath-plus');

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
        'typeof operator',
        '$..[?(@ && typeof @.meta === "number")]',
        [books[0]]
    ],
    [
        'bit shift operator',
        '$..[?(@ && @.meta === -5 >>> 2)]',
        [books[0]]
    ],
    [
        'bitwise or',
        '$..[?(@ && (@.shelf === (1 | 2)))]',
        [books[1]]
    ],
    [
        'logical or on property names',
        '$..[?(@property === "book" || @property === "books")]',
        [book, books]
    ],
    [
        'presence check',
        '$..[?(@ && @.isbn)]',
        [books[1]]
    ]
];

for (const [name, path, expected] of cases) {
    test(`safe evaluation keeps working: ${name}`, () => {
        assert.deepEqual(JSONPath({json, path, sandbox}), expected);
    });
}

const typed = {
    items: [
        {id: 'null', v: null},
        {id: 'undefined'},
        {id: 'value', v: 1}
    ]
};

test('safe evaluation keeps working: null literal', () => {
    assert.deepEqual(
        JSONPath({json: typed, path: '$.items[?(@ && @.v === null)]'}),
        [typed.items[0]]
    );
});

test('safe evaluation keeps working: undefined literal', () => {
    assert.deepEqual(
        JSONPath({json: typed, path: '$.items[?(@ && @.v === undefined)]'}),
        [typed.items[1]]
    );
});

test('explicit native evaluation still works', () => {
    assert.deepEqual(
        JSONPath({
            json,
            path: '$..[?(var s = @.price; s && s[0] > 10;)]',
            eval: 'native'
        }),
        [books[0]]
    );
});

test('disabled evaluation still refuses filters', () => {
    assert.throws(() => {
        JSONPath({json, path: '$..[?(@.shelf > 0)]', eval: false});
    });
});

test('a caller-supplied evaluator class still runs', () => {
    class CustomEval {
        constructor (code) {
            this.code = code;
        }

        runInNewContext () {
            return true;
        }
    }
    const result = JSONPath({json, path: '$[?(@)]', eval: CustomEval});
    assert.ok(Array.isArray(result) && result.length > 0);
});

test('a caller-supplied evaluator function still runs', () => {
    const result = JSONPath({
        json,
        path: '$[?(@)]',
        eval: () => true
    });
    assert.ok(Array.isArray(result) && result.length > 0);
});
