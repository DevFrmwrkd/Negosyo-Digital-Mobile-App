import React, { useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/clerk-expo';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator, Text } from 'react-native';

// Environment variables - set via EAS secrets for production builds
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || 'https://diligent-ibex-454.convex.cloud';
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dXByaWdodC1jYXJkaW5hbC0xNS5jbGVyay5hY2NvdW50cy5kZXYk';

const convex = new ConvexReactClient(CONVEX_URL);

// Token cache for Clerk using SecureStore
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error('Failed to save token:', err);
    }
  },
  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error('Failed to clear token:', err);
    }
  },
};

function ConvexClerkProviderInner({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

function ClerkLoadedWithFallback({ children }: { children: React.ReactNode }) {
  const { loaded } = useClerk();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) {
        setShowTimeout(true);
        console.log('Clerk is taking longer than expected to load...');
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [loaded]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
        {showTimeout && (
          <Text style={{ marginTop: 16, color: '#666' }}>Loading authentication...</Text>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkLoadedWithFallback>
        <ConvexClerkProviderInner>
          {children}
        </ConvexClerkProviderInner>
      </ClerkLoadedWithFallback>
    </ClerkProvider>
  );
}
