import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = ((firstName || 'U').substring(0, 2) + (lastName || 'U').substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const createCreator = useMutation(api.creators.create);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Get creator profile from Convex
  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  // Get submissions from Convex
  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  // Auto-create creator profile if missing (for OAuth users)
  useEffect(() => {
    const autoCreateProfile = async () => {
      if (isLoaded && isSignedIn && user && creator === null && !isCreatingProfile) {
        setIsCreatingProfile(true);
        try {
          const referralCode = generateReferralCode(
            user.firstName || '',
            user.lastName || ''
          );
          await createCreator({
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress || '',
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            referralCode,
          });
        } catch (err) {
          console.error('Failed to auto-create profile:', err);
        } finally {
          setIsCreatingProfile(false);
        }
      }
    };
    autoCreateProfile();
  }, [isLoaded, isSignedIn, user, creator, isCreatingProfile, createCreator]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  // Loading state
  if (!isLoaded || !isSignedIn || creator === undefined || isCreatingProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Still loading creator
  if (!creator) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Get recent submissions (limit to 3)
  const recentSubmissions = submissions?.slice(0, 3) || [];

  const getStatusBadge = (sub: any) => {
    const isIncomplete =
      !sub.photos ||
      sub.photos.length === 0 ||
      (!sub.videoStorageId && !sub.audioStorageId);
    const isDraft = sub.status === 'draft' || isIncomplete;

    if (sub.status === 'approved') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified' };
    if (sub.status === 'rejected') return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' };
    if (isDraft) return { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Draft' };
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' };
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-zinc-100 rounded-full items-center justify-center border border-zinc-200">
                <Ionicons name="person" size={24} color="#71717a" />
              </View>
              <View className="ml-3">
                <Text className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                  Welcome back
                </Text>
                <Text className="text-lg font-bold text-zinc-900">
                  Mabuhay, {creator.firstName || 'Creator'}!
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="p-2"
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={24} color="#71717a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content */}
        <View className="px-4 py-4">
          {/* Balance Card */}
          <View className="bg-zinc-900 rounded-3xl p-5 mb-6 shadow-xl">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-zinc-400 text-xs font-medium">Available Balance</Text>
              <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="wallet" size={16} color="#34d399" />
              </View>
            </View>

            <Text className="text-3xl font-bold text-white tracking-tight">
              ₱ {creator.balance?.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) || '0.00'}
            </Text>
          </View>

          {/* Submission Status Section */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-zinc-900">Submission Status</Text>
              <Link href="/(app)/submissions" asChild>
                <TouchableOpacity>
                  <Text className="text-xs font-semibold text-emerald-600">View All</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Submissions List */}
            <View className="space-y-3">
              {recentSubmissions.map((sub: any) => {
                const badge = getStatusBadge(sub);
                const isIncomplete =
                  !sub.photos ||
                  sub.photos.length === 0 ||
                  (!sub.videoStorageId && !sub.audioStorageId);
                const isDraft = sub.status === 'draft' || isIncomplete;

                return (
                  <Link key={sub._id} href={`/(app)/submissions/${sub._id}`} asChild>
                    <TouchableOpacity className="bg-white rounded-xl p-3 border border-zinc-100 shadow-sm flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center flex-1">
                        <View
                          className={`w-10 h-10 rounded-xl items-center justify-center ${
                            isDraft
                              ? 'bg-zinc-100'
                              : sub.status === 'approved'
                              ? 'bg-emerald-100'
                              : sub.status === 'rejected'
                              ? 'bg-red-100'
                              : 'bg-yellow-100'
                          }`}
                        >
                          <Ionicons
                            name={isDraft ? 'time' : 'storefront'}
                            size={20}
                            color={
                              isDraft
                                ? '#71717a'
                                : sub.status === 'approved'
                                ? '#10b981'
                                : sub.status === 'rejected'
                                ? '#ef4444'
                                : '#eab308'
                            }
                          />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="font-bold text-sm text-zinc-900" numberOfLines={1}>
                            {sub.businessName}
                          </Text>
                          <Text className="text-xs text-zinc-500">
                            Submitted {new Date(sub._creationTime).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                        <Text className={`text-xs font-bold ${badge.text}`}>{badge.label}</Text>
                      </View>
                    </TouchableOpacity>
                  </Link>
                );
              })}

              {recentSubmissions.length === 0 && (
                <View className="py-8 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 items-center">
                  <Ionicons name="folder-open-outline" size={32} color="#a1a1aa" />
                  <Text className="text-zinc-500 text-sm mt-2">No submissions yet.</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <View className="absolute bottom-6 left-0 right-0 items-center">
        <Link href="/(app)/submit/info" asChild>
          <TouchableOpacity className="flex-row items-center bg-emerald-500 rounded-full px-6 py-4 shadow-lg shadow-emerald-500/40">
            <Ionicons name="add" size={24} color="white" />
            <Text className="text-white font-bold text-base ml-2">Add Submission</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}
