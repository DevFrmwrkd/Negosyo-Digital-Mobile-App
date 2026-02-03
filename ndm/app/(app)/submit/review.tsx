import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Id } from '../../../convex/_generated/dataModel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SubmitReviewScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const submitSubmission = useMutation(api.submissions.submit);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video player state
  const videoRef = useRef<Video>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const fullscreenVideoRef = useRef<Video>(null);

  const submission = useQuery(
    api.submissions.getById,
    submissionId ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  const photoUrls = useQuery(
    api.files.getMultipleUrls,
    submission?.photos && submission.photos.length > 0
      ? { storageIds: submission.photos }
      : 'skip'
  );

  // Get video URL if video interview exists
  const videoUrl = useQuery(
    api.files.getUrl,
    submission?.videoStorageId
      ? { storageId: submission.videoStorageId }
      : 'skip'
  );

  // Load submission ID
  useEffect(() => {
    const loadSubmissionId = async () => {
      const id = await AsyncStorage.getItem('current_submission_id');
      if (!id) {
        // No active submission - redirect to dashboard instead of allowing re-upload
        router.replace('/(app)/dashboard');
        return;
      }
      setSubmissionId(id);
    };
    loadSubmissionId();
  }, []);

  const handleSubmit = async () => {
    if (!submissionId || !submission) return;

    // Validate
    if (!submission.photos || submission.photos.length < 3) {
      setError('Please upload at least 3 photos before submitting.');
      return;
    }

    Alert.alert(
      'Submit Business',
      'Are you sure you want to submit this business for review? You won\'t be able to edit it after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setLoading(true);
            setError(null);

            try {
              await submitSubmission({ id: submissionId as Id<'submissions'> });

              // Clear the current submission ID
              await AsyncStorage.removeItem('current_submission_id');

              // Navigate to success - the success page handles back button to go to dashboard
              router.replace('/(app)/submit/success');
            } catch (err: any) {
              console.error('Error submitting:', err);
              setError(err.message || 'Failed to submit');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!isLoaded || creator === undefined || !submissionId || submission === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!submission) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-lg font-bold text-zinc-900 mt-4">Submission Not Found</Text>
        <TouchableOpacity
          className="mt-4 px-6 py-3 bg-emerald-500 rounded-xl"
          onPress={() => router.replace('/(app)/dashboard')}
        >
          <Text className="text-white font-semibold">Go to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const hasPhotos = submission.photos && submission.photos.length >= 3;
  const hasVideoInterview = !!submission.videoStorageId;
  const hasAudioInterview = !!submission.audioStorageId;
  const hasInterview = hasAudioInterview || hasVideoInterview;
  const canSubmit = hasPhotos;

  // Video playback handlers
  const toggleVideoPlayback = async () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const openFullscreenVideo = () => {
    setVideoError(null);
    setIsVideoLoading(true);
    setShowFullscreenVideo(true);
  };

  const closeFullscreenVideo = async () => {
    try {
      if (fullscreenVideoRef.current) {
        await fullscreenVideoRef.current.stopAsync();
        await fullscreenVideoRef.current.unloadAsync();
      }
    } catch (e) {
      console.log('Error stopping video:', e);
    }
    setShowFullscreenVideo(false);
    setVideoError(null);
    setIsVideoLoading(false);
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-white"
        >
          <Ionicons name="arrow-back" size={20} color="#18181b" />
        </TouchableOpacity>
        <Text className="text-sm text-zinc-500 font-medium">STEP 4 OF 4</Text>
      </View>

      {/* Progress Bar */}
      <View className="px-4 mb-4">
        <View className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <View className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text className="text-2xl font-bold text-zinc-900 mb-2">Review & Submit</Text>
        <Text className="text-sm text-zinc-500 mb-6">
          Review your submission before sending it for approval.
        </Text>

        {/* Error Message */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        )}

        {/* Business Info Card */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-bold text-zinc-900">Business Information</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/submit/info')}>
              <Text className="text-emerald-600 text-sm font-medium">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="space-y-2">
            <View className="flex-row mb-2">
              <Text className="text-zinc-500 text-sm w-24">Name:</Text>
              <Text className="text-zinc-900 text-sm font-medium flex-1">
                {submission.businessName}
              </Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="text-zinc-500 text-sm w-24">Type:</Text>
              <Text className="text-zinc-900 text-sm font-medium flex-1">
                {submission.businessType}
              </Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="text-zinc-500 text-sm w-24">Owner:</Text>
              <Text className="text-zinc-900 text-sm font-medium flex-1">
                {submission.ownerName}
              </Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="text-zinc-500 text-sm w-24">Phone:</Text>
              <Text className="text-zinc-900 text-sm font-medium flex-1">
                {submission.ownerPhone}
              </Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="text-zinc-500 text-sm w-24">Address:</Text>
              <Text className="text-zinc-900 text-sm font-medium flex-1">
                {submission.address}, {submission.city}
              </Text>
            </View>
          </View>
        </View>

        {/* Photos Card */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Text className="text-base font-bold text-zinc-900">Photos</Text>
              <View
                className={`ml-2 px-2 py-0.5 rounded-full ${
                  hasPhotos ? 'bg-emerald-100' : 'bg-amber-100'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    hasPhotos ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {submission.photos?.length || 0}/3 min
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/submit/photos')}>
              <Text className="text-emerald-600 text-sm font-medium">Edit</Text>
            </TouchableOpacity>
          </View>

          {photoUrls && photoUrls.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {photoUrls.slice(0, 5).map((url, index) => (
                <View key={index} className="mx-1">
                  {url && !url.startsWith('convex:') ? (
                    <Image
                      source={{ uri: url }}
                      className="w-20 h-20 rounded-lg bg-zinc-100"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-20 h-20 rounded-lg bg-zinc-100 items-center justify-center">
                      <ActivityIndicator size="small" color="#a1a1aa" />
                    </View>
                  )}
                </View>
              ))}
              {(submission.photos?.length || 0) > 5 && (
                <View className="mx-1 w-20 h-20 rounded-lg bg-zinc-100 items-center justify-center">
                  <Text className="text-zinc-500 font-medium">
                    +{(submission.photos?.length || 0) - 5}
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View className="py-4 items-center">
              <Ionicons name="images-outline" size={24} color="#a1a1aa" />
              <Text className="text-zinc-400 text-sm mt-1">No photos uploaded</Text>
            </View>
          )}
        </View>

        {/* Interview Card */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Text className="text-base font-bold text-zinc-900">Interview</Text>
              <View
                className={`ml-2 px-2 py-0.5 rounded-full ${
                  hasInterview ? 'bg-emerald-100' : 'bg-zinc-100'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    hasInterview ? 'text-emerald-700' : 'text-zinc-500'
                  }`}
                >
                  {hasInterview ? (hasVideoInterview ? 'Video' : 'Audio') : 'Optional'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/submit/interview')}>
              <Text className="text-emerald-600 text-sm font-medium">Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Video Player for video interviews */}
          {hasVideoInterview && videoUrl && !videoUrl.startsWith('convex:') ? (
            <View>
              <TouchableOpacity
                onPress={openFullscreenVideo}
                className="rounded-xl overflow-hidden bg-zinc-900"
                style={{ height: 180 }}
                activeOpacity={0.8}
              >
                <Video
                  ref={videoRef}
                  source={{ uri: videoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted={true}
                  isLooping={false}
                  positionMillis={0}
                  onLoad={(status) => {
                    setVideoStatus(status);
                    // Seek to 1 second to show a frame instead of black
                    if (videoRef.current && status.isLoaded) {
                      videoRef.current.setPositionAsync(1000);
                    }
                  }}
                  onPlaybackStatusUpdate={(status) => {
                    if (status.isLoaded) {
                      setVideoStatus(status);
                      setIsVideoPlaying(status.isPlaying);
                    }
                  }}
                />
                {/* Play overlay */}
                <View className="absolute inset-0 items-center justify-center bg-black/20">
                  <View className="w-16 h-16 bg-black/60 rounded-full items-center justify-center">
                    <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
                  </View>
                </View>
                {/* Duration badge */}
                {videoStatus?.isLoaded && videoStatus?.durationMillis && (
                  <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded">
                    <Text className="text-white text-xs font-medium">
                      {formatTime(videoStatus.durationMillis)}
                    </Text>
                  </View>
                )}
                {/* Tap to play label */}
                <View className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded">
                  <Text className="text-white text-xs">Tap to play</Text>
                </View>
              </TouchableOpacity>
              <View className="flex-row items-center mt-3">
                <View className="w-10 h-10 rounded-full items-center justify-center bg-emerald-100">
                  <Ionicons name="videocam" size={20} color="#10b981" />
                </View>
                <Text className="ml-3 text-zinc-900">Video interview recorded</Text>
              </View>
            </View>
          ) : hasVideoInterview && (!videoUrl || videoUrl.startsWith('convex:')) ? (
            <View>
              <View className="rounded-xl bg-zinc-100 items-center justify-center" style={{ height: 160 }}>
                <ActivityIndicator size="large" color="#a1a1aa" />
                <Text className="text-zinc-500 text-sm mt-2">Loading video...</Text>
              </View>
              <View className="flex-row items-center mt-3">
                <View className="w-10 h-10 rounded-full items-center justify-center bg-emerald-100">
                  <Ionicons name="videocam" size={20} color="#10b981" />
                </View>
                <Text className="ml-3 text-zinc-900">Video interview recorded</Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center">
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  hasAudioInterview ? 'bg-emerald-100' : 'bg-zinc-100'
                }`}
              >
                <Ionicons
                  name={hasAudioInterview ? 'mic' : 'mic-outline'}
                  size={20}
                  color={hasAudioInterview ? '#10b981' : '#a1a1aa'}
                />
              </View>
              <Text className={`ml-3 ${hasAudioInterview ? 'text-zinc-900' : 'text-zinc-400'}`}>
                {hasAudioInterview ? 'Audio interview recorded' : 'No interview recorded'}
              </Text>
            </View>
          )}

          {/* Transcription Status */}
          {hasInterview && (
            <View className="mt-3 pt-3 border-t border-zinc-100">
              {submission.transcript ? (
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full items-center justify-center bg-emerald-100">
                    <Ionicons name="checkmark" size={16} color="#10b981" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-zinc-900 text-sm font-medium">Transcription complete</Text>
                    <Text className="text-zinc-500 text-xs mt-0.5" numberOfLines={2}>
                      {submission.transcript.substring(0, 100)}...
                    </Text>
                  </View>
                </View>
              ) : submission.transcriptionStatus === 'failed' || submission.transcriptionStatus === 'skipped' ? (
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full items-center justify-center bg-red-100">
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-zinc-900 text-sm font-medium">
                      {submission.transcriptionStatus === 'skipped' ? 'Transcription skipped' : 'Transcription failed'}
                    </Text>
                    <Text className="text-zinc-500 text-xs mt-0.5" numberOfLines={2}>
                      {submission.transcriptionError || 'An error occurred during transcription'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full items-center justify-center bg-amber-100">
                    <ActivityIndicator size="small" color="#f59e0b" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-zinc-900 text-sm font-medium">Processing transcription...</Text>
                    <Text className="text-zinc-500 text-xs">This may take a few moments</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Payout Info */}
        <View className="bg-emerald-50 rounded-xl p-4 mb-6">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-emerald-600 font-medium">Your Payout</Text>
              <Text className="text-2xl font-bold text-emerald-700">
                ₱{submission.creatorPayout?.toLocaleString() || '500'}
              </Text>
            </View>
            <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center">
              <Ionicons name="cash" size={24} color="#10b981" />
            </View>
          </View>
          <Text className="text-emerald-600 text-xs mt-2">
            You'll receive this amount once the submission is approved and paid.
          </Text>
        </View>

        {/* Spacer */}
        <View className="h-24" />
      </ScrollView>

      {/* Submit Button */}
      <View className="px-4 py-4 bg-white border-t border-zinc-100">
        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center flex-row ${
            loading || !canSubmit ? 'bg-zinc-300' : 'bg-emerald-500'
          }`}
          onPress={handleSubmit}
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <>
              <ActivityIndicator color="white" />
              <Text className="text-white font-semibold text-base ml-2">Submitting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="send" size={20} color="white" />
              <Text className="text-white font-semibold text-base ml-2">Submit for Review</Text>
            </>
          )}
        </TouchableOpacity>
        {!canSubmit && (
          <Text className="text-center text-amber-600 text-sm mt-2">
            Please upload at least 3 photos to submit.
          </Text>
        )}
      </View>

      {/* Fullscreen Video Modal */}
      <Modal
        visible={showFullscreenVideo}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={closeFullscreenVideo}
      >
        <View className="flex-1 bg-black">
          {/* Close Button */}
          <SafeAreaView className="absolute top-0 left-0 right-0 z-10">
            <View className="flex-row justify-between items-center px-4 py-2">
              <TouchableOpacity
                onPress={closeFullscreenVideo}
                className="w-12 h-12 bg-black/60 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Loading indicator */}
          {isVideoLoading && !videoError && (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator size="large" color="white" />
              <Text className="text-white mt-4">Loading video...</Text>
            </View>
          )}

          {/* Error state */}
          {videoError && (
            <View className="absolute inset-0 items-center justify-center px-6">
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text className="text-white text-center mt-4">{videoError}</Text>
              <TouchableOpacity
                onPress={closeFullscreenVideo}
                className="mt-4 px-6 py-3 bg-zinc-700 rounded-xl"
              >
                <Text className="text-white font-semibold">Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Video Player */}
          {showFullscreenVideo && videoUrl && !videoUrl.startsWith('convex:') && !videoError && (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: videoUrl }}
              style={{ flex: 1 }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={true}
              isLooping={false}
              useNativeControls={true}
              progressUpdateIntervalMillis={500}
              onLoad={() => {
                setIsVideoLoading(false);
              }}
              onError={(error) => {
                console.error('Video playback error:', error);
                setIsVideoLoading(false);
                setVideoError('Failed to play video. The video may be too large or corrupted.');
              }}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && status.didJustFinish) {
                  // Video finished playing
                }
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
