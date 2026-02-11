import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Id } from '../../../convex/_generated/dataModel';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SubmissionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const submission = useQuery(
    api.submissions.getByIdWithCreator,
    id ? { id: id as Id<'submissions'> } : 'skip'
  );

  const photoUrls = useQuery(
    api.files.getMultipleUrls,
    submission?.photos && submission.photos.length > 0
      ? { storageIds: submission.photos }
      : 'skip'
  );

  if (submission === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!submission) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 py-4 flex-row items-center border-b border-zinc-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
          >
            <Ionicons name="arrow-back" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-zinc-900 ml-4">Submission</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-lg font-bold text-zinc-900 mt-4">Submission Not Found</Text>
          <Text className="text-zinc-500 text-center mt-2">
            This submission may have been deleted or doesn't exist.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusBadge = () => {
    const isIncomplete =
      !submission.photos ||
      submission.photos.length === 0 ||
      (!submission.videoStorageId && !submission.audioStorageId);
    const isDraft = submission.status === 'draft' || isIncomplete;

    if (submission.status === 'approved') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Verified', icon: 'checkmark-circle' };
    if (submission.status === 'rejected') return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: 'close-circle' };
    if (isDraft) return { bg: 'bg-zinc-100', text: 'text-zinc-600', label: 'Draft', icon: 'time' };
    if (submission.status === 'website_generated') return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Website Ready', icon: 'globe' };
    if (submission.status === 'deployed') return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Deployed', icon: 'rocket' };
    if (submission.status === 'paid') return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid', icon: 'cash' };
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Review', icon: 'hourglass' };
  };

  const badge = getStatusBadge();
  const isIncomplete =
    !submission.photos ||
    submission.photos.length === 0 ||
    (!submission.videoStorageId && !submission.audioStorageId);
  const isDraft = submission.status === 'draft' || isIncomplete;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center border-b border-zinc-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
        >
          <Ionicons name="arrow-back" size={20} color="#18181b" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-900 ml-4 flex-1" numberOfLines={1}>
          {submission.businessName}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View className="px-4 py-4">
          <View className={`rounded-2xl p-4 ${badge.bg}`}>
            <View className="flex-row items-center">
              <Ionicons name={badge.icon as any} size={24} color={badge.text.includes('emerald') ? '#10b981' : badge.text.includes('red') ? '#ef4444' : badge.text.includes('yellow') ? '#eab308' : badge.text.includes('blue') ? '#3b82f6' : badge.text.includes('purple') ? '#8b5cf6' : '#71717a'} />
              <Text className={`text-lg font-bold ml-2 ${badge.text}`}>{badge.label}</Text>
            </View>
            <Text className="text-zinc-600 text-sm mt-2">
              Submitted on {new Date(submission._creationTime).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Business Info */}
        <View className="px-4 py-2">
          <Text className="text-base font-bold text-zinc-900 mb-3">Business Information</Text>
          
          <View className="bg-zinc-50 rounded-xl p-4 space-y-3">
            <View className="flex-row items-center">
              <Ionicons name="business" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Business Name</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.businessName}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="pricetag" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Business Type</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.businessType}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="person" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Owner</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.ownerName}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="call" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Phone</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.ownerPhone}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center">
              <Ionicons name="location" size={18} color="#71717a" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-zinc-500">Address</Text>
                <Text className="text-sm font-medium text-zinc-900">{submission.address}, {submission.city}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Photos Section */}
        <View className="px-4 py-4">
          <Text className="text-base font-bold text-zinc-900 mb-3">
            Photos ({submission.photos?.length || 0})
          </Text>
          
          {photoUrls && photoUrls.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {photoUrls.map((url, index) => (
                url && !url.startsWith('convex:') ? (
                  <View key={index} className="mx-1">
                    <Image
                      source={{ uri: url }}
                      className="w-32 h-32 rounded-xl bg-zinc-100"
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View key={index} className="mx-1 w-32 h-32 rounded-xl bg-zinc-100 items-center justify-center">
                    <ActivityIndicator size="small" color="#a1a1aa" />
                  </View>
                )
              ))}
            </ScrollView>
          ) : (
            <View className="bg-zinc-50 rounded-xl p-6 items-center">
              <Ionicons name="images-outline" size={32} color="#a1a1aa" />
              <Text className="text-zinc-500 text-sm mt-2">No photos uploaded</Text>
            </View>
          )}
        </View>

        {/* Interview Section */}
        <View className="px-4 py-4">
          <Text className="text-base font-bold text-zinc-900 mb-3">Interview</Text>
          
          <View className="bg-zinc-50 rounded-xl p-4">
            {submission.videoStorageId || submission.audioStorageId ? (
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center">
                  <Ionicons
                    name={submission.videoStorageId ? 'videocam' : 'mic'}
                    size={20}
                    color="#10b981"
                  />
                </View>
                <View className="ml-3">
                  <Text className="text-sm font-medium text-zinc-900">
                    {submission.videoStorageId ? 'Video' : 'Audio'} Interview Uploaded
                  </Text>
                  <Text className="text-xs text-zinc-500">Recording available</Text>
                </View>
              </View>
            ) : (
              <View className="items-center py-2">
                <Ionicons name="mic-off-outline" size={32} color="#a1a1aa" />
                <Text className="text-zinc-500 text-sm mt-2">No interview uploaded</Text>
              </View>
            )}
          </View>
        </View>

        {/* Earnings Section */}
        <View className="px-4 py-4 mb-6">
          <Text className="text-base font-bold text-zinc-900 mb-3">Expected Earnings</Text>

          <View className={`rounded-xl p-4 ${isDraft ? 'bg-zinc-50' : 'bg-emerald-50'}`}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className={`text-xs font-medium ${isDraft ? 'text-zinc-500' : 'text-emerald-600'}`}>
                  {isDraft ? 'Expected Payout' : 'Your Payout'}
                </Text>
                <Text className={`text-2xl font-bold ${isDraft ? 'text-zinc-400' : 'text-emerald-700'}`}>
                  {submission.creatorPayout ? `₱${submission.creatorPayout.toLocaleString()}` : '--'}
                </Text>
                {isDraft && !submission.creatorPayout && (
                  <Text className="text-xs text-zinc-400 mt-1">
                    Complete interview to see payout
                  </Text>
                )}
              </View>
              <View className={`w-12 h-12 rounded-full items-center justify-center ${isDraft ? 'bg-zinc-100' : 'bg-emerald-100'}`}>
                <Ionicons name="cash" size={24} color={isDraft ? '#a1a1aa' : '#10b981'} />
              </View>
            </View>
          </View>
        </View>

        {/* Website URL if available */}
        {submission.websiteUrl && (
          <View className="px-4 py-4 mb-6">
            <Text className="text-base font-bold text-zinc-900 mb-3">Generated Website</Text>
            <TouchableOpacity
              className="bg-blue-50 rounded-xl p-4 flex-row items-center"
              onPress={() => Linking.openURL(submission.websiteUrl!)}
            >
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
                <Ionicons name="globe" size={20} color="#3b82f6" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-medium text-blue-700">View Website</Text>
                <Text className="text-xs text-blue-500" numberOfLines={1}>
                  {submission.websiteUrl}
                </Text>
              </View>
              <Ionicons name="open-outline" size={20} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Continue Submission Button (for drafts) */}
      {isDraft && (
        <View className="px-4 py-4 border-t border-zinc-100">
          <TouchableOpacity
            className="bg-emerald-500 rounded-xl py-4 items-center"
            onPress={async () => {
              await AsyncStorage.setItem('current_submission_id', submission._id);
              const route = !submission.photos || submission.photos.length === 0
                ? '/(app)/submit/photos'
                : !submission.videoStorageId && !submission.audioStorageId
                ? '/(app)/submit/interview'
                : '/(app)/submit/review';
              router.push(route as any);
            }}
          >
            <Text className="text-white font-bold text-base">Continue Submission</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
