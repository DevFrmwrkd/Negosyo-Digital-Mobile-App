// Mock for convex/_generated/api — used in Jest tests.
// Provides typed stubs so tests can reference api.* without a real Convex build.

export const api = {
  creators: { getByClerkId: "creators:getByClerkId" },
  withdrawals: {
    create: "withdrawals:create",
    getByCreator: "withdrawals:getByCreator",
  },
  earnings: { getByCreator: "earnings:getByCreator" },
};
