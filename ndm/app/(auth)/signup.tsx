import React, { useState, useCallback } from 'react';
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
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

WebBrowser.maybeCompleteAuthSession();

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = (firstName.substring(0, 2) + lastName.substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

export default function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const createCreator = useMutation(api.creators.create);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  const handleSignup = async () => {
    if (!isLoaded) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
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
        emailAddress: email,
        password,
      });
      console.log('Signup result:', JSON.stringify(signUpResult, null, 2));

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Failed to sign up';

      // Check if the user already exists
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
          console.error('No session/user ID created after verification');
          setError('Verification succeeded but session creation failed. Please try logging in.');
          setLoading(false);
          return;
        }

        // Create creator in Convex
        const referralCode = generateReferralCode(firstName, lastName);
        await createCreator({
          clerkId: result.createdUserId,
          email: email,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          referralCode,
        });

        await setActive({ session: result.createdSessionId });
        // Don't set loading to false - keep showing loading until navigation completes
        // The _layout.tsx will handle the transition screen
      } else {
        console.log('Verification status:', result.status);
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
        // Don't set googleLoading to false - keep showing loading until navigation completes
        // The _layout.tsx will handle the transition screen
      } else {
        setGoogleLoading(false);
      }
    } catch (err: any) {
      console.error('Google sign up error:', err);
      setError('Failed to sign up with Google');
      setGoogleLoading(false);
    }
  }, [googleLoading, startOAuthFlow]);

  if (pendingVerification) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 px-6 pt-12 pb-8 justify-center">
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="mail" size={32} color="#10b981" />
              </View>
              <Text className="text-2xl font-bold text-zinc-900 text-center">Check your email</Text>
              <Text className="text-zinc-500 mt-2 text-center px-4">
                We've sent a verification code to {email}
              </Text>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <Text className="text-red-600 text-sm font-medium">{error}</Text>
              </View>
            ) : null}

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

            <TouchableOpacity
              className={`h-14 rounded-xl items-center justify-center ${
                loading ? 'bg-emerald-400' : 'bg-emerald-600'
              }`}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">Verify Email</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-4 items-center"
              onPress={() => setPendingVerification(false)}
            >
              <Text className="text-zinc-500">Back to signup</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-12 pb-8">
            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-zinc-900 rounded-2xl items-center justify-center mb-4 shadow-lg">
                <Ionicons name="storefront" size={32} color="#10b981" />
              </View>
              <Text className="text-2xl font-bold text-zinc-900">Negosyo Digital</Text>
              <Text className="text-zinc-500 mt-1">Create your account</Text>
            </View>

            {/* Form */}
            <View className="flex-1">
              <View className="mb-4">
                <Text className="text-3xl font-bold text-zinc-900 mb-2">Sign Up</Text>
                <Text className="text-zinc-500">Start your digital business journey.</Text>
              </View>

              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <Text className="text-red-600 text-sm font-medium">{error}</Text>
                </View>
              ) : null}

              {/* Name Inputs */}
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

              {/* Email Input */}
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

              {/* Phone Number Input */}
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
                      keyboardType="phone-pad"
                      editable={!loading}
                    />
                  </View>
                </View>
              </View>

              {/* Password Input */}
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

              {/* Confirm Password Input */}
              <View className="mb-6">
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
                    <Ionicons name="logo-google" size={20} color="#4285F4" />
                    <Text className="text-zinc-700 font-semibold text-base ml-3">
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-zinc-500">Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-emerald-600 font-semibold">Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
