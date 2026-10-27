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

test('a prepared filter keeps working when evaluated', () => {
    const path = '$..[?(@.shelf > 1)]';
    JSONPath.prepare(path);
    assert.deepEqual(JSONPath({json, path}), [books[0], books[1]]);
});

test('a prepared dynamic property keeps working when evaluated', () => {
    const path = '$.store.books[(@.length-1)]';
    JSONPath.prepare(path);
    assert.deepEqual(JSONPath({json, path}), [books[1]]);
});

test('a prepared filter with sandbox values keeps working', () => {
    const path = '$..[?(["book", "books"].includes(@property))]';
    JSONPath.prepare(path);
    assert.deepEqual(JSONPath({json, path}), [book, books]);
});

test('a prepared filter that uses the current path keeps working', () => {
    const path = "$..[?(@path==\"$['store']['books'][1]\")]";
    JSONPath.prepare(path);
    assert.deepEqual(JSONPath({json, path}), [books[1]]);
});

test('repeated evaluation of a prepared filter gives the same answer', () => {
    const path = '$..[?(@.price && @.price[0] > 8)]';
    JSONPath.prepare(path);
    const first = JSONPath({json, path});
    const second = JSONPath({json, path});
    assert.deepEqual(first, second);
    assert.deepEqual(first, [book, books[0], books[1]]);
});
