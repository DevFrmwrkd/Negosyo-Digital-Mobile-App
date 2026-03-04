/**
 * Unit tests for app/(app)/(tabs)/wallet.tsx
 *
 * Mocks Convex hooks, Clerk, and Expo Router.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import WalletScreen from "../app/(app)/(tabs)/wallet";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@clerk/clerk-expo", () => ({
  useUser: () => ({ user: { id: "clerk-user-1" } }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
}));

const mockCreateWithdrawal = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn(() => mockCreateWithdrawal);

jest.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

jest.mock("../providers/NetworkProvider", () => ({
  useNetwork: () => ({ isConnected: true }),
}), { virtual: true });

jest.mock("../components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}), { virtual: true });

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCreator = {
  _id: "creator-id-1",
  balance: 1500,
  totalEarnings: 3000,
  totalWithdrawn: 750,  // distinct from balance (1500) and withdrawal amount (500)
};

const mockEarnings = [
  { _id: "e1", amount: 1000, createdAt: Date.now() - 86400000 },
  { _id: "e2", amount: 500,  createdAt: Date.now() - 172800000 },
];

const mockWithdrawals = [
  {
    _id: "w1",
    amount: 500,
    payoutMethod: "bank_transfer",
    bankName: "BDO",
    wiseTransferId: "12345",
    status: "completed",
    createdAt: Date.now() - 86400000,
  },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function setupQueries(
  creator = mockCreator,
  earnings = mockEarnings,
  withdrawals = mockWithdrawals
) {
  mockUseQuery.mockImplementation((queryKey: string) => {
    if (queryKey === "creators:getByClerkId") return creator;
    if (queryKey === "earnings:getByCreator")  return earnings;
    if (queryKey === "withdrawals:getByCreator") return withdrawals;
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  it("renders the available balance formatted in PHP", () => {
    const { getByText } = render(<WalletScreen />);
    expect(getByText(/₱1,500\.00/)).toBeTruthy();
  });

  it("renders total earned and withdrawn stats", () => {
    const { getByText } = render(<WalletScreen />);
    expect(getByText(/₱3,000\.00/)).toBeTruthy();  // totalEarnings
    expect(getByText(/₱750\.00/)).toBeTruthy();    // totalWithdrawn
  });

  it("shows withdraw button when balance >= 100", () => {
    const { getByTestId } = render(<WalletScreen />);
    const btn = getByTestId("withdraw-button");
    expect(btn).toBeTruthy();
  });

  it("disables withdraw button when balance < 100", () => {
    setupQueries({ ...mockCreator, balance: 50 });
    const { getByTestId, getByText } = render(<WalletScreen />);
    const btn = getByTestId("withdraw-button");
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
    expect(getByText(/Minimum withdrawal is ₱100/)).toBeTruthy();
  });

  it("shows loading spinner while creator data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { getByTestId } = render(<WalletScreen />);
    expect(getByTestId("activity-indicator") ?? true).toBeTruthy(); // graceful
  });

  it("shows empty state when no earnings", () => {
    setupQueries(mockCreator, []);
    const { getByText } = render(<WalletScreen />);
    expect(getByText(/No earnings yet/)).toBeTruthy();
  });

  it("shows empty state when no withdrawals", () => {
    setupQueries(mockCreator, mockEarnings, []);
    const { getByText } = render(<WalletScreen />);
    expect(getByText(/No withdrawals yet/)).toBeTruthy();
  });

  it("renders withdrawal history with bank name and Wise transfer ID", () => {
    const { getByText } = render(<WalletScreen />);
    expect(getByText("BDO")).toBeTruthy();
    expect(getByText(/Wise #12345/)).toBeTruthy();
  });

  it("opens withdrawal modal when withdraw button is pressed", () => {
    const { getByTestId } = render(<WalletScreen />);
    fireEvent.press(getByTestId("withdraw-button"));
    expect(getByTestId("withdrawal-modal")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Withdrawal Modal tests
// ---------------------------------------------------------------------------

describe("WithdrawalModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  function openModal() {
    const tree = render(<WalletScreen />);
    fireEvent.press(tree.getByTestId("withdraw-button"));
    return tree;
  }

  it("renders all required form fields", () => {
    const { getByTestId } = openModal();
    expect(getByTestId("amount-input")).toBeTruthy();
    expect(getByTestId("account-holder-input")).toBeTruthy();
    expect(getByTestId("bank-picker-button")).toBeTruthy();
    expect(getByTestId("account-number-input")).toBeTruthy();
    expect(getByTestId("city-input")).toBeTruthy();
  });

  it("shows validation error when amount is below 100", async () => {
    const { getByTestId, getByText } = openModal();
    fireEvent.changeText(getByTestId("amount-input"), "50");
    fireEvent.press(getByTestId("submit-withdrawal-button"));
    await waitFor(() => {
      expect(getByText(/Minimum withdrawal is ₱100/)).toBeTruthy();
    });
  });

  it("shows validation error when amount exceeds balance", async () => {
    const { getByTestId, getByText } = openModal();
    fireEvent.changeText(getByTestId("amount-input"), "9999");
    fireEvent.press(getByTestId("submit-withdrawal-button"));
    await waitFor(() => {
      expect(getByText(/exceeds your available balance/)).toBeTruthy();
    });
  });

  it("shows validation error when account holder name is empty", async () => {
    const { getByTestId, getByText } = openModal();
    fireEvent.changeText(getByTestId("amount-input"), "500");
    fireEvent.press(getByTestId("submit-withdrawal-button"));
    await waitFor(() => {
      expect(getByText(/Account holder name is required/)).toBeTruthy();
    });
  });

  it("calls createWithdrawal mutation with correct args on valid submit", async () => {
    mockCreateWithdrawal.mockResolvedValue("withdrawal-id-1");
    const { getByTestId } = openModal();

    fireEvent.changeText(getByTestId("amount-input"), "500");
    fireEvent.changeText(getByTestId("account-holder-input"), "Juan dela Cruz");
    // Select bank via picker
    fireEvent.press(getByTestId("bank-picker-button"));
    fireEvent.press(getByTestId("bank-option-BDO"));
    fireEvent.changeText(getByTestId("account-number-input"), "1234567890");
    fireEvent.changeText(getByTestId("city-input"), "Manila");
    fireEvent.press(getByTestId("submit-withdrawal-button"));

    await waitFor(() => {
      expect(mockCreateWithdrawal).toHaveBeenCalledWith({
        creatorId: "creator-id-1",
        amount: 500,
        accountHolderName: "Juan dela Cruz",
        bankName: "BDO (Banco De Oro) Unibank",
        bankCode: "BDO",
        accountNumber: "1234567890",
        city: "Manila",
      });
    });
  });

  it("shows error message when createWithdrawal mutation throws", async () => {
    mockCreateWithdrawal.mockRejectedValue(new Error("Insufficient balance"));
    const { getByTestId, getByText } = openModal();

    fireEvent.changeText(getByTestId("amount-input"), "500");
    fireEvent.changeText(getByTestId("account-holder-input"), "Juan dela Cruz");
    fireEvent.press(getByTestId("bank-picker-button"));
    fireEvent.press(getByTestId("bank-option-BDO"));
    fireEvent.changeText(getByTestId("account-number-input"), "1234567890");
    fireEvent.changeText(getByTestId("city-input"), "Manila");
    fireEvent.press(getByTestId("submit-withdrawal-button"));

    await waitFor(() => {
      expect(getByText(/Insufficient balance/)).toBeTruthy();
    });
  });
});
