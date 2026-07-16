/** Jest config for Firebase provider unit tests (env set in spec beforeAll). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^@gitroom/backend/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/services/auth/providers/firebase.provider.spec.ts'],
};
