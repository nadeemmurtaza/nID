/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@nid/ocr-engine$': '<rootDir>/../ocr-engine/src/index.ts',
    '^@nid/shared-types$': '<rootDir>/../shared-types/src/index.ts',
  },
};
