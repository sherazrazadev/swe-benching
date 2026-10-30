// Hidden security suite. Runs with the project's own jest + ts-jest under /workspace.
const config = {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'node',
	rootDir: '/workspace',
	roots: ['<rootDir>/src', '<rootDir>/WAProto'],
	testMatch: ['<rootDir>/src/__tests__/grading/security/**/*.test.ts'],
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: '/workspace/tsconfig.json', diagnostics: false }],
		'^.+\\.js$': ['ts-jest', { useESM: true, tsconfig: '/workspace/tsconfig.json', diagnostics: false }]
	},
	transformIgnorePatterns: ['node_modules/(?!(protobufjs|long|@protobufjs|@types/long|whatsapp-rust-bridge)/)'],
	testTimeout: 60000,
	maxWorkers: 1
}
module.exports = config
