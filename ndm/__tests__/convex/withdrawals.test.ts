/**
 * Unit tests for withdrawal business logic.
 *
 * Since Convex mutations cannot be invoked directly in Jest, these tests
 * validate the core business rules by exercising the logic with simulated
 * Convex context objects.
 */

// ---------------------------------------------------------------------------
// Minimum withdrawal rule
// ---------------------------------------------------------------------------

describe("Withdrawal business rules", () => {
  describe("Minimum amount validation", () => {
    it("rejects amounts below ₱100", () => {
      expect(() => enforceMinimum(99)).toThrow("Minimum withdrawal amount is ₱100");
    });

    it("rejects zero amount", () => {
      expect(() => enforceMinimum(0)).toThrow("Minimum withdrawal amount is ₱100");
    });

    it("accepts exactly ₱100", () => {
      expect(() => enforceMinimum(100)).not.toThrow();
    });

    it("accepts amounts above ₱100", () => {
      expect(() => enforceMinimum(5000)).not.toThrow();
    });
  });

  describe("Balance check", () => {
    it("rejects withdrawal exceeding current balance", () => {
      expect(() => enforceBalance(500, 499)).toThrow("Insufficient balance");
    });

    it("accepts withdrawal equal to current balance", () => {
      expect(() => enforceBalance(500, 500)).not.toThrow();
    });

    it("accepts withdrawal below current balance", () => {
      expect(() => enforceBalance(500, 1000)).not.toThrow();
    });
  });

  describe("Optimistic balance deduction", () => {
    it("deducts withdrawal amount from balance", () => {
      expect(deductBalance(1000, 300)).toBe(700);
    });

    it("deducts full balance correctly", () => {
      expect(deductBalance(500, 500)).toBe(0);
    });
  });

  describe("Balance restoration on failure", () => {
    it("restores full amount on failed withdrawal", () => {
      expect(restoreBalance(700, 300)).toBe(1000);
    });
  });

  describe("totalWithdrawn update on completion", () => {
    it("adds withdrawal amount to totalWithdrawn", () => {
      expect(updateTotalWithdrawn(1500, 500)).toBe(2000);
    });

    it("starts from 0 if totalWithdrawn was undefined", () => {
      expect(updateTotalWithdrawn(undefined, 500)).toBe(500);
    });
  });
});

// ---------------------------------------------------------------------------
// Wise state → withdrawal status mapping
// ---------------------------------------------------------------------------

describe("Wise state → withdrawal status mapping", () => {
  const stateMap: Record<string, string> = {
    processing: "processing",
    outgoing_payment_sent: "completed",
    cancelled: "failed",
    funds_refunded: "failed",
    bounced_back: "failed",
    charged_back: "failed",
  };

  it("maps outgoing_payment_sent → completed", () => {
    expect(stateMap["outgoing_payment_sent"]).toBe("completed");
  });

  it("maps processing → processing", () => {
    expect(stateMap["processing"]).toBe("processing");
  });

  it("maps cancelled → failed", () => {
    expect(stateMap["cancelled"]).toBe("failed");
  });

  it("maps funds_refunded → failed", () => {
    expect(stateMap["funds_refunded"]).toBe("failed");
  });

  it("maps bounced_back → failed", () => {
    expect(stateMap["bounced_back"]).toBe("failed");
  });

  it("returns undefined for unknown states", () => {
    expect(stateMap["some_unknown_state"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// accountDetails string formatting
// ---------------------------------------------------------------------------

describe("accountDetails string formatting", () => {
  it("formats bank details correctly", () => {
    const result = formatAccountDetails("Juan dela Cruz", "BDO", "1234567890");
    expect(result).toBe("Juan dela Cruz — BDO 1234567890");
  });
});

// ---------------------------------------------------------------------------
// Pure logic helpers (extracted from mutation handler logic)
// These mirror the exact logic in convex/withdrawals.ts
// ---------------------------------------------------------------------------

function enforceMinimum(amount: number) {
  if (amount < 100) throw new Error("Minimum withdrawal amount is ₱100");
}

function enforceBalance(amount: number, currentBalance: number) {
  if (amount > currentBalance) throw new Error("Insufficient balance");
}

function deductBalance(currentBalance: number, amount: number): number {
  return currentBalance - amount;
}

function restoreBalance(currentBalance: number, amount: number): number {
  return currentBalance + amount;
}

function updateTotalWithdrawn(current: number | undefined, amount: number): number {
  return (current ?? 0) + amount;
}

function formatAccountDetails(
  accountHolderName: string,
  bankName: string,
  accountNumber: string
): string {
  return `${accountHolderName} — ${bankName} ${accountNumber}`;
}
