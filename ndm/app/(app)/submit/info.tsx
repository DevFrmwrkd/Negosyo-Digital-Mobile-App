import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUSINESS_TYPES = [
  'Barber/Salon',
  'Auto Shop',
  'Spa/Massage',
  'Restaurant',
  'Clinic',
  'Law Office',
  'Craft/Producer',
  'Other',
];

export default function SubmitInfoScreen() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const existingDraft = useQuery(
    api.submissions.getDraftByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  const insets = useSafeAreaInsets();
  const createSubmission = useMutation(api.submissions.create);
  const updateSubmission = useMutation(api.submissions.update);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Load draft data when available
  useEffect(() => {
    if (existingDraft && !initialized) {
      setBusinessName(existingDraft.businessName || '');
      setBusinessType(existingDraft.businessType || '');
      setOwnerName(existingDraft.ownerName || '');
      setOwnerPhone(existingDraft.ownerPhone || '');
      setOwnerEmail(existingDraft.ownerEmail || '');
      setAddress(existingDraft.address || '');
      setCity(existingDraft.city || '');
      // Store ID for other steps
      AsyncStorage.setItem('current_submission_id', existingDraft._id);
      setInitialized(true);
    }
  }, [existingDraft, initialized]);

  const handleNext = async () => {
    setError(null);

    if (!creator) {
      setError('You must complete your profile first');
      return;
    }

    if (!businessName.trim() || !businessType || !ownerName.trim() || !ownerPhone.trim() || !address.trim() || !city.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      let submissionId: string;

      if (existingDraft) {
        await updateSubmission({
          id: existingDraft._id,
          businessName: businessName.trim(),
          businessType,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerEmail: ownerEmail.trim() || undefined,
          address: address.trim(),
          city: city.trim(),
        });
        submissionId = existingDraft._id;
      } else {
        submissionId = await createSubmission({
          creatorId: creator._id,
          businessName: businessName.trim(),
          businessType,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          ownerEmail: ownerEmail.trim() || undefined,
          address: address.trim(),
          city: city.trim(),
        });
      }

      await AsyncStorage.setItem('current_submission_id', submissionId);
      router.push('/(app)/submit/photos');
    } catch (err: any) {
      console.error('Error saving business info:', err);
      setError(err.message || 'Failed to save business information');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || creator === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

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
        <Text className="text-sm text-zinc-500 font-medium">STEP 1 OF 4</Text>
      </View>

      {/* Progress Bar */}
      <View className="px-4 mb-4">
        <View className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <View className="h-full bg-emerald-500 rounded-full" style={{ width: '25%' }} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text className="text-2xl font-bold text-zinc-900 mb-2">Business Information</Text>
          <Text className="text-sm text-zinc-500 mb-6">
            Tell us about the business you're submitting
          </Text>

          {/* Error Message */}
          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className="text-red-600 text-sm font-medium">{error}</Text>
            </View>
          )}

          {/* Form */}
          <View className="space-y-4">
            {/* Business Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-2">Business Name *</Text>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                placeholder="e.g., Juan's Barbershop"
                placeholderTextColor="#a1a1aa"
                value={businessName}
                onChangeText={setBusinessName}
                editable={!loading}
              />
            </View>

            {/* Business Type */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-2">Business Type *</Text>
              <TouchableOpacity
                className="bg-white border border-zinc-200 rounded-xl px-4 h-14 flex-row items-center justify-between"
                onPress={() => setShowTypePicker(!showTypePicker)}
                disabled={loading}
              >
                <Text className={businessType ? 'text-zinc-900' : 'text-zinc-400'}>
                  {businessType || 'Select business type'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#71717a" />
              </TouchableOpacity>
              
              {showTypePicker && (
                <View className="mt-2 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  {BUSINESS_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      className={`px-4 py-3 border-b border-zinc-100 ${
                        businessType === type ? 'bg-emerald-50' : ''
                      }`}
                      onPress={() => {
                        setBusinessType(type);
                        setShowTypePicker(false);
                      }}
                    >
                      <Text
                        className={`${
                          businessType === type
                            ? 'text-emerald-600 font-medium'
                            : 'text-zinc-700'
                        }`}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Owner Full Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-2">Owner Full Name *</Text>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                placeholder="e.g., Juan Dela Cruz"
                placeholderTextColor="#a1a1aa"
                value={ownerName}
                onChangeText={setOwnerName}
                editable={!loading}
              />
            </View>

            {/* Owner Phone */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-2">Owner Phone Number *</Text>
              <View className="flex-row">
                <View className="bg-white border border-zinc-200 rounded-xl px-4 h-14 items-center justify-center mr-2">
                  <Text className="text-zinc-700 font-medium">+63</Text>
                </View>
                <TextInput
                  className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                  placeholder="912 345 4567"
                  placeholderTextColor="#a1a1aa"
                  value={ownerPhone}
                  onChangeText={setOwnerPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Owner Email */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-medium text-zinc-700">Owner Email</Text>
                <Text className="text-xs text-zinc-400">Optional</Text>
              </View>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                placeholder="owner@example.com"
                placeholderTextColor="#a1a1aa"
                value={ownerEmail}
                onChangeText={setOwnerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            {/* Address */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-700 mb-2">Full Address *</Text>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                placeholder="123 Main St, Barangay Example"
                placeholderTextColor="#a1a1aa"
                value={address}
                onChangeText={setAddress}
                editable={!loading}
              />
            </View>

            {/* City */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-zinc-700 mb-2">City *</Text>
              <TextInput
                className="bg-white border border-zinc-200 rounded-xl px-4 h-14 text-base text-zinc-900"
                placeholder="e.g., Manila"
                placeholderTextColor="#a1a1aa"
                value={city}
                onChangeText={setCity}
                editable={!loading}
              />
            </View>
          </View>

          {/* Spacer for button */}
          <View className="h-24" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Next Button */}
      <View className="px-4 pt-4 bg-white border-t border-zinc-100" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center flex-row ${
            loading ? 'bg-emerald-400' : 'bg-emerald-500'
          }`}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-white font-semibold text-base">Next: Upload Photos</Text>
              <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
