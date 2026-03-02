import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

export default function SubmitSuccessScreen() {
  const router = useRouter();
  const { queued } = useLocalSearchParams<{ queued?: string }>();
  const isQueued = queued === 'true';
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Load submission ID — only clear it if NOT queued (offline sync still needs it)
  useEffect(() => {
    const loadSubmissionId = async () => {
      const id = await AsyncStorage.getItem('current_submission_id');
      if (id) {
        setSubmissionId(id);
        if (!isQueued) {
          await AsyncStorage.removeItem('current_submission_id');
        }
      }
    };
    loadSubmissionId();
  }, [isQueued]);

  // Intercept back button to go to dashboard instead of back through submit flow
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/dashboard');
        return true; // Prevent default back behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [router])
  );

  // Query the submission to check transcription status (skip for queued/offline_pending)
  const canQuery = submissionId && submissionId !== 'offline_pending' && !isQueued;
  const submission = useQuery(
    api.submissions.getById,
    canQuery ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  const hasInterview = submission?.videoStorageId || submission?.audioStorageId;
  const hasTranscription = !!submission?.transcript;
  const transcriptionFailed = submission?.transcriptionStatus === 'failed' || submission?.transcriptionStatus === 'skipped';
  const isProcessing = hasInterview && !hasTranscription && !transcriptionFailed;

  // ── Queued (offline) success state ──
  if (isQueued) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-6">
          {/* Queued Icon */}
          <View className="w-24 h-24 bg-amber-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="cloud-upload-outline" size={56} color="#f59e0b" />
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-zinc-900 text-center mb-2">
            Submission Saved!
          </Text>

          {/* Description */}
          <Text className="text-zinc-500 text-center mb-8 px-4">
            Your data is saved locally on your device. It will automatically upload and submit for review once you reconnect to the internet.
          </Text>

          {/* Info Card */}
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full mb-8">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#d97706" style={{ marginTop: 1 }} />
              <View className="ml-3 flex-1">
                <Text className="text-amber-800 font-medium text-sm mb-1">What happens when you're back online?</Text>
                <Text className="text-amber-700 text-xs mb-1">1. Your business info, photos, and interview will upload automatically.</Text>
                <Text className="text-amber-700 text-xs mb-1">2. Your submission will be sent for review.</Text>
                <Text className="text-amber-700 text-xs">3. You'll receive a notification confirming the sync.</Text>
              </View>
            </View>
          </View>

          {/* Button */}
          <View className="w-full">
            <TouchableOpacity
              className="h-14 bg-amber-500 rounded-xl items-center justify-center"
              onPress={() => router.replace('/(app)/dashboard')}
            >
              <Text className="text-white font-semibold text-base">Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Normal (online) success state ──
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        {/* Success Icon */}
        <View className="w-24 h-24 bg-emerald-100 rounded-full items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={64} color="#10b981" />
        </View>

        {/* Title */}
        <Text className="text-2xl font-bold text-zinc-900 text-center mb-2">
          Submission Complete!
        </Text>

        {/* Description */}
        <Text className="text-zinc-500 text-center mb-8 px-4">
          Your business submission has been sent for review. We'll notify you once it's approved.
        </Text>

        {/* Transcription Status Card */}
        {hasInterview && (
          <View className={`rounded-xl p-4 w-full mb-4 ${
            hasTranscription ? 'bg-emerald-50' : transcriptionFailed ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            <View className="flex-row items-center">
              {hasTranscription ? (
                <>
                  <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center">
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-emerald-800 font-medium">Transcription Complete</Text>
                    <Text className="text-emerald-600 text-xs mt-0.5">
                      Your interview has been transcribed successfully
                    </Text>
                  </View>
                </>
              ) : transcriptionFailed ? (
                <>
                  <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center">
                    <Ionicons name="alert-circle" size={24} color="#ef4444" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-red-800 font-medium">
                      {submission?.transcriptionStatus === 'skipped' ? 'Transcription Skipped' : 'Transcription Failed'}
                    </Text>
                    <Text className="text-red-600 text-xs mt-0.5">
                      {submission?.transcriptionError || 'Your submission is still valid and will be reviewed.'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center">
                    <ActivityIndicator size="small" color="#f59e0b" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-amber-800 font-medium">Processing Transcription...</Text>
                    <Text className="text-amber-600 text-xs mt-0.5">
                      Your interview is being transcribed. This may take a moment.
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Info Card */}
        <View className="bg-zinc-50 rounded-xl p-4 w-full mb-8">
          <Text className="text-sm font-medium text-zinc-700 mb-3">What happens next?</Text>
          <View className="space-y-3">
            <View className="flex-row items-start mb-2">
              <View className="w-6 h-6 bg-emerald-100 rounded-full items-center justify-center mr-3">
                <Text className="text-emerald-600 text-xs font-bold">1</Text>
              </View>
              <Text className="text-zinc-600 text-sm flex-1">
                Our team will review your submission within 24-48 hours.
              </Text>
            </View>
            <View className="flex-row items-start mb-2">
              <View className="w-6 h-6 bg-emerald-100 rounded-full items-center justify-center mr-3">
                <Text className="text-emerald-600 text-xs font-bold">2</Text>
              </View>
              <Text className="text-zinc-600 text-sm flex-1">
                A digital website will be created for the business.
              </Text>
            </View>
            <View className="flex-row items-start mb-2">
              <View className="w-6 h-6 bg-emerald-100 rounded-full items-center justify-center mr-3">
                <Text className="text-emerald-600 text-xs font-bold">3</Text>
              </View>
              <Text className="text-zinc-600 text-sm flex-1">
                You'll receive your payout once the business owner approves.
              </Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View className="w-full space-y-3">
          <TouchableOpacity
            className="h-14 bg-emerald-500 rounded-xl items-center justify-center mb-3"
            onPress={() => router.replace('/(app)/submissions')}
          >
            <Text className="text-white font-semibold text-base">View My Submissions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="h-14 border border-zinc-200 rounded-xl items-center justify-center"
            onPress={() => router.replace('/(app)/dashboard')}
          >
            <Text className="text-zinc-700 font-semibold text-base">Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
