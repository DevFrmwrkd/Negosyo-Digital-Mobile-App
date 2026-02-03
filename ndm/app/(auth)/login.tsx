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
  Alert,
} from 'react-native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!isLoaded) return;

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // Don't set loading to false - keep showing loading until navigation completes
        // The _layout.tsx will handle the transition screen
      } else {
        setError('Sign in incomplete. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.errors?.[0]?.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
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
      console.error('Google sign in error:', err);
      setError('Failed to sign in with Google');
      setGoogleLoading(false);
    }
  }, [googleLoading, startOAuthFlow]);

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
              <Text className="text-zinc-500 mt-1">Welcome back</Text>
            </View>

            {/* Form */}
            <View className="flex-1">
              <View className="mb-4">
                <Text className="text-3xl font-bold text-zinc-900 mb-2">Sign In</Text>
                <Text className="text-zinc-500">
                  Enter your credentials to access your account.
                </Text>
              </View>

              {/* Error Message */}
              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <Text className="text-red-600 text-sm font-medium">{error}</Text>
                </View>
              ) : null}

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

              {/* Password Input */}
              <View className="mb-6">
                <Text className="text-zinc-700 font-medium mb-2">Password</Text>
                <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                  <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
                  <TextInput
                    className="flex-1 ml-3 text-base text-zinc-900"
                    placeholder="Enter your password"
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

              {/* Login Button */}
              <TouchableOpacity
                className={`h-14 rounded-xl items-center justify-center mb-4 ${
                  loading ? 'bg-zinc-400' : 'bg-zinc-900'
                }`}
                onPress={handleLogin}
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">Sign In</Text>
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
                onPress={handleGoogleSignIn}
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
              <Text className="text-zinc-500">Don't have an account? </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <Text className="text-emerald-600 font-semibold">Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
