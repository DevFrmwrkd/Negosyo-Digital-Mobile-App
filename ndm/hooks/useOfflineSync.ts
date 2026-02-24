import { useEffect, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useNetwork } from '../providers/NetworkProvider';
import { Id } from '../convex/_generated/dataModel';

const PENDING_SYNC_KEY = 'submission_pending_sync';
const PENDING_PHOTOS_KEY = 'submission_pending_photos';
const PENDING_INTERVIEW_KEY = 'submission_pending_interview';
const DRAFT_FORM_KEY = 'submission_draft_form';

interface PendingSyncData {
  formData: {
    businessName: string;
    businessType: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail?: string;
    address: string;
    city: string;
  };
  creatorId: string;
  existingDraftId: string | null;
  savedAt: number;
}

interface PendingPhotosData {
  photoUris: string[];
  existingPhotos: string[];
  submissionId: string;
  savedAt: number;
}

interface PendingInterviewData {
  recordingUri: string;
  parallelAudioUri: string | null;
  type: 'video' | 'audio';
  submissionId: string;
  savedAt: number;
}

/** Upload a local file to R2 via presigned URL */
function uploadFileToR2(
  uri: string,
  uploadUrl: string,
  contentType: string,
  fileName: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = 1200000; // 20 min for large videos
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.ontimeout = () => resolve(false);

    let fileUri = uri;
    if (Platform.OS === 'android' && !fileUri.startsWith('file://')) {
      fileUri = 'file://' + fileUri;
    }

    xhr.send({ uri: fileUri, type: contentType, name: fileName } as any);
  });
}

export function useOfflineSync() {
  const { isConnected } = useNetwork();
  const wasOffline = useRef(false);
  const isSyncing = useRef(false);

  const createSubmission = useMutation(api.submissions.create);
  const updateSubmission = useMutation(api.submissions.update);
  const generateR2UploadUrl = useMutation(api.r2.generateUploadUrl);

  const attemptSync = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    const hasPendingSync = await AsyncStorage.getItem(PENDING_SYNC_KEY);
    const hasPendingPhotos = await AsyncStorage.getItem(PENDING_PHOTOS_KEY);
    const hasPendingInterview = await AsyncStorage.getItem(PENDING_INTERVIEW_KEY);

    if (!hasPendingSync && !hasPendingPhotos && !hasPendingInterview) {
      isSyncing.current = false;
      return;
    }

    let realSubmissionId: string | null = null;
    const syncedParts: string[] = [];

    try {
      // ── Step 1: Sync business info ──
      if (hasPendingSync) {
        const pending: PendingSyncData = JSON.parse(hasPendingSync);

        if (Date.now() - pending.savedAt > 7 * 24 * 60 * 60 * 1000) {
          await AsyncStorage.removeItem(PENDING_SYNC_KEY);
        } else {
          if (pending.existingDraftId) {
            await updateSubmission({
              id: pending.existingDraftId as Id<'submissions'>,
              ...pending.formData,
            });
            realSubmissionId = pending.existingDraftId;
          } else {
            realSubmissionId = await createSubmission({
              creatorId: pending.creatorId as Id<'creators'>,
              ...pending.formData,
            });
          }

          await AsyncStorage.setItem('current_submission_id', realSubmissionId);
          await AsyncStorage.removeItem(PENDING_SYNC_KEY);
          await AsyncStorage.removeItem(DRAFT_FORM_KEY);
          syncedParts.push('business info');
        }
      }

      // Get the real submission ID (might already exist from a previous online step)
      if (!realSubmissionId) {
        const storedId = await AsyncStorage.getItem('current_submission_id');
        if (storedId && storedId !== 'offline_pending') {
          realSubmissionId = storedId;
        }
      }

      if (!realSubmissionId) {
        console.warn('[OfflineSync] No submission ID available for photo/interview sync');
        isSyncing.current = false;
        return;
      }

      // ── Step 2: Sync pending photos ──
      if (hasPendingPhotos) {
        const pendingPhotos: PendingPhotosData = JSON.parse(hasPendingPhotos);
        const uploadedKeys: string[] = [];

        for (let i = 0; i < pendingPhotos.photoUris.length; i++) {
          const uri = pendingPhotos.photoUris[i];
          try {
            const { uploadUrl, fileKey } = await generateR2UploadUrl({
              folder: 'images',
              filename: `photo-${i}.jpg`,
              contentType: 'image/jpeg',
            });

            const success = await uploadFileToR2(uri, uploadUrl, 'image/jpeg', `photo-${i}.jpg`);
            if (success) {
              uploadedKeys.push(fileKey);
            } else {
              console.error(`[OfflineSync] Failed to upload photo ${i}`);
            }
          } catch (err) {
            console.error(`[OfflineSync] Error uploading photo ${i}:`, err);
          }
        }

        if (uploadedKeys.length > 0 || pendingPhotos.existingPhotos.length > 0) {
          const finalPhotos = [...(pendingPhotos.existingPhotos || []), ...uploadedKeys];
          await updateSubmission({
            id: realSubmissionId as Id<'submissions'>,
            photos: finalPhotos,
          });
          syncedParts.push(`${uploadedKeys.length} photo${uploadedKeys.length !== 1 ? 's' : ''}`);
        }

        await AsyncStorage.removeItem(PENDING_PHOTOS_KEY);
      }

      // ── Step 3: Sync pending interview recording ──
      if (hasPendingInterview) {
        const pendingInterview: PendingInterviewData = JSON.parse(hasPendingInterview);

        const contentType = pendingInterview.type === 'video' ? 'video/mp4' : 'audio/m4a';
        const fileName = pendingInterview.type === 'video' ? 'interview.mp4' : 'interview.m4a';
        const folder = pendingInterview.type === 'video' ? 'videos' : 'audio';

        const { uploadUrl, fileKey } = await generateR2UploadUrl({
          folder,
          filename: fileName,
          contentType,
        });

        const success = await uploadFileToR2(
          pendingInterview.recordingUri,
          uploadUrl,
          contentType,
          fileName
        );

        if (success) {
          const payout = pendingInterview.type === 'video' ? 500 : 300;

          if (pendingInterview.type === 'video') {
            // Also try uploading parallel audio for transcription
            let transcriptionAudioKey: string | undefined;
            if (pendingInterview.parallelAudioUri) {
              try {
                const audioInfo = await generateR2UploadUrl({
                  folder: 'audio',
                  filename: 'interview-audio.m4a',
                  contentType: 'audio/m4a',
                });
                const audioSuccess = await uploadFileToR2(
                  pendingInterview.parallelAudioUri,
                  audioInfo.uploadUrl,
                  'audio/m4a',
                  'interview-audio.m4a'
                );
                if (audioSuccess) {
                  transcriptionAudioKey = audioInfo.fileKey;
                }
              } catch {
                // Continue without parallel audio
              }
            }

            await updateSubmission({
              id: realSubmissionId as Id<'submissions'>,
              videoStorageId: fileKey,
              audioStorageId: transcriptionAudioKey,
              creatorPayout: payout,
            });
          } else {
            await updateSubmission({
              id: realSubmissionId as Id<'submissions'>,
              audioStorageId: fileKey,
              creatorPayout: payout,
            });
          }

          syncedParts.push(`${pendingInterview.type} interview`);
        } else {
          console.error('[OfflineSync] Failed to upload interview recording');
        }

        await AsyncStorage.removeItem(PENDING_INTERVIEW_KEY);
      }

      // ── Done ──
      if (syncedParts.length > 0) {
        Alert.alert(
          'Data Synced',
          `Your ${syncedParts.join(', ')} ${syncedParts.length === 1 ? 'has' : 'have'} been uploaded to the server.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('[OfflineSync] Sync failed:', err);
      // Leave pending data for next retry
    } finally {
      isSyncing.current = false;
    }
  }, [createSubmission, updateSubmission, generateR2UploadUrl]);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      return;
    }

    // Just came back online
    if (wasOffline.current && isConnected) {
      wasOffline.current = false;
      // Small delay to let Convex WebSocket reconnect
      const timer = setTimeout(() => {
        attemptSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, attemptSync]);

  return { attemptSync };
}
