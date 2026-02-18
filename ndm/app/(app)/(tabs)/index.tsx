import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushNotifications } from '../../../hooks/usePushNotifications';

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = ((firstName || 'U').substring(0, 2) + (lastName || 'U').substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

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

const NOTIFICATION_META: Record<string, { icon: any; color: string; bg: string }> = {
  submission_approved: { icon: 'checkmark-circle',   color: '#10b981', bg: '#d1fae5' },
  submission_rejected: { icon: 'close-circle',       color: '#ef4444', bg: '#fee2e2' },
  payout_sent:         { icon: 'cash-outline',       color: '#10b981', bg: '#d1fae5' },
  new_lead:            { icon: 'person-add-outline', color: '#3b82f6', bg: '#dbeafe' },
  website_live:        { icon: 'globe-outline',      color: '#8b5cf6', bg: '#ede9fe' },
  submission_created:  { icon: 'add-circle-outline', color: '#6366f1', bg: '#eef2ff' },
  profile_updated:     { icon: 'person-circle-outline', color: '#f59e0b', bg: '#fffbeb' },
  password_changed:    { icon: 'lock-closed',        color: '#71717a', bg: '#f4f4f5' },
  system:              { icon: 'information-circle', color: '#71717a', bg: '#f4f4f5' },
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoaded, isSignedIn } = useUser();
  const createCreator = useMutation(api.creators.create);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );
  const notifications = useQuery(
    api.notifications.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  usePushNotifications(creator?._id);

  // Auto-create creator profile for OAuth users
  useEffect(() => {
    const autoCreate = async () => {
      if (isLoaded && isSignedIn && user && creator === null && !isCreatingProfile) {
        setIsCreatingProfile(true);
        try {
          await createCreator({
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress || '',
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            referralCode: generateReferralCode(user.firstName || '', user.lastName || ''),
          });
        } catch (err) {
          console.error('Failed to auto-create profile:', err);
        } finally {
          setIsCreatingProfile(false);
        }
      }
    };
    autoCreate();
  }, [isLoaded, isSignedIn, user, creator, isCreatingProfile, createCreator]);

  if (!isLoaded || !isSignedIn || creator === undefined || isCreatingProfile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const recentSubmissions = submissions?.slice(0, 3) || [];
  const recentActivity    = notifications?.slice(0, 5) || [];

  const totalSubs    = submissions?.length ?? 0;
  const pendingSubs  = submissions?.filter((s: any) => s.status === 'submitted' || s.status === 'pending').length ?? 0;
  const approvedSubs = submissions?.filter((s: any) => s.status === 'approved').length ?? 0;

  const getStatusBadge = (sub: any) => {
    const isIncomplete = !sub.photos || sub.photos.length === 0 || (!sub.videoStorageId && !sub.audioStorageId);
    const isDraft = sub.status === 'draft' || isIncomplete;
    if (sub.status === 'approved') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified' };
    if (sub.status === 'rejected') return { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Rejected' };
    if (isDraft)                   return { bg: 'bg-zinc-100',    text: 'text-zinc-600',    label: 'Draft' };
    if (sub.status === 'submitted') return { bg: 'bg-blue-100',  text: 'text-blue-700',    label: 'In Review' };
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' };
  };

  const getSubIcon = (sub: any) => {
    const isIncomplete = !sub.photos || sub.photos.length === 0 || (!sub.videoStorageId && !sub.audioStorageId);
    const isDraft = sub.status === 'draft' || isIncomplete;
    if (isDraft)                    return { icon: 'time-outline',           color: '#71717a', bg: '#f4f4f5' };
    if (sub.status === 'approved')  return { icon: 'checkmark-circle',      color: '#10b981', bg: '#d1fae5' };
    if (sub.status === 'rejected')  return { icon: 'close-circle',          color: '#ef4444', bg: '#fee2e2' };
    if (sub.status === 'submitted') return { icon: 'hourglass-outline',     color: '#3b82f6', bg: '#dbeafe' };
    return { icon: 'storefront-outline', color: '#eab308', bg: '#fef9c3' };
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{
          backgroundColor: '#fff',
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f5',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#18181b',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: '#e4e4e7',
                overflow: 'hidden',
              }}>
                {(creator as any).profileImage ? (
                  <Image
                    source={{ uri: (creator as any).profileImage }}
                    style={{ width: 44, height: 44, borderRadius: 22 }}
                  />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                    {(creator.firstName || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View>
                <Text style={{ fontSize: 12, color: '#a1a1aa', fontWeight: '500', letterSpacing: 0.5 }}>
                  WELCOME BACK
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#18181b' }}>
                  {creator.firstName ? `Mabuhay, ${creator.firstName}!` : 'Mabuhay!'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ padding: 8 }}
              onPress={() => router.push('/(app)/notifications' as any)}
            >
              <View>
                <Ionicons name="notifications-outline" size={24} color="#52525b" />
                {(unreadCount ?? 0) > 0 && (
                  <View style={{
                    position: 'absolute', top: -2, right: -2,
                    backgroundColor: '#ef4444', borderRadius: 8,
                    minWidth: 16, height: 16,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                      {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>

          {/* ── Balance Card ── */}
          <View style={{
            backgroundColor: '#18181b',
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 6,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View>
                <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '500', letterSpacing: 0.5 }}>
                  AVAILABLE BALANCE
                </Text>
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 }}>
                  ₱{(creator.balance ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: '#27272a',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="wallet" size={20} color="#34d399" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#27272a', borderRadius: 12, padding: 10 }}>
                <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '500' }}>TOTAL EARNED</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                  ₱{((creator as any).totalEarnings ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#27272a', borderRadius: 12, padding: 10 }}>
                <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '500' }}>WITHDRAWN</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                  ₱{((creator as any).totalWithdrawn ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Quick Stats ── */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Total',    value: totalSubs,    icon: 'layers-outline',          color: '#6366f1', bg: '#eef2ff' },
              { label: 'In Review', value: pendingSubs,  icon: 'hourglass-outline',       color: '#f59e0b', bg: '#fffbeb' },
              { label: 'Verified', value: approvedSubs, icon: 'checkmark-circle-outline', color: '#10b981', bg: '#d1fae5' },
            ].map((stat) => (
              <View key={stat.label} style={{
                flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
                alignItems: 'center', gap: 6,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: stat.bg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#18181b' }}>{stat.value}</Text>
                <Text style={{ fontSize: 10, color: '#a1a1aa', fontWeight: '600', letterSpacing: 0.3 }}>
                  {stat.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Recent Submissions ── */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b' }}>Submissions</Text>
              <Link href="/(app)/submissions" asChild>
                <TouchableOpacity>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#10b981' }}>View All</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {recentSubmissions.length === 0 ? (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 28,
                alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 60, height: 60, borderRadius: 30,
                  backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="storefront-outline" size={28} color="#a1a1aa" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#3f3f46', marginTop: 10 }}>No submissions yet</Text>
                <Text style={{ fontSize: 13, color: '#a1a1aa', textAlign: 'center', lineHeight: 19, marginTop: 4 }}>
                  Tap the green button below to{'\n'}list your first business!
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(app)/submit/info' as any)}
                  style={{
                    marginTop: 12, backgroundColor: '#18181b',
                    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Get Started</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {recentSubmissions.map((sub: any) => {
                  const badge = getStatusBadge(sub);
                  const iconInfo = getSubIcon(sub);
                  return (
                    <Link key={sub._id} href={`/(app)/submissions/${sub._id}`} asChild>
                      <TouchableOpacity style={{
                        backgroundColor: '#fff', borderRadius: 16, padding: 14,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                          <View style={{
                            width: 44, height: 44, borderRadius: 14,
                            backgroundColor: iconInfo.bg,
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Ionicons name={iconInfo.icon as any} size={22} color={iconInfo.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: '#18181b' }} numberOfLines={1}>
                              {sub.businessName}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>
                              {new Date(sub._creationTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                          </View>
                        </View>
                        <View style={{
                          paddingHorizontal: 10, paddingVertical: 4,
                          borderRadius: 20, backgroundColor: badge.bg.replace('bg-', ''),
                        }} className={badge.bg}>
                          <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
                        </View>
                      </TouchableOpacity>
                    </Link>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Recent Activity ── */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b' }}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/notifications' as any)}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#10b981' }}>See All</Text>
              </TouchableOpacity>
            </View>

            {notifications === undefined ? (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 24,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <ActivityIndicator size="small" color="#a1a1aa" />
              </View>
            ) : recentActivity.length === 0 ? (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 24,
                alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="pulse-outline" size={24} color="#a1a1aa" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#3f3f46', marginTop: 10 }}>No activity yet</Text>
                <Text style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'center', lineHeight: 18, marginTop: 4 }}>
                  Your recent actions and updates{'\n'}will appear here.
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                {recentActivity.map((notif: any, idx: number) => {
                  const meta = NOTIFICATION_META[notif.type] ?? { icon: 'notifications-outline', color: '#71717a', bg: '#f4f4f5' };
                  const isLast = idx === recentActivity.length - 1;
                  return (
                    <View key={notif._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: meta.bg,
                          alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#18181b' }} numberOfLines={1}>
                            {notif.title}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#71717a', marginTop: 1 }} numberOfLines={2}>
                            {notif.body}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                          <Text style={{ fontSize: 10, color: '#a1a1aa', fontWeight: '500' }}>
                            {timeAgo(notif._creationTime ?? notif.createdAt)}
                          </Text>
                          {!notif.read && (
                            <View style={{
                              width: 6, height: 6, borderRadius: 3,
                              backgroundColor: '#10b981', marginTop: 4,
                            }} />
                          )}
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

        </View>
      </ScrollView>
    </View>
  );
}
