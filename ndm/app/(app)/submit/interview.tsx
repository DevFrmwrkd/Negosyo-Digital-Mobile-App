import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, Video, ResizeMode } from 'expo-av';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Id } from '../../../convex/_generated/dataModel';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';

type InterviewType = 'video' | 'audio' | null;

const INTERVIEW_QUESTIONS = [
  "Tell us about your business. What do you do?",
  "How long have you been operating?",
  "What makes your business special?",
  "What's your biggest challenge right now?",
  "What's your dream for this business?",
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SubmitInterviewScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false); // Server processing after upload
  const [error, setError] = useState<string | null>(null);

  // Interview type selection
  const [interviewType, setInterviewType] = useState<InterviewType>(null);

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasExistingRecording, setHasExistingRecording] = useState(false);
  const [existingType, setExistingType] = useState<InterviewType>(null);
  const [wantsToReRecord, setWantsToReRecord] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('front'); // Default to front for interviews
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showLightingTip, setShowLightingTip] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  // Parallel audio recording for video transcription (separate smaller file)
  const [parallelAudioRecording, setParallelAudioRecording] = useState<Audio.Recording | null>(null);
  const [parallelAudioUri, setParallelAudioUri] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Video playback state
  const videoRef = useRef<Video>(null);
  const fullscreenVideoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState<any>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const progressBarRef = useRef<View>(null);

  // Audio playback state
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const isOfflinePending = submissionId === 'offline_pending';

  const submission = useQuery(
    api.submissions.getById,
    submissionId && !isOfflinePending ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  // Load submission ID
  useEffect(() => {
    const loadSubmissionId = async () => {
      let id = await AsyncStorage.getItem('current_submission_id');
      if (!id) {
        const pendingSync = await AsyncStorage.getItem('submission_pending_sync');
        if (pendingSync) {
          id = 'offline_pending';
          await AsyncStorage.setItem('current_submission_id', id);
        } else {
          router.replace('/(app)/dashboard');
          return;
        }
      }
      setSubmissionId(id);
    };
    loadSubmissionId();
  }, []);

  // Check for existing recording
  useEffect(() => {
    if (submission?.videoStorageId) {
      setHasExistingRecording(true);
      setExistingType('video');
    } else if (submission?.audioStorageId) {
      setHasExistingRecording(true);
      setExistingType('audio');
    }
  }, [submission]);

  // Cleanup audio playback on unmount or when audioSound changes
  useEffect(() => {
    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
    };
  }, [audioSound]);

  // Cleanup timer and parallel audio recording on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const requestAudioPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant microphone access to record the interview.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const startAudioRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      setCurrentQuestion(0);
      setError(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording');
    }
  };

  const stopAudioRecording = async () => {
    if (!recording) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Failed to stop recording');
    }
  };

  const pauseAudioRecording = async () => {
    if (!recording) return;

    try {
      await recording.pauseAsync();
      setIsPaused(true);
      // Pause the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {
      console.error('Failed to pause recording:', err);
      setError('Failed to pause recording');
    }
  };

  const resumeAudioRecording = async () => {
    if (!recording) return;

    try {
      await recording.startAsync();
      setIsPaused(false);
      // Resume the timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to resume recording:', err);
      setError('Failed to resume recording');
    }
  };

  const openVideoCamera = async () => {
    if (!cameraPermission?.granted) {
      const camResult = await requestCameraPermission();
      if (!camResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant camera access to record a video interview.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    if (!micPermission?.granted) {
      const micResult = await requestMicPermission();
      if (!micResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant microphone access to record audio with your video.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setCurrentQuestion(0);
    setShowLightingTip(true);
    setShowCamera(true);
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsVideoRecording(true);
      setRecordingDuration(0);
      setParallelAudioUri(null);

      // Start parallel audio recording for transcription (smaller file than video)
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: audioRec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setParallelAudioRecording(audioRec);
        console.log('[Interview] Parallel audio recording started for transcription');
      } catch (audioErr) {
        console.warn('[Interview] Could not start parallel audio recording:', audioErr);
        // Continue with video-only - transcription will use video file
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 600, // 10 minutes max - longer videos supported with streaming upload
      });

      if (video?.uri) {
        setRecordingUri(video.uri);
        setShowCamera(false);
      }
    } catch (err) {
      console.error('Failed to record video:', err);
      setError('Failed to record video');
      // Clean up parallel audio if video failed
      if (parallelAudioRecording) {
        try {
          await parallelAudioRecording.stopAndUnloadAsync();
        } catch {}
        setParallelAudioRecording(null);
      }
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsVideoRecording(false);
    }
  };

  const stopVideoRecording = async () => {
    if (cameraRef.current && isVideoRecording) {
      cameraRef.current.stopRecording();
    }

    // Stop parallel audio recording and save URI for transcription
    if (parallelAudioRecording) {
      try {
        await parallelAudioRecording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const audioUri = parallelAudioRecording.getURI();
        if (audioUri) {
          setParallelAudioUri(audioUri);
          console.log('[Interview] Parallel audio saved:', audioUri);
        }
      } catch (err) {
        console.error('[Interview] Failed to stop parallel audio:', err);
      } finally {
        setParallelAudioRecording(null);
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const nextQuestion = () => {
    if (currentQuestion < INTERVIEW_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const deleteRecording = async () => {
    // Stop and unload audio if playing
    if (audioSound) {
      await audioSound.stopAsync();
      await audioSound.unloadAsync();
      setAudioSound(null);
    }
    setRecordingUri(null);
    setParallelAudioUri(null); // Clear parallel audio too
    setRecordingDuration(0);
    setVideoStatus(null);
    setIsVideoPlaying(false);
    setAudioStatus(null);
    setIsAudioPlaying(false);
    // If user had existing recording and was re-recording, go back to showing existing
    if (hasExistingRecording) {
      setWantsToReRecord(false);
      setInterviewType(null);
    }
  };

  // Audio playback functions
  const loadAndPlayAudio = async () => {
    if (!recordingUri || interviewType !== 'audio') return;

    try {
      // If already loaded, just toggle play/pause
      if (audioSound) {
        if (isAudioPlaying) {
          await audioSound.pauseAsync();
        } else {
          // If finished, replay from start
          if (audioStatus?.didJustFinish || audioStatus?.positionMillis === audioStatus?.durationMillis) {
            await audioSound.replayAsync();
          } else {
            await audioSound.playAsync();
          }
        }
        return;
      }

      // Load the audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true },
        handleAudioStatusUpdate
      );

      setAudioSound(sound);
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  };

  const handleAudioStatusUpdate = (status: any) => {
    setAudioStatus(status);
    setIsAudioPlaying(status.isPlaying);
  };

  const seekAudio = async (forward: boolean) => {
    if (audioSound && audioStatus?.positionMillis !== undefined && audioStatus?.durationMillis) {
      const newPosition = forward
        ? Math.min(audioStatus.durationMillis, audioStatus.positionMillis + 10000)
        : Math.max(0, audioStatus.positionMillis - 10000);
      await audioSound.setPositionAsync(newPosition);
    }
  };

  const toggleVideoPlayback = async () => {
    // Use fullscreen video ref if in fullscreen mode, otherwise use main video ref
    const activeVideoRef = showFullscreen ? fullscreenVideoRef : videoRef;

    if (activeVideoRef.current) {
      if (isVideoPlaying) {
        await activeVideoRef.current.pauseAsync();
      } else {
        // If video finished, replay from start
        if (videoStatus?.didJustFinish || videoStatus?.positionMillis === videoStatus?.durationMillis) {
          await activeVideoRef.current.replayAsync();
        } else {
          await activeVideoRef.current.playAsync();
        }
      }
    }
  };

  const handleVideoStatusUpdate = (status: any) => {
    setVideoStatus(status);
    setIsVideoPlaying(status.isPlaying);
  };

  const handleSeek = async (value: number) => {
    const activeVideoRef = showFullscreen ? fullscreenVideoRef : videoRef;
    if (activeVideoRef.current && videoStatus?.durationMillis) {
      await activeVideoRef.current.setPositionAsync(value * videoStatus.durationMillis);
    }
  };

  const handleProgressBarSeek = async (event: any, barWidth: number, isFullscreen: boolean = false) => {
    const activeVideoRef = isFullscreen ? fullscreenVideoRef : videoRef;
    if (activeVideoRef.current && videoStatus?.durationMillis && barWidth > 0) {
      const touchX = event.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, touchX / barWidth));
      const newPosition = percentage * videoStatus.durationMillis;
      await activeVideoRef.current.setPositionAsync(newPosition);
    }
  };

  const openFullscreen = async () => {
    // Pause main video first
    if (videoRef.current && isVideoPlaying) {
      await videoRef.current.pauseAsync();
    }

    setShowFullscreen(true);

    // Sync position and play state to fullscreen after it opens
    setTimeout(async () => {
      if (fullscreenVideoRef.current && videoStatus?.positionMillis) {
        await fullscreenVideoRef.current.setPositionAsync(videoStatus.positionMillis);
        if (isVideoPlaying) {
          await fullscreenVideoRef.current.playAsync();
        }
      }
    }, 150);
  };

  const closeFullscreen = async () => {
    // Pause fullscreen video first
    if (fullscreenVideoRef.current && isVideoPlaying) {
      await fullscreenVideoRef.current.pauseAsync();
    }

    // Sync position back to main video
    if (videoRef.current && videoStatus?.positionMillis) {
      await videoRef.current.setPositionAsync(videoStatus.positionMillis);
      if (isVideoPlaying) {
        await videoRef.current.playAsync();
      }
    }
    setShowFullscreen(false);
  };

  const formatTime = (millis: number) => {
    if (!millis) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNext = async () => {
    if (!submissionId) return;

    // Require selection if no existing recording
    if (!interviewType && !hasExistingRecording) {
      setError('Please select Video or Audio interview type.');
      return;
    }

    // Allow skipping if no recording but has existing
    if (!recordingUri && !hasExistingRecording) {
      setError('Please record an interview before continuing.');
      return;
    }

    // OFFLINE PATH: Save recording URI locally and navigate
    if (!isConnected || isOfflinePending) {
      try {
        if (recordingUri && interviewType) {
          await AsyncStorage.setItem('submission_pending_interview', JSON.stringify({
            recordingUri,
            parallelAudioUri: parallelAudioUri || null,
            type: interviewType,
            submissionId,
            savedAt: Date.now(),
          }));
        }
        router.push('/(app)/submit/review');
      } catch (err) {
        setError('Failed to save recording locally');
      }
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError(null);

    // Helper function to upload a file to R2
    const uploadFile = async (
      uri: string,
      folder: string,
      contentType: string,
      fileName: string,
      trackProgress: boolean = true
    ): Promise<string> => {
      // Get R2 presigned upload URL
      const { uploadUrl, fileKey } = await generateR2UploadUrl({
        folder,
        filename: fileName,
        contentType,
      });

      let fileUri = uri;
      if (Platform.OS === 'android' && !fileUri.startsWith('file://')) {
        fileUri = 'file://' + fileUri;
      }

      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Use PUT method for R2 presigned URL
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', contentType);

        // Set a long timeout for video uploads (20 minutes for very long videos)
        xhr.timeout = 1200000;

        // Track upload progress (only for main file)
        if (trackProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
              setUploadProgress(progress);
              console.log(`Upload progress: ${progress}%`);
            }
          };

          xhr.upload.onloadend = () => {
            console.log('Upload data sent, waiting for server response...');
            setUploadProgress(100);
            setIsProcessing(true);
          };
        }

        xhr.onload = () => {
          console.log('Upload response status:', xhr.status);
          if (trackProgress) setIsProcessing(false);
          if (xhr.status >= 200 && xhr.status < 300) {
            // R2 returns empty response on success, return the fileKey
            resolve(fileKey);
          } else {
            console.error('Upload failed:', xhr.status, xhr.responseText);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          console.error('XHR error occurred');
          reject(new Error('Network error during upload. Please check your connection and try again.'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload timed out. Please try recording a shorter video (under 3 minutes recommended).'));
        };

        const fileBlob = {
          uri: fileUri,
          type: contentType,
          name: fileName,
        };

        xhr.send(fileBlob as any);
      });
    };

    try {
      if (recordingUri && interviewType) {
        console.log('Uploading file from:', recordingUri);

        const contentType = interviewType === 'video' ? 'video/mp4' : 'audio/m4a';
        const fileName = interviewType === 'video' ? 'interview.mp4' : 'interview.m4a';
        const folder = interviewType === 'video' ? 'videos' : 'audio';

        // Upload main recording (video or audio) to R2
        const fileKey = await uploadFile(recordingUri, folder, contentType, fileName, true);

        // Set payout based on interview type: video = 500, audio = 300
        const payout = interviewType === 'video' ? 500 : 300;

        if (interviewType === 'video') {
          // For video interviews, also upload the parallel audio for transcription
          let transcriptionAudioKey: string | undefined;

          if (parallelAudioUri) {
            console.log('[Interview] Uploading parallel audio for transcription:', parallelAudioUri);
            try {
              transcriptionAudioKey = await uploadFile(
                parallelAudioUri,
                'audio',
                'audio/m4a',
                'interview-audio.m4a',
                false // Don't track progress for background upload
              );
              console.log('[Interview] Parallel audio uploaded:', transcriptionAudioKey);
            } catch (audioErr) {
              console.warn('[Interview] Failed to upload parallel audio, will use video for transcription:', audioErr);
              // Continue without parallel audio - transcription will use video file
            }
          }

          await updateSubmission({
            id: submissionId as Id<'submissions'>,
            videoStorageId: fileKey,
            audioStorageId: transcriptionAudioKey, // Use parallel audio for transcription
            creatorPayout: payout,
          });
        } else {
          await updateSubmission({
            id: submissionId as Id<'submissions'>,
            audioStorageId: fileKey,
            creatorPayout: payout,
          });
        }
      }

      router.push('/(app)/submit/review');
    } catch (err: any) {
      console.error('Error uploading recording:', err);
      setError(err.message || 'Failed to upload recording');
    } finally {
      setLoading(false);
    }
  };

  // When offline, skip Clerk/Convex loading gates — layout already verified auth
  if (!isConnected && (!isLoaded || creator === undefined)) {
    // Offline: allow page to render without creator data
  } else if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!submissionId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-white"
        >
          <Ionicons name="arrow-back" size={20} color="#18181b" />
        </TouchableOpacity>
        <Text className="text-sm text-zinc-500 font-medium">STEP 3 OF 4</Text>
      </View>

      <OfflineBanner />

      {/* Progress Bar */}
      <View className="px-4 mb-4">
        <View className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <View className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text className="text-2xl font-bold text-zinc-900 mb-2">Record Interview</Text>
        <Text className="text-sm text-zinc-500 mb-6">
          Choose how you'd like to record your interview. Video pays more!
        </Text>

        {/* Error Message */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        )}

        {/* Offline Warning */}
        {!isConnected && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <View className="flex-row items-center">
              <Ionicons name="cloud-offline-outline" size={20} color="#d97706" />
              <Text className="text-amber-700 text-sm font-medium ml-2 flex-1">
                You're offline. Record your interview now — it'll upload automatically when you're back online.
              </Text>
            </View>
          </View>
        )}

        {/* Existing Recording Notice - Full UI when not re-recording */}
        {hasExistingRecording && !recordingUri && !wantsToReRecord && (
          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
            <View className="items-center">
              <View className="w-20 h-20 bg-emerald-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              </View>
              <Text className="text-xl font-bold text-emerald-700 mb-2">
                {existingType === 'video' ? 'Video' : 'Audio'} Already Uploaded
              </Text>
              <Text className="text-emerald-600 text-center mb-6">
                Your interview recording has been saved. You can proceed to review or record a new one to replace it.
              </Text>
              <TouchableOpacity
                className="flex-row items-center px-5 py-3 bg-white border border-emerald-300 rounded-full"
                onPress={() => {
                  setWantsToReRecord(true);
                  setInterviewType(existingType);
                }}
              >
                <Ionicons name="refresh" size={18} color="#10b981" />
                <Text className="text-emerald-600 font-medium ml-2">Record New {existingType === 'video' ? 'Video' : 'Audio'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Interview Type Selection - Only show if no existing recording or user wants to re-record */}
        {!recordingUri && !isRecording && (!hasExistingRecording || wantsToReRecord) && (
          <View className="mb-6">
            <Text className="text-base font-bold text-zinc-900 mb-3">Select Interview Type</Text>
            <View className="flex-row">
              {/* Video Option */}
              <TouchableOpacity
                className={`flex-1 mr-2 p-4 rounded-xl border-2 ${
                  interviewType === 'video'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 bg-white'
                }`}
                onPress={() => setInterviewType('video')}
              >
                <View className="items-center">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                    interviewType === 'video' ? 'bg-emerald-100' : 'bg-zinc-100'
                  }`}>
                    <Ionicons
                      name="videocam"
                      size={24}
                      color={interviewType === 'video' ? '#10b981' : '#71717a'}
                    />
                  </View>
                  <Text className={`font-bold ${
                    interviewType === 'video' ? 'text-emerald-700' : 'text-zinc-900'
                  }`}>Video</Text>
                  <Text className="text-emerald-600 font-bold text-lg">₱500</Text>
                  <Text className="text-zinc-500 text-xs text-center mt-1">Higher payout</Text>
                </View>
              </TouchableOpacity>

              {/* Audio Option */}
              <TouchableOpacity
                className={`flex-1 ml-2 p-4 rounded-xl border-2 ${
                  interviewType === 'audio'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 bg-white'
                }`}
                onPress={() => setInterviewType('audio')}
              >
                <View className="items-center">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                    interviewType === 'audio' ? 'bg-emerald-100' : 'bg-zinc-100'
                  }`}>
                    <Ionicons
                      name="mic"
                      size={24}
                      color={interviewType === 'audio' ? '#10b981' : '#71717a'}
                    />
                  </View>
                  <Text className={`font-bold ${
                    interviewType === 'audio' ? 'text-emerald-700' : 'text-zinc-900'
                  }`}>Audio</Text>
                  <Text className="text-yellow-600 font-bold text-lg">₱300</Text>
                  <Text className="text-zinc-500 text-xs text-center mt-1">Quick & easy</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Interview Tips - Only show when recording or wanting to re-record */}
        {(!hasExistingRecording || wantsToReRecord || recordingUri) && (
        <View className="bg-white rounded-xl p-4 mb-6">
          <Text className="text-base font-bold text-zinc-900 mb-3">Interview Tips</Text>
          <View>
            {[
              'Introduce yourself and the business',
              'Describe what makes the business special',
              'Talk about products/services offered',
              'Share operating hours and contact info',
            ].map((tip, index) => (
              <View key={index} className="flex-row items-start mb-2">
                <View className="w-5 h-5 bg-emerald-100 rounded-full items-center justify-center mt-0.5 mr-3">
                  <Text className="text-emerald-600 text-xs font-bold">{index + 1}</Text>
                </View>
                <Text className="text-zinc-600 text-sm flex-1">{tip}</Text>
              </View>
            ))}
          </View>
        </View>
        )}

        {/* Recording Area - Only show if no existing recording or user wants to re-record */}
        {(!hasExistingRecording || wantsToReRecord || recordingUri) && (
        <View className="bg-white rounded-xl p-4 mb-6">
          {recordingUri ? (
            // Recording Complete - Show video preview with custom controls
            <>
              {interviewType === 'video' ? (
                <View className="mb-4">
                  {/* Video Container */}
                  <View className="rounded-xl overflow-hidden bg-black">
                    <TouchableOpacity activeOpacity={0.9} onPress={toggleVideoPlayback}>
                      <Video
                        ref={videoRef}
                        source={{ uri: recordingUri }}
                        style={{ width: '100%', height: 220 }}
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                        onPlaybackStatusUpdate={handleVideoStatusUpdate}
                      />
                      {/* Play/Pause Overlay */}
                      {!isVideoPlaying && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: 'rgba(0,0,0,0.3)'
                          }}
                        >
                          <View className="w-16 h-16 rounded-full bg-white/90 items-center justify-center">
                            <Ionicons
                              name={videoStatus?.didJustFinish ? 'refresh' : 'play'}
                              size={32}
                              color="#18181b"
                              style={{ marginLeft: videoStatus?.didJustFinish ? 0 : 4 }}
                            />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Custom Video Controls */}
                  <View className="mt-3 px-1">
                    {/* Timeline Slider - Touchable */}
                    <View className="flex-row items-center">
                      <Text className="text-xs text-zinc-500 w-10">
                        {formatTime(videoStatus?.positionMillis || 0)}
                      </Text>
                      <View
                        className="flex-1 mx-2 h-8 justify-center"
                        onTouchEnd={(event) => {
                          const touchX = event.nativeEvent.locationX;
                          const barWidth = event.nativeEvent.target ? SCREEN_WIDTH - 100 : 200; // Approximate width
                          if (videoRef.current && videoStatus?.durationMillis) {
                            const percentage = Math.max(0, Math.min(1, touchX / barWidth));
                            const newPosition = percentage * videoStatus.durationMillis;
                            videoRef.current.setPositionAsync(newPosition);
                          }
                        }}
                      >
                        <View className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                          <View
                            className="h-full bg-emerald-500 rounded-full"
                            style={{
                              width: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`
                            }}
                          />
                        </View>
                        {/* Seek indicator dot */}
                        <View
                          className="absolute w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow"
                          style={{
                            left: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`,
                            marginLeft: -8,
                            top: 10,
                          }}
                        />
                      </View>
                      <Text className="text-xs text-zinc-500 w-10 text-right">
                        {formatTime(videoStatus?.durationMillis || 0)}
                      </Text>
                    </View>

                    {/* Playback Controls */}
                    <View className="flex-row items-center justify-center mt-3">
                      <TouchableOpacity
                        onPress={async () => {
                          if (videoRef.current && videoStatus?.positionMillis) {
                            await videoRef.current.setPositionAsync(Math.max(0, videoStatus.positionMillis - 10000));
                          }
                        }}
                        className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center mr-3"
                      >
                        <Ionicons name="play-back" size={20} color="#71717a" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={toggleVideoPlayback}
                        className="w-14 h-14 rounded-full bg-emerald-500 items-center justify-center mx-2"
                      >
                        <Ionicons
                          name={isVideoPlaying ? 'pause' : (videoStatus?.didJustFinish ? 'refresh' : 'play')}
                          size={28}
                          color="white"
                          style={{ marginLeft: isVideoPlaying || videoStatus?.didJustFinish ? 0 : 3 }}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={async () => {
                          if (videoRef.current && videoStatus?.positionMillis && videoStatus?.durationMillis) {
                            await videoRef.current.setPositionAsync(Math.min(videoStatus.durationMillis, videoStatus.positionMillis + 10000));
                          }
                        }}
                        className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center ml-3"
                      >
                        <Ionicons name="play-forward" size={20} color="#71717a" />
                      </TouchableOpacity>

                      {/* Fullscreen Button */}
                      <TouchableOpacity
                        onPress={openFullscreen}
                        className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center ml-4"
                      >
                        <Ionicons name="expand" size={20} color="#71717a" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                // Audio Recording Complete - with playback controls
                <View className="items-center">
                  <Text className="text-lg font-bold text-zinc-900 mb-4 text-center">
                    Audio Recording Complete
                  </Text>

                  {/* Audio Waveform Visual */}
                  <View className="w-full bg-zinc-100 rounded-xl p-4 mb-4">
                    <View className="flex-row items-center justify-center mb-3">
                      <Ionicons name="musical-notes" size={24} color="#10b981" />
                      <Text className="text-zinc-600 ml-2 font-medium">
                        {formatTime(audioStatus?.positionMillis || 0)} / {formatTime(audioStatus?.durationMillis || recordingDuration * 1000)}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View
                      className="h-2 bg-zinc-200 rounded-full overflow-hidden mb-4"
                      onTouchEnd={async (event) => {
                        if (audioSound && audioStatus?.durationMillis) {
                          const touchX = event.nativeEvent.locationX;
                          const barWidth = SCREEN_WIDTH - 64; // Account for padding
                          const percentage = Math.max(0, Math.min(1, touchX / barWidth));
                          const newPosition = percentage * audioStatus.durationMillis;
                          await audioSound.setPositionAsync(newPosition);
                        }
                      }}
                    >
                      <View
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${audioStatus?.durationMillis ? (audioStatus.positionMillis / audioStatus.durationMillis) * 100 : 0}%`
                        }}
                      />
                    </View>

                    {/* Playback Controls */}
                    <View className="flex-row items-center justify-center">
                      <TouchableOpacity
                        onPress={() => seekAudio(false)}
                        className="w-10 h-10 rounded-full bg-zinc-200 items-center justify-center mr-3"
                      >
                        <Ionicons name="play-back" size={20} color="#71717a" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={loadAndPlayAudio}
                        className="w-14 h-14 rounded-full bg-emerald-500 items-center justify-center mx-2"
                      >
                        <Ionicons
                          name={isAudioPlaying ? 'pause' : (audioStatus?.didJustFinish ? 'refresh' : 'play')}
                          size={28}
                          color="white"
                          style={{ marginLeft: isAudioPlaying || audioStatus?.didJustFinish ? 0 : 3 }}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => seekAudio(true)}
                        className="w-10 h-10 rounded-full bg-zinc-200 items-center justify-center ml-3"
                      >
                        <Ionicons name="play-forward" size={20} color="#71717a" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    className="flex-row items-center justify-center px-4 py-2 bg-red-50 rounded-full"
                    onPress={deleteRecording}
                  >
                    <Ionicons name="trash" size={16} color="#ef4444" />
                    <Text className="text-red-600 font-medium ml-2">Delete & Re-record</Text>
                  </TouchableOpacity>
                </View>
              )}
              {interviewType === 'video' && (
                <TouchableOpacity
                  className="flex-row items-center justify-center px-4 py-2 bg-red-50 rounded-full self-center mt-2"
                  onPress={deleteRecording}
                >
                  <Ionicons name="trash" size={16} color="#ef4444" />
                  <Text className="text-red-600 font-medium ml-2">Delete & Re-record</Text>
                </TouchableOpacity>
              )}
            </>
          ) : isRecording ? (
            // Recording in Progress (Audio only) - Centered
            <View className="items-center">
              {/* Recording Indicator */}
              <View className={`w-20 h-20 ${isPaused ? 'bg-yellow-100' : 'bg-red-100'} rounded-full items-center justify-center mb-3`}>
                {isPaused ? (
                  <Ionicons name="pause" size={36} color="#eab308" />
                ) : (
                  <View style={{ width: 28, height: 28, backgroundColor: '#ef4444', borderRadius: 4 }} />
                )}
              </View>
              <Text className="text-2xl font-bold text-zinc-900 mb-1">
                {formatDuration(recordingDuration)}
              </Text>
              <Text className={`mb-4 ${isPaused ? 'text-yellow-600' : 'text-zinc-500'}`}>
                {isPaused ? 'Paused' : 'Recording...'}
              </Text>

              {/* Question Card */}
              <View className="w-full bg-zinc-50 rounded-xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Ionicons name="chatbubble" size={14} color="#10b981" />
                    <Text className="text-emerald-600 text-xs font-medium ml-1.5">
                      ASK THE OWNER
                    </Text>
                  </View>
                  <Text className="text-zinc-400 text-xs font-medium">
                    {currentQuestion + 1}/{INTERVIEW_QUESTIONS.length}
                  </Text>
                </View>
                <Text className="text-zinc-900 text-base font-medium text-center mb-3">
                  "{INTERVIEW_QUESTIONS[currentQuestion]}"
                </Text>

                {/* Question Navigation */}
                <View className="flex-row justify-center">
                  <TouchableOpacity
                    onPress={prevQuestion}
                    disabled={currentQuestion === 0}
                    className={`flex-row items-center px-3 py-1.5 rounded-full mr-2 ${
                      currentQuestion === 0 ? 'bg-zinc-200' : 'bg-zinc-300'
                    }`}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={14}
                      color={currentQuestion === 0 ? '#a1a1aa' : '#3f3f46'}
                    />
                    <Text className={`ml-0.5 text-sm font-medium ${currentQuestion === 0 ? 'text-zinc-400' : 'text-zinc-700'}`}>
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={nextQuestion}
                    disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}
                    className={`flex-row items-center px-3 py-1.5 rounded-full ${
                      currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 'bg-zinc-200' : 'bg-emerald-500'
                    }`}
                  >
                    <Text className={`mr-0.5 text-sm font-medium ${
                      currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 'text-zinc-400' : 'text-white'
                    }`}>
                      Next
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? '#a1a1aa' : 'white'}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Recording Controls */}
              <View className="flex-row items-center justify-center">
                {/* Pause/Resume Button */}
                <TouchableOpacity
                  className={`flex-row items-center px-5 py-3 rounded-full mr-3 ${isPaused ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                  onPress={isPaused ? resumeAudioRecording : pauseAudioRecording}
                >
                  <Ionicons name={isPaused ? 'play' : 'pause'} size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">
                    {isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </TouchableOpacity>

                {/* Stop Button */}
                <TouchableOpacity
                  className="flex-row items-center px-5 py-3 bg-red-500 rounded-full"
                  onPress={stopAudioRecording}
                >
                  <Ionicons name="stop" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Stop</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : interviewType ? (
            // Ready to Record
            <View className="items-center">
              <View className="w-24 h-24 bg-zinc-100 rounded-full items-center justify-center mb-4">
                <Ionicons name={interviewType === 'video' ? 'videocam' : 'mic'} size={40} color="#71717a" />
              </View>
              <Text className="text-lg font-bold text-zinc-900 mb-1">Ready to Record</Text>
              <Text className="text-zinc-500 text-center mb-4">
                {interviewType === 'video'
                  ? 'Tap to open camera and record'
                  : 'Tap the button below to start'}
              </Text>
              <TouchableOpacity
                className="flex-row items-center px-6 py-3 bg-emerald-500 rounded-full"
                onPress={interviewType === 'video' ? openVideoCamera : startAudioRecording}
              >
                <Ionicons name={interviewType === 'video' ? 'videocam' : 'mic'} size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  {interviewType === 'video' ? 'Record Video' : 'Start Recording'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            // No type selected - minimal prompt
            <View className="flex-row items-center justify-center py-6">
              <Ionicons name="chevron-up" size={20} color="#a1a1aa" />
              <Text className="text-zinc-400 text-sm ml-2">
                Select Video or Audio above
              </Text>
            </View>
          )}
        </View>
        )}

        {/* Spacer */}
        <View className="h-24" />
      </ScrollView>

      {/* Bottom Button */}
      <View className="px-4 pt-4 bg-white border-t border-zinc-100" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {/* Upload Progress Bar */}
        {loading && uploadProgress > 0 && (
          <View className="mb-3">
            <View className="h-2 bg-zinc-200 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${isProcessing ? 'bg-blue-500' : 'bg-emerald-500'}`}
                style={{ width: `${uploadProgress}%` }}
              />
            </View>
            <Text className="text-xs text-zinc-500 text-center mt-1">
              {isProcessing ? 'Processing video on server...' : `${uploadProgress}% uploaded`}
            </Text>
          </View>
        )}
        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center flex-row ${
            loading || isRecording || (!recordingUri && !hasExistingRecording)
              ? 'bg-zinc-300'
              : 'bg-emerald-500'
          }`}
          onPress={handleNext}
          disabled={loading || isRecording || (!recordingUri && !hasExistingRecording)}
        >
          {loading ? (
            <>
              <ActivityIndicator color="white" />
              <Text className="text-white font-semibold ml-2">
                {isProcessing
                  ? 'Processing...'
                  : uploadProgress > 0
                    ? `Uploading... ${uploadProgress}%`
                    : 'Preparing upload...'}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-white font-semibold">Next: Review</Text>
              <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Video Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isVideoRecording) {
            setShowCamera(false);
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={facing}
            mode="video"
          >
            {/* Top Bar */}
            <SafeAreaView style={{ flex: 1 }}>
              <View className="flex-row items-center justify-between px-4 pt-2">
                <TouchableOpacity
                  onPress={() => !isVideoRecording && setShowCamera(false)}
                  className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                  disabled={isVideoRecording}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>

                <Text className="text-white font-bold text-lg">Owner Interview</Text>

                <View className="flex-row items-center bg-black/50 px-3 py-1.5 rounded-full">
                  <Text className="text-white text-sm font-medium">
                    {currentQuestion + 1}/{INTERVIEW_QUESTIONS.length}
                  </Text>
                </View>
              </View>

              {/* Lighting Tip Banner - Dismissible */}
              {showLightingTip && !isVideoRecording && (
                <View className="mx-4 mt-4">
                  <View className="bg-black/70 rounded-xl p-3 flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-yellow-500/30 items-center justify-center mr-3">
                      <Ionicons name="sunny" size={20} color="#fbbf24" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium text-sm">Lighting Tip</Text>
                      <Text className="text-white/70 text-xs">Face a light source for best results</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowLightingTip(false)}
                      className="w-8 h-8 items-center justify-center"
                    >
                      <Ionicons name="close" size={18} color="#71717a" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Recording Timer */}
              {isVideoRecording && (
                <View className="items-center mt-4">
                  <View className={`flex-row items-center px-4 py-2 rounded-full ${recordingDuration >= 180 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white', marginRight: 8 }} />
                    <Text className="text-white font-bold text-lg">
                      {formatDuration(recordingDuration)}
                    </Text>
                  </View>
                  {recordingDuration >= 180 && (
                    <Text className="text-yellow-400 text-xs mt-2 text-center px-4">
                      Long videos may take longer to upload
                    </Text>
                  )}
                </View>
              )}

              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* Question Card */}
              <View className="mx-4 mb-4">
                <View className="bg-black/70 rounded-2xl p-4">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="chatbubble" size={16} color="#10b981" />
                    <Text className="text-emerald-400 text-xs font-medium ml-2">
                      ASK THE OWNER
                    </Text>
                  </View>
                  <Text className="text-white text-lg font-medium text-center">
                    "{INTERVIEW_QUESTIONS[currentQuestion]}"
                  </Text>

                  {/* Question Navigation */}
                  <View className="flex-row justify-center mt-4 space-x-2">
                    <TouchableOpacity
                      onPress={prevQuestion}
                      disabled={currentQuestion === 0}
                      className={`flex-row items-center px-4 py-2 rounded-full ${
                        currentQuestion === 0 ? 'bg-zinc-700' : 'bg-zinc-600'
                      }`}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={16}
                        color={currentQuestion === 0 ? '#71717a' : 'white'}
                      />
                      <Text className={`ml-1 font-medium ${currentQuestion === 0 ? 'text-zinc-500' : 'text-white'}`}>
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={nextQuestion}
                      disabled={currentQuestion === INTERVIEW_QUESTIONS.length - 1}
                      className={`flex-row items-center px-4 py-2 rounded-full ${
                        currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 'bg-zinc-700' : 'bg-emerald-600'
                      }`}
                    >
                      <Text className={`mr-1 font-medium ${
                        currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? 'text-zinc-500' : 'text-white'
                      }`}>
                        Next Question
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={currentQuestion === INTERVIEW_QUESTIONS.length - 1 ? '#71717a' : 'white'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bottom Controls */}
              <View className="flex-row items-center justify-around px-8 pb-8">
                {/* Flip Camera */}
                <TouchableOpacity
                  onPress={toggleCameraFacing}
                  disabled={isVideoRecording}
                  className="w-14 h-14 rounded-full bg-black/50 items-center justify-center"
                >
                  <Ionicons
                    name="camera-reverse"
                    size={28}
                    color={isVideoRecording ? '#71717a' : 'white'}
                  />
                </TouchableOpacity>

                {/* Record Button */}
                <TouchableOpacity
                  onPress={isVideoRecording ? stopVideoRecording : startVideoRecording}
                  className="w-20 h-20 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: isVideoRecording ? 'transparent' : '#ef4444',
                    borderWidth: 4,
                    borderColor: 'white',
                  }}
                >
                  {isVideoRecording ? (
                    <View style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: '#ef4444'
                    }} />
                  ) : (
                    <View style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      backgroundColor: '#ef4444'
                    }} />
                  )}
                </TouchableOpacity>

                {/* Done/Cancel */}
                <TouchableOpacity
                  onPress={() => {
                    if (isVideoRecording) {
                      stopVideoRecording();
                    } else {
                      setShowCamera(false);
                    }
                  }}
                  className="w-14 h-14 rounded-full bg-black/50 items-center justify-center"
                >
                  <Ionicons
                    name={isVideoRecording ? 'checkmark' : 'close'}
                    size={28}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>

      {/* Fullscreen Video Modal */}
      <Modal
        visible={showFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeFullscreen}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Close Button */}
            <View className="absolute top-4 left-4 z-10">
              <TouchableOpacity
                onPress={closeFullscreen}
                className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Video - Full screen */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={toggleVideoPlayback}
              style={{ flex: 1 }}
            >
              <Video
                ref={fullscreenVideoRef}
                source={{ uri: recordingUri || '' }}
                style={{ flex: 1, width: SCREEN_WIDTH }}
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onPlaybackStatusUpdate={handleVideoStatusUpdate}
              />
              {/* Play/Pause Overlay */}
              {!isVideoPlaying && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <View className="w-20 h-20 rounded-full bg-white/90 items-center justify-center">
                    <Ionicons
                      name={videoStatus?.didJustFinish ? 'refresh' : 'play'}
                      size={40}
                      color="#18181b"
                      style={{ marginLeft: videoStatus?.didJustFinish ? 0 : 4 }}
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Fullscreen Controls */}
            <View className="px-6 pb-8">
              {/* Timeline */}
              <View className="flex-row items-center mb-4">
                <Text className="text-xs text-white/70 w-12">
                  {formatTime(videoStatus?.positionMillis || 0)}
                </Text>
                <View
                  className="flex-1 mx-2 h-10 justify-center"
                  onTouchEnd={(event) => {
                    const touchX = event.nativeEvent.locationX;
                    const barWidth = SCREEN_WIDTH - 72; // Account for padding and time labels
                    if (fullscreenVideoRef.current && videoStatus?.durationMillis) {
                      const percentage = Math.max(0, Math.min(1, touchX / barWidth));
                      const newPosition = percentage * videoStatus.durationMillis;
                      fullscreenVideoRef.current.setPositionAsync(newPosition);
                    }
                  }}
                >
                  <View className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`
                      }}
                    />
                  </View>
                  {/* Seek indicator dot */}
                  <View
                    className="absolute w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow"
                    style={{
                      left: `${videoStatus?.durationMillis ? (videoStatus.positionMillis / videoStatus.durationMillis) * 100 : 0}%`,
                      marginLeft: -10,
                      top: 10,
                    }}
                  />
                </View>
                <Text className="text-xs text-white/70 w-12 text-right">
                  {formatTime(videoStatus?.durationMillis || 0)}
                </Text>
              </View>

              {/* Playback Controls */}
              <View className="flex-row items-center justify-center">
                <TouchableOpacity
                  onPress={async () => {
                    if (fullscreenVideoRef.current && videoStatus?.positionMillis) {
                      await fullscreenVideoRef.current.setPositionAsync(Math.max(0, videoStatus.positionMillis - 10000));
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-4"
                >
                  <Ionicons name="play-back" size={24} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleVideoPlayback}
                  className="w-16 h-16 rounded-full bg-emerald-500 items-center justify-center mx-4"
                >
                  <Ionicons
                    name={isVideoPlaying ? 'pause' : (videoStatus?.didJustFinish ? 'refresh' : 'play')}
                    size={32}
                    color="white"
                    style={{ marginLeft: isVideoPlaying || videoStatus?.didJustFinish ? 0 : 3 }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    if (fullscreenVideoRef.current && videoStatus?.positionMillis && videoStatus?.durationMillis) {
                      await fullscreenVideoRef.current.setPositionAsync(Math.min(videoStatus.durationMillis, videoStatus.positionMillis + 10000));
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-white/20 items-center justify-center ml-4"
                >
                  <Ionicons name="play-forward" size={24} color="white" />
                </TouchableOpacity>

                {/* Exit Fullscreen */}
                <TouchableOpacity
                  onPress={closeFullscreen}
                  className="w-12 h-12 rounded-full bg-white/20 items-center justify-center ml-6"
                >
                  <Ionicons name="contract" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
