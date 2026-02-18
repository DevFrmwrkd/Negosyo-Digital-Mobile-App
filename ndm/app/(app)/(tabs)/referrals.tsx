import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

const HOW_IT_WORKS = [
  { title: 'Share your code',  desc: 'Send your referral code to fellow business owners.', icon: 'share-social-outline' as const, color: '#6366f1', bg: '#eef2ff' },
  { title: 'They sign up',     desc: 'They create an account and enter your referral code.', icon: 'person-add-outline' as const, color: '#f59e0b', bg: '#fffbeb' },
  { title: 'You both earn',    desc: 'Earn a bonus when their first submission is approved.', icon: 'cash-outline' as const, color: '#10b981', bg: '#d1fae5' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:   { label: 'Signed Up',  color: '#f59e0b', bg: '#fffbeb', icon: 'time-outline' },
  qualified: { label: 'Qualified',  color: '#10b981', bg: '#d1fae5', icon: 'checkmark-circle' },
  paid:      { label: 'Rewarded',   color: '#6366f1', bg: '#eef2ff', icon: 'gift' },
};

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  // ── Real referral data from Convex ──────────────────────────────────────
  const referralList = useQuery(
    api.referrals.getByReferrer,
    creator?._id ? { referrerId: creator._id } : 'skip'
  );
  const stats = useQuery(
    api.referrals.getStats,
    creator?._id ? { referrerId: creator._id } : 'skip'
  );

  const handleCopy = async () => {
    if (!creator?.referralCode) return;
    await Clipboard.setStringAsync(creator.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (!creator?.referralCode) return;
    try {
      await Share.share({
        message: `Join Negosyo Digital and digitalize your business!\n\nUse my referral code: ${creator.referralCode}\n\nDownload the app and enter this code when signing up.`,
        title: 'Join Negosyo Digital',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const isLoading = creator === undefined || referralList === undefined || stats === undefined;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const qualifiedCount = (stats?.qualified ?? 0) + (stats?.paid ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Header ── */}
        <View style={{
          backgroundColor: '#fff',
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f5',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#18181b' }}>Referrals</Text>
          <Text style={{ fontSize: 14, color: '#71717a', marginTop: 4 }}>
            Invite businesses and earn rewards together.
          </Text>
        </View>

        <View style={{ padding: 16, gap: 16 }}>

          {/* ── Referral Code Card ── */}
          <View style={{
            backgroundColor: '#18181b', borderRadius: 24, padding: 24, gap: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="gift-outline" size={20} color="#34d399" />
              </View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Your Referral Code</Text>
            </View>

            <View style={{ backgroundColor: '#27272a', borderRadius: 16, padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#34d399', fontSize: 28, fontWeight: '800', letterSpacing: 4 }}>
                {creator?.referralCode ?? '———'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, backgroundColor: copied ? '#065f46' : '#27272a',
                  borderRadius: 14, paddingVertical: 12,
                }}
              >
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? '#34d399' : '#a1a1aa'} />
                <Text style={{ color: copied ? '#34d399' : '#a1a1aa', fontWeight: '600', fontSize: 13 }}>
                  {copied ? 'Copied!' : 'Copy Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 12,
                }}
              >
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Stats Row (from api.referrals.getStats) ── */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Referred',  value: stats?.total ?? 0,          icon: 'people-outline' as const,   color: '#6366f1', bg: '#eef2ff' },
              { label: 'Qualified', value: qualifiedCount,              icon: 'checkmark-circle-outline' as const, color: '#10b981', bg: '#d1fae5' },
              { label: 'Rewards',   value: `₱${(stats?.totalEarned ?? 0).toFixed(0)}`, icon: 'cash-outline' as const, color: '#f59e0b', bg: '#fffbeb' },
            ].map((stat) => (
              <View key={stat.label} style={{
                flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
                alignItems: 'center', gap: 6,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: stat.bg, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={stat.icon} size={16} color={stat.color} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#18181b' }}>{stat.value}</Text>
                <Text style={{ fontSize: 10, color: '#a1a1aa', fontWeight: '600', textAlign: 'center' }}>
                  {stat.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Referred Creators List (from api.referrals.getByReferrer) ── */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181b', marginBottom: 12 }}>
              People You Referred
            </Text>

            {referralList.length === 0 ? (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 28,
                alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28, backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="people-outline" size={26} color="#a1a1aa" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#3f3f46', marginTop: 10 }}>No referrals yet</Text>
                <Text style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'center', lineHeight: 18, marginTop: 4 }}>
                  Share your code above to start{'\n'}earning referral rewards!
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                {referralList.map((ref: any, idx: number) => {
                  const meta = STATUS_META[ref.status] ?? STATUS_META.pending;
                  const isLast = idx === referralList.length - 1;
                  const initial = ((ref.referredName as string) || 'U').charAt(0).toUpperCase();
                  return (
                    <View key={ref._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        {/* Avatar initial */}
                        <View style={{
                          width: 42, height: 42, borderRadius: 21,
                          backgroundColor: '#f4f4f5',
                          alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: '#52525b' }}>{initial}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#18181b' }}>
                            {ref.referredName || 'Unknown'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
                            Joined {timeAgo(ref.createdAt ?? ref._creationTime ?? 0)}
                          </Text>
                        </View>

                        {/* Status badge */}
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          paddingHorizontal: 10, paddingVertical: 4,
                          borderRadius: 20, backgroundColor: meta.bg,
                        }}>
                          <Ionicons name={meta.icon} size={11} color={meta.color} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: meta.color }}>
                            {meta.label}
                          </Text>
                        </View>
                      </View>
                      {!isLast && (
                        <View style={{ height: 1, backgroundColor: '#f4f4f5', marginHorizontal: 14 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── How it Works ── */}
          <View style={{
            backgroundColor: '#fff', borderRadius: 20, padding: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181b', marginBottom: 14 }}>
              How it Works
            </Text>
            <View style={{ gap: 16 }}>
              {HOW_IT_WORKS.map((item, idx) => (
                <View key={item.title} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={{ flex: 1, paddingTop: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#18181b' }}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: '#71717a', marginTop: 3, lineHeight: 17 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
