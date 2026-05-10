/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@kincare/shared$':       '<rootDir>/../../packages/shared/src',
    '^@kincare/shared/(.*)$':  '<rootDir>/../../packages/shared/src/$1',
    '^@kincare/auth$':         '<rootDir>/../../packages/auth/src',
    '^@kincare/db$':           '<rootDir>/../../packages/db/src',
    '^@kincare/fhir$':         '<rootDir>/../../packages/fhir/src',
    '^@kincare/hl7$':          '<rootDir>/../../packages/hl7/src',
    '^@kincare/dicom$':        '<rootDir>/../../packages/dicom/src',
    '^@kincare/notifications$':'<rootDir>/../../packages/notifications/src',
  },
};
