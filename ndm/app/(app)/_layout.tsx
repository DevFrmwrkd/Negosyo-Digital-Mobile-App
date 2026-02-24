import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useNetwork } from '../../providers/NetworkProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_CACHE_KEY = 'ndm_was_signed_in';

export default function AppLayout() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { isConnected } = useNetwork();
  const updateLastActive = useMutation(api.creators.updateLastActive);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Auto-sync offline data when connectivity returns
  useOfflineSync();

  // Load cached auth state on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTH_CACHE_KEY).then((val) => {
      setCachedAuth(val === 'true');
      setAuthChecked(true);
    });
  }, []);

  // Cache auth state when signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      AsyncStorage.setItem(AUTH_CACHE_KEY, 'true');
      setCachedAuth(true);
    }
  }, [isLoaded, isSignedIn]);

  // Clear cache on explicit sign-out (only when definitely online + Clerk confirmed not signed in)
  // isConnected must be explicitly true (not null/unknown) to avoid race condition
  useEffect(() => {
    if (isLoaded && !isSignedIn && isConnected === true) {
      AsyncStorage.removeItem(AUTH_CACHE_KEY);
      setCachedAuth(false);
    }
  }, [isLoaded, isSignedIn, isConnected]);

  // When offline with cached auth, treat as effectively loaded
  // isConnected must be known (not null) before making routing decisions
  const networkKnown = isConnected !== null;
  const effectivelyLoaded = networkKnown && (isLoaded || (isConnected === false && cachedAuth === true));

  useEffect(() => {
    if (isSignedIn && userId) {
      updateLastActive({ clerkId: userId });
    }
  }, [isSignedIn, userId]);

  if (!effectivelyLoaded || !authChecked) return null;

  // Offline with cached auth → stay in the app (draft mode)
  // Only redirect to login if definitely online and Clerk confirmed not signed in
  const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);
  if (!effectivelySignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
