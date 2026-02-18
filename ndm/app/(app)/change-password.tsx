import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const createNotification = useMutation(api.notifications.createForClient);
  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const [currentPassword,    setCurrentPassword]    = useState('');
  const [newPassword,        setNewPassword]        = useState('');
  const [confirmPassword,    setConfirmPassword]    = useState('');
  const [showCurrent,        setShowCurrent]        = useState(false);
  const [showNew,            setShowNew]            = useState(false);
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState('');
  const [success,            setSuccess]            = useState(false);

  const handleChangePassword = async () => {
    if (!user) return;

    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);

    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true,
      });

      // Create password changed notification
      if (creator?._id) {
        await createNotification({
          creatorId: creator._id,
          type: 'password_changed',
          title: 'Password Changed',
          body: 'Your password has been updated successfully. All other active sessions have been signed out.',
          data: {},
        });
      }

      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      console.error('Change password error:', err);
      const msg = err?.errors?.[0]?.message ?? err?.message ?? 'Failed to change password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

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
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#18181b' }}>Change Password</Text>
          <Text style={{ fontSize: 14, color: '#71717a', marginTop: 4 }}>
            Choose a strong password to keep your account secure.
          </Text>
        </View>

        {/* Success banner */}
        {success && (
          <View style={{
            backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#6ee7b7',
            borderRadius: 14, padding: 14, marginBottom: 20,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={{ color: '#065f46', fontWeight: '600', fontSize: 13 }}>
              Password changed! Redirecting…
            </Text>
          </View>
        )}

        {/* Error banner */}
        {!!error && (
          <View style={{
            backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5',
            borderRadius: 14, padding: 14, marginBottom: 20,
          }}>
            <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Current Password */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Current Password
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="lock-closed-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="Enter current password"
              placeholderTextColor="#a1a1aa"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
              <Ionicons
                name={showCurrent ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#a1a1aa"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Password */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            New Password
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="lock-open-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="At least 8 characters"
              placeholderTextColor="#a1a1aa"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)}>
              <Ionicons
                name={showNew ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#a1a1aa"
              />
            </TouchableOpacity>
          </View>

          {/* Strength hint */}
          {newPassword.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              {[1, 2, 3, 4].map((level) => {
                const strength =
                  newPassword.length >= 12 && /[^a-zA-Z0-9]/.test(newPassword) ? 4
                  : newPassword.length >= 10 ? 3
                  : newPassword.length >= 8  ? 2
                  : 1;
                return (
                  <View
                    key={level}
                    style={{
                      flex: 1, height: 3, borderRadius: 2,
                      backgroundColor: level <= strength
                        ? strength <= 1 ? '#ef4444'
                          : strength === 2 ? '#f59e0b'
                          : strength === 3 ? '#10b981'
                          : '#6366f1'
                        : '#e4e4e7',
                    }}
                  />
                );
              })}
              <Text style={{ fontSize: 10, color: '#71717a', marginLeft: 4, fontWeight: '600' }}>
                {newPassword.length < 8 ? 'Weak' : newPassword.length < 10 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
              </Text>
            </View>
          )}
        </View>

        {/* Confirm New Password */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Confirm New Password
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb',
            borderWidth: 1,
            borderColor: confirmPassword && confirmPassword !== newPassword ? '#fca5a5' : '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="lock-closed-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="Re-enter new password"
              placeholderTextColor="#a1a1aa"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showNew}
              editable={!loading}
            />
            {confirmPassword.length > 0 && (
              <Ionicons
                name={confirmPassword === newPassword ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={confirmPassword === newPassword ? '#10b981' : '#ef4444'}
              />
            )}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleChangePassword}
          disabled={loading || success}
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: loading || success ? '#a1a1aa' : '#18181b',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Change Password</Text>
          }
        </TouchableOpacity>

        <Text style={{ fontSize: 11, color: '#a1a1aa', textAlign: 'center', marginTop: 14, lineHeight: 16 }}>
          All other active sessions will be signed out{'\n'}after changing your password.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
