import { useEffect, useCallback, useState, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, Image, ActivityIndicator, LogBox } from 'react-native';
import { AppProviders } from '../providers/AppProviders';
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

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Track auth transition state to prevent flash
  const [isAuthTransitioning, setIsAuthTransitioning] = useState(false);
  const previousSignedIn = useRef<boolean | null>(null);

  const onLayoutRootView = useCallback(async () => {
    if (isLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  // Detect auth state changes and set transitioning state
  useEffect(() => {
    if (!isLoaded) return;

    // If auth state changed (signed in or out), we're transitioning
    if (previousSignedIn.current !== null && previousSignedIn.current !== isSignedIn) {
      setIsAuthTransitioning(true);
    }
    previousSignedIn.current = isSignedIn;
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && inAuthGroup) {
      // User just signed in, redirect to tabs home
      router.replace('/(app)/(tabs)/' as any);
      // Clear transitioning state after a short delay to ensure navigation completes
      setTimeout(() => setIsAuthTransitioning(false), 500);
    } else if (!isSignedIn && !inAuthGroup) {
      // User signed out, redirect to login
      router.replace('/(auth)/login');
      setTimeout(() => setIsAuthTransitioning(false), 500);
    } else {
      // Already in correct group, clear transitioning state
      setIsAuthTransitioning(false);
    }
  }, [isLoaded, isSignedIn, segments, navigationState?.key]);

  const showOverlay = !isLoaded || isAuthTransitioning;

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
