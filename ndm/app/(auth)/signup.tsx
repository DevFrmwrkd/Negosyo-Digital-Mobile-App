import React, { useState, useCallback } from 'react';
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
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Icon from '@/assets/icon.png';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

WebBrowser.maybeCompleteAuthSession();

// Actual Google logo in 4 official brand colors
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = (firstName.substring(0, 2) + lastName.substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const createCreator = useMutation(api.creators.create);
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referredByCode, setReferredByCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSignup = async () => {
    if (!isLoaded) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const signUpResult = await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: email.trim(),
        password,
      });
      console.log('Signup result:', JSON.stringify(signUpResult, null, 2));

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Failed to sign up';

      if (errorMessage.toLowerCase().includes('already') || err.errors?.[0]?.code === 'form_identifier_exists') {
        setError('An account with this email already exists. Please log in instead.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;

    if (!code) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      console.log('Verification result:', JSON.stringify(result, null, 2));

      if (result.status === 'complete') {
        if (!result.createdSessionId || !result.createdUserId) {
          setError('Verification succeeded but session creation failed. Please try logging in.');
          setLoading(false);
          return;
        }

        const referralCode = generateReferralCode(firstName, lastName);
        await createCreator({
          clerkId: result.createdUserId,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          referralCode,
          referredByCode: referredByCode.trim() || undefined,
        });

        await setActive({ session: result.createdSessionId });
      } else {
        setError(`Verification incomplete (${result.status}). Please try again.`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Failed to verify email';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || resendLoading) return;
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleSignUp = useCallback(async () => {
    if (googleLoading) return;

    setGoogleLoading(true);
    setError('');

    try {
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/', { scheme: 'negosyodigital' }),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
      } else {
        setGoogleLoading(false);
      }
    } catch (err: any) {
      console.error('Google sign up error:', err);
      setError('Failed to sign up with Google');
      setGoogleLoading(false);
    }
  }, [googleLoading, startOAuthFlow]);

  // ── Verification screen ────────────────────────────────────────────────────
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="mail" size={32} color="#10b981" />
            </View>
            <Text className="text-2xl font-bold text-zinc-900 text-center">Check your email</Text>
            <Text className="text-zinc-500 mt-2 text-center px-4">
              We sent a 6-digit code to{' '}
              <Text className="font-semibold text-zinc-700">{email}</Text>
            </Text>
          </View>

          {/* Error / Success */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className="text-red-600 text-sm font-medium">{error}</Text>
            </View>
          ) : null}
          {resendSuccess ? (
            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <Text className="text-emerald-700 text-sm font-medium">
                A new code has been sent to your email.
              </Text>
            </View>
          ) : null}

          {/* Code Input */}
          <View className="mb-6">
            <Text className="text-zinc-700 font-medium mb-2">Verification Code</Text>
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

          {/* Verify Button */}
          <TouchableOpacity
            className={`h-14 rounded-xl items-center justify-center ${
              loading ? 'bg-emerald-400' : 'bg-emerald-600'
            }`}
            onPress={handleVerify}
            disabled={loading || resendLoading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Verify Email</Text>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <TouchableOpacity
            className="mt-4 h-12 rounded-xl items-center justify-center border border-zinc-200"
            onPress={handleResendCode}
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

          {/* Back */}
          <TouchableOpacity
            className="mt-3 items-center"
            onPress={() => {
              setPendingVerification(false);
              setCode('');
              setError('');
            }}
          >
            <Text className="text-zinc-400 text-sm">Back to signup</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center mb-8">
          <Image
            source={Icon}
            style={{ width: 124, height: 124, borderRadius: 14, marginBottom: 2, resizeMode: 'contain' }}
          />
          <Text className="text-3xl font-bold mt-1">Create your account</Text>
        </View>

        {/* Form */}
        <View>
          <View className="mb-4">
            <Text className="text-3xl font-bold text-zinc-900 mb-2">Sign Up</Text>
            <Text className="text-zinc-500">Start your digital business journey.</Text>
          </View>

          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <Text className="text-red-600 text-sm font-medium">{error}</Text>
            </View>
          ) : null}

          {/* Name */}
          <View className="flex-row mb-4">
            <View className="flex-1 mr-2">
              <Text className="text-zinc-700 font-medium mb-2">First Name</Text>
              <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                <Ionicons name="person-outline" size={20} color="#71717a" />
                <TextInput
                  className="flex-1 ml-3 text-base text-zinc-900"
                  placeholder="Juan"
                  placeholderTextColor="#a1a1aa"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-zinc-700 font-medium mb-2">Last Name</Text>
              <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                <TextInput
                  className="flex-1 text-base text-zinc-900"
                  placeholder="Dela Cruz"
                  placeholderTextColor="#a1a1aa"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            </View>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-zinc-700 font-medium mb-2">Email</Text>
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

          {/* Phone — max 15 digits */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-zinc-700 font-medium">Mobile Number</Text>
              <Text className="text-xs text-zinc-400">Optional</Text>
            </View>
            <View className="flex-row">
              <View className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 items-center justify-center mr-2">
                <Text className="text-zinc-700 font-medium">+63</Text>
              </View>
              <View className="flex-1 flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                <Ionicons name="call-outline" size={20} color="#71717a" />
                <TextInput
                  className="flex-1 ml-3 text-base text-zinc-900"
                  placeholder="912 345 6789"
                  placeholderTextColor="#a1a1aa"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="number-pad"
                  maxLength={15}
                  editable={!loading}
                />
              </View>
            </View>
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-zinc-700 font-medium mb-2">Password</Text>
            <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
              <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 ml-3 text-base text-zinc-900"
                placeholder="At least 8 characters"
                placeholderTextColor="#a1a1aa"
                value={password}
                onChangeText={setPassword}
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
          <View className="mb-4">
            <Text className="text-zinc-700 font-medium mb-2">Confirm Password</Text>
            <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
              <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 ml-3 text-base text-zinc-900"
                placeholder="Confirm your password"
                placeholderTextColor="#a1a1aa"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
            </View>
          </View>

          {/* Referral Code */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-zinc-700 font-medium">Referral Code</Text>
              <Text className="text-xs text-zinc-400">Optional</Text>
            </View>
            <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
              <Ionicons name="gift-outline" size={20} color="#71717a" />
              <TextInput
                className="flex-1 ml-3 text-base text-zinc-900"
                placeholder="Enter referral code"
                placeholderTextColor="#a1a1aa"
                value={referredByCode}
                onChangeText={(text) => setReferredByCode(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Signup Button */}
          <TouchableOpacity
            className={`h-14 rounded-xl items-center justify-center mb-4 ${
              loading ? 'bg-zinc-400' : 'bg-zinc-900'
            }`}
            onPress={handleSignup}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-zinc-200" />
            <Text className="mx-4 text-zinc-400 text-sm">or continue with</Text>
            <View className="flex-1 h-px bg-zinc-200" />
          </View>

          {/* Google Button */}
          <TouchableOpacity
            className={`h-14 rounded-xl items-center justify-center flex-row border ${
              googleLoading ? 'bg-zinc-100 border-zinc-200' : 'bg-white border-zinc-300'
            }`}
            onPress={handleGoogleSignUp}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#71717a" />
            ) : (
              <>
                <GoogleLogo size={20} />
                <Text className="text-zinc-700 font-semibold text-base ml-3">
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="flex-row justify-center mt-8">
          <Text className="text-zinc-500">Already have an account? </Text>
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
