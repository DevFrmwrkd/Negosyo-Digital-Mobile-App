import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: '#f59e0b', bg: '#fffbeb' },
  processing: { label: 'Processing', color: '#3b82f6', bg: '#dbeafe' },
  completed:  { label: 'Completed',  color: '#10b981', bg: '#d1fae5' },
  failed:     { label: 'Failed',     color: '#ef4444', bg: '#fee2e2' },
};

const PAYOUT_ICON = { icon: 'business-outline' as const, label: 'Bank Transfer' };

// ---------------------------------------------------------------------------
// Wise-validated bank list (from GET /v1/account-requirements)
// ---------------------------------------------------------------------------

export const WISE_PH_BANKS = [
  { key: 'BDO',  name: 'BDO Unibank', digits: 10 },
  { key: 'BPI',  name: 'BPI (Bank of the Philippine Islands)', digits: 10 },
  { key: 'MBTC', name: 'Metropolitan Bank and Trust Company', digits: 13 },
  { key: 'UB',   name: 'Union Bank of the Philippines', digits: 12 },
  { key: 'SB',   name: 'Security Bank Corporation', digits: 13 },
  { key: 'LBP',  name: 'Land Bank of the Philippines', digits: 10 },
  { key: 'PNB',  name: 'Philippine National Bank', digits: 12 },
  { key: 'RCBC', name: 'Rizal Commercial Banking Corp.', digits: 10 },
  { key: 'AUB',  name: 'Asia United Bank', digits: 12 },
  { key: 'EWB',  name: 'East West Bank', digits: 12 },
  { key: 'CB',   name: 'China Banking Corporation', digits: 14 },
  { key: 'CIMB', name: 'CIMB Bank Philippines', digits: 14 },
  { key: 'DBP',  name: 'Development Bank of the Philippines', digits: 14 },
  { key: 'PSB',  name: 'Philippine Savings Bank', digits: 14 },
  { key: 'UCPB', name: 'United Coconut Planters Bank', digits: 14 },
] as const;

// ---------------------------------------------------------------------------
// Withdrawal Form type
// ---------------------------------------------------------------------------

type WithdrawalForm = {
  amount: string;
  accountHolderName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  city: string;
};

const EMPTY_FORM: WithdrawalForm = {
  amount: '',
  accountHolderName: '',
  bankName: '',
  bankCode: '',
  accountNumber: '',
  city: '',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const withdrawals = useQuery(
    api.withdrawals.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );
  const earnings = useQuery(
    api.earnings.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  const createWithdrawal = useMutation(api.withdrawals.create);

  const [showModal, setShowModal]         = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [form, setForm]                   = useState<WithdrawalForm>(EMPTY_FORM);
  const [submitting, setSubmitting]       = useState(false);
  const [formError, setFormError]         = useState('');

  // When online, wait for Convex. When offline, skip — layout already verified auth.
  if (!isOffline && creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator testID="activity-indicator" size="large" color="#10b981" />
      </View>
    );
  }

  const balance = creator?.balance ?? 0;
  const recentWithdrawals = withdrawals?.slice(0, 5) ?? [];
  const recentEarnings    = earnings?.slice(0, 5) ?? [];

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    if (submitting) return;
    setShowModal(false);
  }

  async function handleSubmit() {
    setFormError('');

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 100) {
      setFormError('Minimum withdrawal is ₱100.');
      return;
    }
    if (amount > balance) {
      setFormError('Amount exceeds your available balance.');
      return;
    }
    if (!form.accountHolderName.trim()) {
      setFormError('Account holder name is required.');
      return;
    }
    if (form.accountHolderName.trim().split(/\s+/).length < 2) {
      setFormError('Please enter your full name (first and last name) as it appears on the bank account.');
      return;
    }
    if (!form.bankName.trim()) {
      setFormError('Bank name is required.');
      return;
    }
    if (!form.bankCode.trim()) {
      setFormError('Please select a bank.');
      return;
    }
    const selectedBank = WISE_PH_BANKS.find((b) => b.key === form.bankCode);
    const requiredDigits = selectedBank?.digits;
    if (requiredDigits) {
      if (!/^\d+$/.test(form.accountNumber.trim()) || form.accountNumber.trim().length !== requiredDigits) {
        setFormError(`Account number for ${selectedBank.name} must be exactly ${requiredDigits} digits.`);
        return;
      }
    } else if (!/^\d{10,14}$/.test(form.accountNumber.trim())) {
      setFormError('Account number must be 10–14 digits.');
      return;
    }
    if (!form.city.trim()) {
      setFormError('City is required.');
      return;
    }
    if (!creator?._id) return;

    setSubmitting(true);
    try {
      await createWithdrawal({
        creatorId: creator._id,
        amount,
        accountHolderName: form.accountHolderName.trim(),
        bankName: form.bankName.trim(),
        bankCode: form.bankCode.trim(),
        accountNumber: form.accountNumber.trim(),
        city: form.city.trim(),
      });
      setShowModal(false);
      Alert.alert(
        'Withdrawal Submitted',
        `Your withdrawal of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} is being processed via Wise. You will receive a notification once completed.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      setFormError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Header */}
        <View style={{
          backgroundColor: '#fff',
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f5',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#18181b' }}>Wallet</Text>
          <Text style={{ fontSize: 14, color: '#71717a', marginTop: 4 }}>
            Manage your earnings and withdrawals.
          </Text>
        </View>

        <View style={{ padding: 16, gap: 16 }}>

          {/* Balance Card */}
          <View style={{
            backgroundColor: '#18181b', borderRadius: 24, padding: 20, gap: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '500', letterSpacing: 0.5 }}>
                  AVAILABLE BALANCE
                </Text>
                <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 }}>
                  ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#27272a',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="wallet" size={22} color="#34d399" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#27272a', borderRadius: 12, padding: 10 }}>
                <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '500' }}>TOTAL EARNED</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                  ₱{((creator as any)?.totalEarnings ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#27272a', borderRadius: 12, padding: 10 }}>
                <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '500' }}>WITHDRAWN</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                  ₱{((creator as any)?.totalWithdrawn ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Withdraw Button */}
            <TouchableOpacity
              testID="withdraw-button"
              style={{
                backgroundColor: balance >= 100 ? '#10b981' : '#3f3f46',
                borderRadius: 14, paddingVertical: 13,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
              }}
              onPress={openModal}
              disabled={balance < 100 || isOffline}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Withdraw Funds</Text>
            </TouchableOpacity>

            {balance < 100 && (
              <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: -8 }}>
                Minimum withdrawal is ₱100
              </Text>
            )}
            {isOffline && balance >= 100 && (
              <Text style={{ color: '#f59e0b', fontSize: 11, textAlign: 'center', marginTop: -8 }}>
                You're offline — reconnect to withdraw
              </Text>
            )}
          </View>

          {/* Recent Earnings */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181b', marginBottom: 12 }}>
              Recent Earnings
            </Text>
            {recentEarnings.length === 0 ? (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 24,
                alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 26, backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="cash-outline" size={24} color="#a1a1aa" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#3f3f46', marginTop: 10 }}>No earnings yet</Text>
                <Text style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'center', lineHeight: 18, marginTop: 4 }}>
                  Complete your first submission to{'\n'}start earning.
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                {recentEarnings.map((earning: any, idx: number) => (
                  <View key={earning._id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 20, backgroundColor: '#d1fae5',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="trending-up-outline" size={18} color="#10b981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#18181b' }}>
                          Submission Payout
                        </Text>
                        <Text style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
                          {timeAgo(earning._creationTime ?? earning.createdAt ?? 0)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#10b981' }}>
                        +₱{(earning.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    {idx < recentEarnings.length - 1 && (
                      <View style={{ height: 1, backgroundColor: '#f4f4f5', marginHorizontal: 14 }} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Withdrawal History */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181b', marginBottom: 12 }}>
              Withdrawal History
            </Text>
            {recentWithdrawals.length === 0 ? (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 24,
                alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 26, backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="swap-vertical-outline" size={24} color="#a1a1aa" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#3f3f46', marginTop: 10 }}>No withdrawals yet</Text>
                <Text style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'center', lineHeight: 18, marginTop: 4 }}>
                  Your withdrawal history will{'\n'}show up here.
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                {recentWithdrawals.map((w: any, idx: number) => {
                  const status = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, color: '#71717a', bg: '#f4f4f5' };
                  return (
                    <View key={w._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20, backgroundColor: '#f4f4f5',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name={PAYOUT_ICON.icon} size={18} color="#52525b" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#18181b' }}>
                            {w.bankName ?? PAYOUT_ICON.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
                            {timeAgo(w.createdAt ?? w._creationTime ?? 0)}
                          </Text>
                          {w.wiseTransferId && (
                            <Text style={{ fontSize: 10, color: '#a1a1aa', marginTop: 1 }}>
                              Wise #{w.wiseTransferId}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#ef4444' }}>
                            -₱{(w.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </Text>
                          <View style={{
                            paddingHorizontal: 8, paddingVertical: 2,
                            borderRadius: 10, backgroundColor: status.bg,
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: status.color }}>
                              {status.label}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {idx < recentWithdrawals.length - 1 && (
                        <View style={{ height: 1, backgroundColor: '#f4f4f5', marginHorizontal: 14 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

        </View>
      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal
        testID="withdrawal-modal"
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeModal}
          />
          <View style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: 24, paddingBottom: insets.bottom + 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
          }}>
            {/* Handle */}
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: '#e4e4e7', alignSelf: 'center', marginBottom: 20,
            }} />

            {/* Title */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#18181b' }}>Withdraw Funds</Text>
                <Text style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>
                  Available: ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#f4f4f5',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="business-outline" size={18} color="#52525b" />
              </View>
            </View>

            {/* Wise badge */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10, marginBottom: 20,
            }}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={{ fontSize: 12, color: '#065f46', fontWeight: '600' }}>
                Processed securely via Wise · Bank Transfer only
              </Text>
            </View>

            {/* Amount */}
            <Text style={labelStyle}>Amount (₱)</Text>
            <TextInput
              testID="amount-input"
              style={[inputStyle, { marginBottom: 4 }]}
              placeholder="e.g. 1000"
              keyboardType="numeric"
              value={form.amount}
              onChangeText={(v) => {
                const num = parseFloat(v);
                if (v === '' || isNaN(num) || num <= balance) {
                  setForm((f) => ({ ...f, amount: v }));
                }
              }}
              editable={!submitting}
            />
            <Text style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 14 }}>
              Available: ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Text>

            {/* Account Holder Name */}
            <Text style={labelStyle}>Account Holder Name</Text>
            <TextInput
              testID="account-holder-input"
              style={inputStyle}
              placeholder="Full name as on bank account"
              value={form.accountHolderName}
              onChangeText={(v) => setForm((f) => ({ ...f, accountHolderName: v.replace(/[^a-zA-Z\s]/g, '') }))}
              editable={!submitting}
            />

            {/* Bank Picker */}
            <Text style={labelStyle}>Bank</Text>
            <TouchableOpacity
              testID="bank-picker-button"
              style={[inputStyle, {
                flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 14,
              }]}
              onPress={() => !submitting && setShowBankPicker(true)}
            >
              <Text style={{ color: form.bankCode ? '#18181b' : '#a1a1aa', fontSize: 14 }}>
                {form.bankName || 'Select your bank'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#71717a" />
            </TouchableOpacity>

            {/* Account Number + City side by side */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.4 }}>
                <Text style={labelStyle}>Account Number</Text>
                <TextInput
                  testID="account-number-input"
                  style={inputStyle}
                  placeholder={(() => {
                    const bank = WISE_PH_BANKS.find((b) => b.key === form.bankCode);
                    return bank ? `${bank.digits} digits` : 'Select bank first';
                  })()}
                  keyboardType="numeric"
                  maxLength={(() => {
                    const bank = WISE_PH_BANKS.find((b) => b.key === form.bankCode);
                    return bank?.digits ?? 14;
                  })()}
                  value={form.accountNumber}
                  onChangeText={(v) => setForm((f) => ({ ...f, accountNumber: v.replace(/[^0-9]/g, '') }))}
                  editable={!submitting}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={labelStyle}>City</Text>
                <TextInput
                  testID="city-input"
                  style={inputStyle}
                  placeholder="e.g. Manila"
                  value={form.city}
                  onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                  editable={!submitting}
                />
              </View>
            </View>

            {/* Error */}
            {formError !== '' && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, fontWeight: '500' }}>
                {formError}
              </Text>
            )}

            {/* Submit */}
            <TouchableOpacity
              testID="submit-withdrawal-button"
              style={{
                backgroundColor: submitting ? '#a1a1aa' : '#10b981',
                borderRadius: 14, paddingVertical: 14,
                alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 8,
              }}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
              }
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {submitting ? 'Submitting…' : 'Confirm Withdrawal'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bank Picker Modal — rendered after Withdrawal Modal so it appears on top */}
      <Modal
        visible={showBankPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBankPicker(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{
            backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: '75%', paddingBottom: insets.bottom + 16,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b' }}>Select Bank</Text>
              <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                <Ionicons name="close" size={22} color="#71717a" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {WISE_PH_BANKS.map((bank) => (
                <TouchableOpacity
                  key={bank.key}
                  testID={`bank-option-${bank.key}`}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 20, paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
                    backgroundColor: form.bankCode === bank.key ? '#ecfdf5' : '#fff',
                  }}
                  onPress={() => {
                    setForm((f) => ({ ...f, bankCode: bank.key, bankName: bank.name }));
                    setShowBankPicker(false);
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#18181b', flex: 1 }}>{bank.name}</Text>
                  {form.bankCode === bank.key && (
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Local styles
// ---------------------------------------------------------------------------

const labelStyle = {
  fontSize: 12,
  fontWeight: '600' as const,
  color: '#3f3f46',
  marginBottom: 6,
};

const inputStyle = {
  backgroundColor: '#f4f4f5',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 14,
  color: '#18181b',
  marginBottom: 14,
};
