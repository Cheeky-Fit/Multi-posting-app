/** Jest config for GCS storage provider unit tests. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/upload/gcs.storage.spec.ts'],
};
