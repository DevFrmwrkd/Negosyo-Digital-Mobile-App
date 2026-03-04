/**
 * Wise API Client — pure functions, no Convex dependencies.
 * Easily unit-testable via fetch mocks.
 *
 * Sandbox: https://api.sandbox.transferwise.tech
 * Production: https://api.wise.com
 */

/** Generate a RFC 4122 v4 UUID using only Math.random (no Node deps). */
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const BASE_URL = {
  sandbox: "https://api.sandbox.transferwise.tech",
  production: "https://api.wise.com",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WiseConfig = {
  token: string;
  profileId: number;
  sandbox?: boolean; // defaults to true for safety
};

export type RecipientDetails = {
  accountHolderName: string;
  accountNumber: string;
  bankCode: string;      // Wise short code (e.g. "BDO", "BPI", "MBTC") — from WISE_PH_BANKS
  city: string;          // Recipient's city (required by Wise for PH accounts)
  accountType?: string;  // Wise account type — defaults to "philippines"
};

export type WiseRecipient = {
  id: number;
  currency: string;
  accountHolderName: string;
};

export type WiseQuote = {
  id: number;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
};

export type WiseTransfer = {
  id: number;
  targetAccount: number;
  status: string;
  reference: string;
  customerTransactionId: string;
};

export type WiseFundResult = {
  type: string;
  status: string;
  errorCode: string | null;
};

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class WiseError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "WiseError";
  }
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function wiseRequest<T>(
  config: WiseConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const base = config.sandbox === false ? BASE_URL.production : BASE_URL.sandbox;
  const url = `${base}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new WiseError(
      `Wise API ${method} ${path} returned ${res.status}`,
      res.status,
      errorBody
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the account requirements for a PHP transfer.
 * Use this to discover the correct `type` and required fields for recipients.
 *
 * Example:
 *   const reqs = await getAccountRequirements(config, 500);
 *   console.log(reqs.map(r => r.type)); // ["philippines", ...]
 */
export async function getAccountRequirements(
  config: WiseConfig,
  amountPHP: number
): Promise<unknown[]> {
  return wiseRequest<unknown[]>(
    config,
    "GET",
    `/v1/account-requirements?source=PHP&target=PHP&sourceAmount=${amountPHP}&targetCurrency=PHP`
  );
}

/**
 * Create a recipient (bank account) for PHP transfers in the Philippines.
 * The `accountType` field should come from getAccountRequirements() — defaults to "philippines".
 */
export async function createRecipient(
  config: WiseConfig,
  details: RecipientDetails
): Promise<WiseRecipient> {
  const type = details.accountType ?? "philippines";

  return wiseRequest<WiseRecipient>(config, "POST", "/v1/accounts", {
    currency: "PHP",
    type,
    profile: config.profileId,
    ownedByCustomer: false,
    accountHolderName: details.accountHolderName,
    details: {
      legalType: "PRIVATE",
      bankCode: details.bankCode,
      accountNumber: details.accountNumber,
      address: {
        city: details.city,
        country: "PH",
      },
    },
  });
}

/**
 * Create a quote for a PHP-to-PHP transfer (same-currency local transfer).
 */
export async function createQuote(
  config: WiseConfig,
  amountPHP: number
): Promise<WiseQuote> {
  return wiseRequest<WiseQuote>(config, "POST", "/v1/quotes", {
    profile: config.profileId,
    source: "PHP",
    target: "PHP",
    sourceAmount: amountPHP,
    rateType: "FIXED",
    type: "REGULAR",
  });
}

/**
 * Create a transfer using a quote and recipient.
 * @param reference  Used as the payment reference (e.g. the withdrawal Convex ID).
 */
export async function createTransfer(
  config: WiseConfig,
  recipientId: number,
  quoteId: number,
  reference: string
): Promise<WiseTransfer> {
  return wiseRequest<WiseTransfer>(config, "POST", "/v1/transfers", {
    targetAccount: recipientId,
    quote: quoteId,
    customerTransactionId: uuidv4(),
    details: { reference },
  });
}

/**
 * Fund and execute a transfer.
 * In sandbox: simulates processing via the simulation endpoint.
 * In production: funds from the Wise balance.
 */
export async function fundTransfer(
  config: WiseConfig,
  transferId: number
): Promise<WiseFundResult> {
  if (config.sandbox !== false) {
    return wiseRequest<WiseFundResult>(
      config,
      "GET",
      `/v1/simulation/transfers/${transferId}/processing`
    );
  }
  return wiseRequest<WiseFundResult>(
    config,
    "POST",
    `/v3/profiles/${config.profileId}/transfers/${transferId}/payments`,
    { type: "BALANCE" }
  );
}

/**
 * Fetch the current state of a transfer.
 */
export async function getTransfer(
  config: WiseConfig,
  transferId: number
): Promise<WiseTransfer> {
  return wiseRequest<WiseTransfer>(config, "GET", `/v1/transfers/${transferId}`);
}
