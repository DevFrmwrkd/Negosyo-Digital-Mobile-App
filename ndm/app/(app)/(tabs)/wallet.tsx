import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';

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

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: '#f59e0b', bg: '#fffbeb' },
  processing: { label: 'Processing', color: '#3b82f6', bg: '#dbeafe' },
  completed:  { label: 'Completed',  color: '#10b981', bg: '#d1fae5' },
  failed:     { label: 'Failed',     color: '#ef4444', bg: '#fee2e2' },
};

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

  // When online, wait for Convex. When offline, skip — layout already verified auth.
  if (!isOffline && creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const recentWithdrawals = withdrawals?.slice(0, 5) ?? [];
  const recentEarnings    = earnings?.slice(0, 5) ?? [];

  const PAYOUT_ICONS: Record<string, { icon: any; label: string }> = {
    gcash:         { icon: 'phone-portrait-outline', label: 'GCash' },
    maya:          { icon: 'phone-portrait-outline', label: 'Maya' },
    bank_transfer: { icon: 'business-outline',       label: 'Bank Transfer' },
  };

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
                  ₱{(creator?.balance ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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
              style={{
                backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 13,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
              }}
              onPress={() => {
                // TODO: navigate to withdraw screen when built
              }}
              disabled={!creator?.balance || creator.balance < 100}
            >
              <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Withdraw Funds</Text>
            </TouchableOpacity>
            {(!creator?.balance || creator.balance < 100) && (
              <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: -8 }}>
                Minimum withdrawal is ₱100
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
                  const payout = PAYOUT_ICONS[w.payoutMethod] ?? { icon: 'card-outline', label: w.payoutMethod };
                  return (
                    <View key={w._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20, backgroundColor: '#f4f4f5',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name={payout.icon} size={18} color="#52525b" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#18181b' }}>
                            {payout.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
                            {timeAgo(w.createdAt ?? w._creationTime ?? 0)}
                          </Text>
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
    </View>
  );
}
