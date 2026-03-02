import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const updateCreator = useMutation(api.creators.update);
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const [firstName, setFirstName]           = useState('');
  const [lastName,  setLastName]            = useState('');
  const [phone,     setPhone]               = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [loading,   setLoading]             = useState(false);
  const [error,     setError]               = useState('');
  const [success,   setSuccess]             = useState(false);

  // Pre-fill from loaded creator
  useEffect(() => {
    if (creator) {
      setFirstName(creator.firstName  ?? '');
      setLastName(creator.lastName   ?? '');
      setPhone(creator.phone        ?? '');
    }
  }, [creator]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant access to your photos to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!user || !creator?._id) return;

    const trimFirst = firstName.trim();
    const trimLast  = lastName.trim();

    if (!trimFirst) {
      setError('First name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let profileImageUrl: string | undefined;

      // Upload new profile image to R2 if one was picked
      if (profileImageUri) {
        const { uploadUrl, publicUrl } = await generateR2UploadUrl({
          folder: 'profile',
          filename: `avatar-${creator._id}.jpg`,
          contentType: 'image/jpeg',
        });

        const response = await fetch(profileImageUri);
        const blob = await response.blob();

        const uploadResult = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });

        if (!uploadResult.ok) {
          throw new Error('Failed to upload profile image. Please try again.');
        }

        profileImageUrl = publicUrl;
      }

      // Update Clerk profile
      await user.update({ firstName: trimFirst, lastName: trimLast || undefined });

      // Update Convex creator record
      await updateCreator({
        id: creator._id,
        firstName: trimFirst || undefined,
        lastName:  trimLast  || undefined,
        phone:     phone.trim() || undefined,
        ...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
      });

      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      console.error('Edit profile error:', err);
      setError(err?.errors?.[0]?.message ?? err?.message ?? 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Avatar: local picked URI > existing profile image > initial letter
  const avatarUri     = profileImageUri ?? (creator as any).profileImage ?? null;
  const displayInitial = (firstName || 'U').charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#71717a" />
          <Text style={{ color: '#71717a', marginLeft: 8, fontSize: 15 }}>Back</Text>
        </TouchableOpacity>

        {/* Title */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#18181b' }}>Edit Profile</Text>
          <Text style={{ fontSize: 14, color: '#71717a', marginTop: 4 }}>
            Update your name, contact details and photo.
          </Text>
        </View>

        {/* Success banner */}
        {success && (
          <View style={{
            backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#6ee7b7',
            borderRadius: 14, padding: 14, marginBottom: 16,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={{ color: '#065f46', fontWeight: '600', fontSize: 13 }}>
              Profile updated successfully!
            </Text>
          </View>
        )}

        {/* Error banner */}
        {!!error && (
          <View style={{
            backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5',
            borderRadius: 14, padding: 14, marginBottom: 16,
          }}>
            <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Avatar picker */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={handlePickImage} disabled={loading} activeOpacity={0.8}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: '#18181b',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 88, height: 88, borderRadius: 44 }}
                />
              ) : (
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>
                  {displayInitial}
                </Text>
              )}
            </View>

            {/* Camera badge */}
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#10b981',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: '#fff',
            }}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 10 }}>
            {user?.primaryEmailAddress?.emailAddress}
          </Text>
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>
            Tap photo to change
          </Text>
        </View>

        {/* First Name */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            First Name
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="person-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="First name"
              placeholderTextColor="#a1a1aa"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        </View>

        {/* Last Name */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Last Name
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="person-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="Last name"
              placeholderTextColor="#a1a1aa"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        </View>

        {/* Phone */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Phone Number
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="call-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="e.g. 09171234567"
              placeholderTextColor="#a1a1aa"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={15}
              editable={!loading}
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || success}
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: loading || success ? '#a1a1aa' : '#18181b',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
