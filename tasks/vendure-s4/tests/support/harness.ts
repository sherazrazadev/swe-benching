import path from 'path';
import { mergeConfig } from '@vendure/core';
import { registerInitializer, SqljsInitializer, testConfig as defaultTestConfig } from '@vendure/testing';

let registered = false;
export function makeTestConfig(port: number) {
    if (!registered) {
        registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));
        registered = true;
    }
    return mergeConfig(defaultTestConfig, {
        apiOptions: { port },
        importExportOptions: { importAssetsDir: path.join(__dirname, 'assets') },
        dbConnectionOptions: defaultTestConfig.dbConnectionOptions,
    });
}
export const fixtureCsv = path.join(__dirname, 'products.csv');
