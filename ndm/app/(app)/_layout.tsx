import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function AppLayout() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const updateLastActive = useMutation(api.creators.updateLastActive);

  useEffect(() => {
    if (isSignedIn && userId) {
      updateLastActive({ clerkId: userId });
    }
  }, [isSignedIn, userId]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
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
