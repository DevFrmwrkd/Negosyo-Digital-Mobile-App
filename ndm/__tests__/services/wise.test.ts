/**
 * Unit tests for services/wise.ts
 *
 * All tests mock global fetch — no real HTTP calls are made.
 */

import {
  createRecipient,
  createQuote,
  createTransfer,
  fundTransfer,
  getTransfer,
  WiseError,
  WiseConfig,
} from "../../services/wise";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SANDBOX_CONFIG: WiseConfig = {
  token: "test-sandbox-token",
  profileId: 12345,
  sandbox: true,
};

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any);
}

function mockFetchError(status: number, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as any);
}

// ---------------------------------------------------------------------------
// createRecipient
// ---------------------------------------------------------------------------

describe("createRecipient()", () => {
  it("posts to /v1/accounts and returns recipient", async () => {
    const mockRecipient = { id: 99, currency: "PHP", accountHolderName: "Juan dela Cruz" };
    mockFetch(200, mockRecipient);

    const result = await createRecipient(SANDBOX_CONFIG, {
      accountHolderName: "Juan dela Cruz",
      accountNumber: "1234567890",
      bankCode: "BDO",
      city: "Manila",
    });

    expect(result).toEqual(mockRecipient);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.sandbox.transferwise.tech/v1/accounts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-sandbox-token",
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining("Juan dela Cruz"),
      })
    );
  });

  it("uses 'philippines' type and includes bank code in request body", async () => {
    mockFetch(200, { id: 1, currency: "PHP", accountHolderName: "Test" });

    await createRecipient(SANDBOX_CONFIG, {
      accountHolderName: "Test",
      accountNumber: "0987654321",
      bankCode: "BPI",
      city: "Manila",
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.currency).toBe("PHP");
    expect(body.type).toBe("philippines");
    expect(body.details.bankCode).toBe("BPI");
    expect(body.details.accountNumber).toBe("0987654321");
    expect(body.details.address.city).toBe("Manila");
    expect(body.details.address.country).toBe("PH");
  });

  it("throws WiseError when API returns 422", async () => {
    mockFetchError(422, { errors: [{ message: "Invalid bank code" }] });

    await expect(
      createRecipient(SANDBOX_CONFIG, {
        accountHolderName: "Juan",
        accountNumber: "bad",
        bankCode: "INVALID",
        city: "Manila",
      })
    ).rejects.toThrow(WiseError);
  });

  it("throws WiseError with correct statusCode", async () => {
    mockFetchError(401, { message: "Unauthorized" });

    try {
      await createRecipient(SANDBOX_CONFIG, {
        accountHolderName: "Juan",
        accountNumber: "1234567",
        bankCode: "BDO",
        city: "Manila",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(WiseError);
      expect((err as WiseError).statusCode).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// createQuote
// ---------------------------------------------------------------------------

describe("createQuote()", () => {
  it("posts to /v3/quotes with correct PHP amount", async () => {
    const mockQuote = {
      id: "quote-uuid-123",
      sourceCurrency: "PHP",
      targetCurrency: "PHP",
      sourceAmount: 1000,
      targetAmount: 1000,
      rate: 1,
    };
    mockFetch(200, mockQuote);

    const result = await createQuote(SANDBOX_CONFIG, 1000);

    expect(result.id).toBe("quote-uuid-123");
    expect(result.sourceAmount).toBe(1000);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.sourceCurrency).toBe("PHP");
    expect(body.targetCurrency).toBe("PHP");
    expect(body.sourceAmount).toBe(1000);
    expect(body.profile).toBe(12345);
  });

  it("throws WiseError on 400 bad request", async () => {
    mockFetchError(400, { message: "Invalid amount" });

    await expect(createQuote(SANDBOX_CONFIG, -50)).rejects.toThrow(WiseError);
  });
});

// ---------------------------------------------------------------------------
// createTransfer
// ---------------------------------------------------------------------------

describe("createTransfer()", () => {
  it("posts to /v1/transfers and returns transfer", async () => {
    const mockTransfer = {
      id: 777,
      targetAccount: 99,
      status: "incoming_payment_waiting",
      reference: "withdrawal-abc123",
      customerTransactionId: "ndm-withdrawal-abc123-1234567890",
    };
    mockFetch(200, mockTransfer);

    const result = await createTransfer(
      SANDBOX_CONFIG,
      99,
      "quote-uuid-123",
      "withdrawal-abc123"
    );

    expect(result.id).toBe(777);
    expect(result.status).toBe("incoming_payment_waiting");

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.targetAccount).toBe(99);
    expect(body.quoteUuid).toBe("quote-uuid-123");
    expect(body.details.reference).toBe("withdrawal-abc123");
  });

  it("includes ndm- prefix in customerTransactionId", async () => {
    mockFetch(200, { id: 1, targetAccount: 1, status: "pending", reference: "ref", customerTransactionId: "" });

    await createTransfer(SANDBOX_CONFIG, 1, "quote-1", "my-ref");

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.customerTransactionId).toMatch(/^ndm-my-ref-/);
  });

  it("throws WiseError on insufficient balance (422)", async () => {
    mockFetchError(422, { code: "balance.payment-option.insufficient-funds" });

    await expect(
      createTransfer(SANDBOX_CONFIG, 99, "quote-uuid", "ref")
    ).rejects.toThrow(WiseError);
  });
});

// ---------------------------------------------------------------------------
// fundTransfer
// ---------------------------------------------------------------------------

describe("fundTransfer()", () => {
  it("posts to the correct profile payments endpoint", async () => {
    mockFetch(200, { type: "BALANCE", status: "COMPLETED", errorCode: null });

    await fundTransfer(SANDBOX_CONFIG, 777);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.sandbox.transferwise.tech/v3/profiles/12345/transfers/777/payments",
      expect.objectContaining({ method: "POST" })
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.type).toBe("BALANCE");
  });

  it("throws WiseError when balance is insufficient", async () => {
    mockFetchError(422, { errorCode: "not_enough_funds" });

    await expect(fundTransfer(SANDBOX_CONFIG, 777)).rejects.toThrow(WiseError);
  });
});

// ---------------------------------------------------------------------------
// getTransfer
// ---------------------------------------------------------------------------

describe("getTransfer()", () => {
  it("fetches transfer status by ID", async () => {
    const mockTransfer = { id: 777, targetAccount: 99, status: "processing", reference: "ref", customerTransactionId: "ndm-ref" };
    mockFetch(200, mockTransfer);

    const result = await getTransfer(SANDBOX_CONFIG, 777);

    expect(result.status).toBe("processing");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.sandbox.transferwise.tech/v1/transfers/777",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ---------------------------------------------------------------------------
// Production URL switching
// ---------------------------------------------------------------------------

describe("Production mode", () => {
  it("uses api.wise.com when sandbox is false", async () => {
    mockFetch(200, { id: 1, currency: "PHP", accountHolderName: "Test" });

    const prodConfig: WiseConfig = { token: "prod-token", profileId: 99, sandbox: false };
    await createRecipient(prodConfig, {
      accountHolderName: "Test",
      accountNumber: "123",
      bankCode: "010530667",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.wise.com/v1/accounts",
      expect.anything()
    );
  });
});
