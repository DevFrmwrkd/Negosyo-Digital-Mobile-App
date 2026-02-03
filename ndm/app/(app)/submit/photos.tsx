import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Id } from '../../../convex/_generated/dataModel';

export default function SubmitPhotosScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const generateR2UploadUrl = useMutation(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ uri: string; uploaded: boolean; storageId?: string }[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [hasExistingPhotos, setHasExistingPhotos] = useState(false);
  const [wantsToAddMore, setWantsToAddMore] = useState(false);

  const submission = useQuery(
    api.submissions.getById,
    submissionId ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  const photoUrls = useQuery(
    api.files.getMultipleUrls,
    existingPhotos.length > 0 ? { storageIds: existingPhotos } : 'skip'
  );

  // Load submission ID from storage
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

  // Load existing photos and check if photos already uploaded
  useEffect(() => {
    if (submission?.photos && submission.photos.length > 0) {
      setExistingPhotos(submission.photos);
      setHasExistingPhotos(true);
    }
  }, [submission]);

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant access to your photos to upload images.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const pickImages = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const totalCount = photos.length + existingPhotos.length;
    const remaining = 10 - totalCount;

    if (remaining <= 0) {
      setError('You can only have a maximum of 10 photos total.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos = result.assets.map((asset) => ({
          uri: asset.uri,
          uploaded: false,
        }));
        setPhotos((prev) => [...prev, ...newPhotos]);
        setError(null);
      }
    } catch (err) {
      console.error('Error picking images:', err);
      setError('Failed to select images');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (!submissionId) return;

    const totalPhotos = photos.length + existingPhotos.length;

    // If user has existing photos and hasn't added new ones, just proceed
    if (hasExistingPhotos && !wantsToAddMore && photos.length === 0) {
      router.push('/(app)/submit/interview');
      return;
    }

    if (totalPhotos < 3) {
      setError('Please upload at least 3 photos.');
      return;
    }

    // If no new photos to upload, just proceed
    if (photos.length === 0) {
      router.push('/(app)/submit/interview');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uploadedKeys: string[] = [];

      // Upload each new photo to R2
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (!photo.uploaded) {
          // Get R2 presigned upload URL
          const { uploadUrl, fileKey } = await generateR2UploadUrl({
            folder: "images",
            filename: `photo-${i}.jpg`,
            contentType: "image/jpeg",
          });

          // Fetch the image and upload to R2
          const response = await fetch(photo.uri);
          const blob = await response.blob();

          const uploadResult = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });

          if (!uploadResult.ok) {
            throw new Error(`Failed to upload photo ${i + 1}`);
          }

          // Store the R2 file key (not storage ID)
          uploadedKeys.push(fileKey);
        }
      }

      // Combine existing + new photos (R2 file keys)
      const finalPhotoList = [...existingPhotos, ...uploadedKeys];

      await updateSubmission({
        id: submissionId as Id<'submissions'>,
        photos: finalPhotoList,
      });

      router.push('/(app)/submit/interview');
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      setError(err.message || 'Failed to upload photos');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || creator === undefined || !submissionId) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const totalCount = photos.length + existingPhotos.length;

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
        <Text className="text-sm text-zinc-500 font-medium">STEP 2 OF 4</Text>
      </View>

      {/* Progress Bar */}
      <View className="px-4 mb-4">
        <View className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <View className="h-full bg-emerald-500 rounded-full" style={{ width: '50%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text className="text-2xl font-bold text-zinc-900 mb-2">Upload Photos</Text>
        <Text className="text-sm text-zinc-500 mb-6">
          Upload 3-10 photos of the business (storefront, interior, products, etc.)
        </Text>

        {/* Error Message */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        )}

        {/* Photos Already Uploaded Notice */}
        {hasExistingPhotos && !wantsToAddMore && (
          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
            <View className="items-center">
              <View className="w-20 h-20 bg-emerald-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              </View>
              <Text className="text-xl font-bold text-emerald-700 mb-2">
                Photos Already Uploaded
              </Text>
              <Text className="text-emerald-600 text-center mb-4">
                You have {existingPhotos.length} photo{existingPhotos.length !== 1 ? 's' : ''} saved. You can proceed to the next step or add more photos.
              </Text>

              {/* Photo Preview Grid */}
              {photoUrls && photoUrls.length > 0 && (
                <View className="flex-row flex-wrap justify-center mb-4">
                  {photoUrls.slice(0, 6).map((url, index) => (
                    <View key={`preview-${index}`} className="w-16 h-16 m-1 rounded-lg overflow-hidden">
                      {url && !url.startsWith('convex:') ? (
                        <Image source={{ uri: url }} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <View className="w-full h-full bg-zinc-200 items-center justify-center">
                          <ActivityIndicator size="small" color="#a1a1aa" />
                        </View>
                      )}
                    </View>
                  ))}
                  {existingPhotos.length > 6 && (
                    <View className="w-16 h-16 m-1 rounded-lg bg-zinc-200 items-center justify-center">
                      <Text className="text-zinc-500 font-bold">+{existingPhotos.length - 6}</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                className="flex-row items-center px-5 py-3 bg-white border border-emerald-300 rounded-full"
                onPress={() => setWantsToAddMore(true)}
              >
                <Ionicons name="add-circle" size={18} color="#10b981" />
                <Text className="text-emerald-600 font-medium ml-2">Add More Photos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Upload Area - Only show if no existing photos or user wants to add more */}
        {(!hasExistingPhotos || wantsToAddMore) && (
          <>
            <TouchableOpacity
              className="border-2 border-dashed border-zinc-300 rounded-xl p-8 items-center mb-4"
              onPress={pickImages}
              disabled={loading || totalCount >= 10}
            >
              <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="images" size={32} color="#10b981" />
              </View>
              <Text className="text-zinc-700 font-medium text-center">Tap to select photos</Text>
              <Text className="text-xs text-zinc-400 mt-1">JPG, PNG up to 5MB each</Text>
            </TouchableOpacity>

            {/* Photo Grid */}
            <View className="flex-row flex-wrap -mx-1 mb-4">
              {/* Existing Photos */}
              {photoUrls?.map((url, index) => (
                <View key={`existing-${index}`} className="w-1/3 p-1">
                  <View className="aspect-square rounded-xl overflow-hidden bg-zinc-100 border-2 border-emerald-200">
                    {url && !url.startsWith('convex:') ? (
                      <Image source={{ uri: url }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-full items-center justify-center">
                        <ActivityIndicator size="small" color="#a1a1aa" />
                      </View>
                    )}
                    <View className="absolute bottom-1 right-1 bg-emerald-500 rounded px-2 py-0.5">
                      <Text className="text-white text-xs font-medium">Saved</Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* New Photos */}
              {photos.map((photo, index) => (
                <View key={`new-${index}`} className="w-1/3 p-1">
                  <View className="aspect-square rounded-xl overflow-hidden bg-zinc-100">
                    <Image source={{ uri: photo.uri }} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full items-center justify-center"
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Count Info */}
            <View className="flex-row justify-between mb-6">
              <Text className="text-sm text-zinc-500">{totalCount} of 10 photos</Text>
              <Text className={`text-sm ${totalCount < 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {totalCount < 3 ? 'Need at least 3' : 'Good to go!'}
              </Text>
            </View>
          </>
        )}

        {/* Spacer */}
        <View className="h-24" />
      </ScrollView>

      {/* Next Button */}
      <View className="px-4 py-4 bg-white border-t border-zinc-100">
        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center flex-row ${
            loading || totalCount < 3 ? 'bg-zinc-300' : 'bg-emerald-500'
          }`}
          onPress={handleNext}
          disabled={loading || totalCount < 3}
        >
          {loading ? (
            <>
              <ActivityIndicator color="white" />
              <Text className="text-white font-semibold text-base ml-2">
                Uploading {photos.length} photos...
              </Text>
            </>
          ) : (
            <>
              <Text className="text-white font-semibold text-base">
                {hasExistingPhotos && !wantsToAddMore && photos.length === 0
                  ? 'Continue to Interview'
                  : photos.length > 0
                    ? `Upload ${photos.length} Photo${photos.length !== 1 ? 's' : ''} & Continue`
                    : 'Next: Upload Interview'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
