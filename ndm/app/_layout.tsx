import { useEffect, useCallback, useState, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, Image, ActivityIndicator, LogBox } from 'react-native';
import { AppProviders } from '../providers/AppProviders';
import { useNetwork } from '../providers/NetworkProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import '../global.css';

// Ignore the navigation warning from OAuth callbacks with legacy payload format
// This is a development-only warning - the app handles the redirect correctly
LogBox.ignoreLogs([
  'The action \'REPLACE\' with payload',
  'The action "REPLACE" with payload',
  'The action \'REPLACE\'',
]);

// Suppress the console.error for this specific navigation warning in development
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('The action \'REPLACE\' with payload')) {
      return; // Suppress this specific error
    }
    originalConsoleError(...args);
  };
}

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const AUTH_CACHE_KEY = 'ndm_was_signed_in';

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isConnected } = useNetwork();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Track auth transition state to prevent flash
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const previousSignedIn = useRef<boolean | null>(null);
  const [cachedAuth, setCachedAuth] = useState<boolean | null>(null);

  // Load cached auth state on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTH_CACHE_KEY).then((val) => {
      setCachedAuth(val === 'true');
    });
  }, []);

  // When offline with cached auth, treat as effectively loaded so we bypass Clerk gates
  // isConnected === null means we haven't determined network state yet — wait
  const networkKnown = isConnected !== null;
  const effectivelyLoaded = networkKnown && (isLoaded || (isConnected === false && cachedAuth === true));

  // Hide the native splash screen once we're ready.
  // useEffect is necessary because effectivelyLoaded may transition to true
  // after the initial onLayout has already fired (e.g. waiting for NetInfo +
  // AsyncStorage when offline).
  useEffect(() => {
    if (effectivelyLoaded) {
      SplashScreen.hideAsync();
    }
  }, [effectivelyLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (effectivelyLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [effectivelyLoaded]);

  // Detect auth state changes and set transitioning state
  useEffect(() => {
    if (!effectivelyLoaded) return;

    // If auth state changed (signed in or out), we're transitioning
    if (previousSignedIn.current !== null && previousSignedIn.current !== isSignedIn) {
      setIsAuthTransitioning(true);
    }
    previousSignedIn.current = isSignedIn;
  }, [effectivelyLoaded, isSignedIn]);

  useEffect(() => {
    if (!effectivelyLoaded || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    // When offline with cached auth, treat user as "signed in" for routing purposes
    const effectivelySignedIn = isSignedIn || (isConnected === false && cachedAuth === true);

    if (effectivelySignedIn && inAuthGroup) {
      // User is signed in (or offline with cached auth), redirect to tabs home
      router.replace('/(app)/(tabs)/' as any);
      setTimeout(() => setIsAuthTransitioning(false), 500);
    } else if (!effectivelySignedIn && !inAuthGroup) {
      // Truly not signed in — redirect to login
      router.replace('/(auth)/login');
      setTimeout(() => setIsAuthTransitioning(false), 500);
    } else {
      // Already in correct group, clear transitioning state
      setIsAuthTransitioning(false);
    }
  }, [effectivelyLoaded, isSignedIn, segments, navigationState?.key, isConnected, cachedAuth]);

  const showOverlay = !effectivelyLoaded || isAuthTransitioning;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      {showOverlay && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}>
          <Image
            source={require('../assets/icon.png')}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
          />
          {isAuthTransitioning && (
            <ActivityIndicator
              size="large"
              color="#10b981"
              style={{ marginTop: 24 }}
            />
          )}
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <InitialLayout />
    </AppProviders>
  );
}
