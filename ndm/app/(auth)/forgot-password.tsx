import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/assets/icon.png';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // ── Step 1: Send reset code ──────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!isLoaded) return;

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setStep('reset');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(err.errors?.[0]?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend code ──────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!isLoaded || resendLoading) return;
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  // ── Step 2: Verify code + set new password ───────────────────────────────
  const handleReset = async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      setError('Please enter the reset code');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('Reset incomplete. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.errors?.[0]?.message || 'Failed to reset password');
      setLoading(false);
    }
  };

  // ── Email step ────────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            className="flex-row items-center mb-6"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#71717a" />
            <Text className="text-zinc-500 ml-2">Back to Sign In</Text>
          </TouchableOpacity>

          {/* Header — matches login/signup */}
          <View className="items-center mb-8">
            <Image
              source={Icon}
              style={{ width: 124, height: 124, borderRadius: 16, marginBottom: 5, resizeMode: 'contain' }}
            />
            <Text className="text-zinc-500 mt-1">Password Recovery</Text>
          </View>

          {/* Title */}
          <View className="mb-6">
            <Text className="text-3xl font-bold text-zinc-900 mb-2">Forgot Password?</Text>
            <Text className="text-zinc-500">
              Enter your email and we'll send you a code to reset your password.
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className="text-red-600 text-sm font-medium">{error}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <View className="mb-6">
            <Text className="text-zinc-700 font-medium mb-2">Email Address</Text>
            <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
              <Ionicons name="mail-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 ml-3 text-base text-zinc-900"
                placeholder="your@email.com"
                placeholderTextColor="#a1a1aa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            className={`h-14 rounded-xl items-center justify-center mb-4 ${
              loading ? 'bg-zinc-400' : 'bg-zinc-900'
            }`}
            onPress={handleSendCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Send Reset Code</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View className="flex-row justify-center mt-4">
            <Text className="text-zinc-500">Remember your password? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-emerald-600 font-semibold">Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Reset step ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          className="flex-row items-center mb-6"
          onPress={() => {
            setStep('email');
            setCode('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#71717a" />
          <Text className="text-zinc-500 ml-2">Use a different email</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="items-center mb-8">
          <Image
            source={Icon}
            style={{ width: 124, height: 124, borderRadius: 16, marginBottom: 5, resizeMode: 'contain' }}
          />
          <Text className="text-zinc-500 mt-1">Password Recovery</Text>
        </View>

        {/* Title */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-zinc-900 mb-2">Reset Password</Text>
          <Text className="text-zinc-500">
            Enter the code sent to{' '}
            <Text className="font-semibold text-zinc-700">{email}</Text>
            {' '}and choose a new password.
          </Text>
        </View>

        {/* Error */}
        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-600 text-sm font-medium">{error}</Text>
          </View>
        ) : null}

        {/* Resend success */}
        {resendSuccess ? (
          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
            <Text className="text-emerald-700 text-sm font-medium">
              A new code has been sent to your email.
            </Text>
          </View>
        ) : null}

        {/* Code Input */}
        <View className="mb-4">
          <Text className="text-zinc-700 font-medium mb-2">Reset Code</Text>
          <TextInput
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 text-center text-2xl tracking-widest text-zinc-900"
            placeholder="000000"
            placeholderTextColor="#a1a1aa"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        {/* New Password */}
        <View className="mb-4">
          <Text className="text-zinc-700 font-medium mb-2">New Password</Text>
          <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
            <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
            <TextInput
              className="flex-1 ml-3 text-base text-zinc-900"
              placeholder="At least 8 characters"
              placeholderTextColor="#a1a1aa"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#71717a"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password */}
        <View className="mb-6">
          <Text className="text-zinc-700 font-medium mb-2">Confirm New Password</Text>
          <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
            <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
            <TextInput
              className="flex-1 ml-3 text-base text-zinc-900"
              placeholder="Confirm your new password"
              placeholderTextColor="#a1a1aa"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center mb-4 ${
            loading ? 'bg-zinc-400' : 'bg-zinc-900'
          }`}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Reset Password</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          className="h-12 rounded-xl items-center justify-center border border-zinc-200"
          onPress={handleResend}
          disabled={loading || resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="#71717a" size="small" />
          ) : (
            <Text className="text-zinc-600 font-medium text-sm">
              Didn't receive it? Resend Code
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
