/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@nid/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^@nid/ocr-engine$': '<rootDir>/../../packages/ocr-engine/src/index.ts',
    '^@nid/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@nid/storage$': '<rootDir>/../../packages/storage/src/index.ts',
    '^@nid/verification-providers$': '<rootDir>/../../packages/verification-providers/src/index.ts',
    '^@nid/workflow-contracts$': '<rootDir>/../../packages/workflow-contracts/src/index.ts',
  },
};
