module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@clerk|convex|nativewind)",
  ],
  moduleNameMapper: {
    // Mock Convex generated API in tests
    "^../convex/_generated/api$": "<rootDir>/__mocks__/convex/api.ts",
    "^../../convex/_generated/api$": "<rootDir>/__mocks__/convex/api.ts",
    "^../../../convex/_generated/api$": "<rootDir>/__mocks__/convex/api.ts",
  },
  collectCoverageFrom: [
    "services/**/*.ts",
    "app/**/*.tsx",
    "convex/**/*.ts",
    "!convex/_generated/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
};
