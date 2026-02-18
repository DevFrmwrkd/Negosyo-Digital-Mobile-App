import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Id } from '../../convex/_generated/dataModel';

type NotificationType =
  | 'submission_approved'
  | 'submission_rejected'
  | 'new_lead'
  | 'payout_sent'
  | 'website_live'
  | 'submission_created'
  | 'profile_updated'
  | 'password_changed'
  | 'system';

function getNotificationIcon(type: NotificationType): { name: string; color: string; bg: string } {
  switch (type) {
    case 'submission_approved':
      return { name: 'checkmark-circle', color: '#10b981', bg: 'bg-emerald-100' };
    case 'submission_rejected':
      return { name: 'close-circle', color: '#ef4444', bg: 'bg-red-100' };
    case 'new_lead':
      return { name: 'person-add', color: '#3b82f6', bg: 'bg-blue-100' };
    case 'payout_sent':
      return { name: 'cash', color: '#10b981', bg: 'bg-emerald-100' };
    case 'website_live':
      return { name: 'globe', color: '#8b5cf6', bg: 'bg-purple-100' };
    case 'submission_created':
      return { name: 'add-circle', color: '#6366f1', bg: 'bg-indigo-100' };
    case 'profile_updated':
      return { name: 'person-circle', color: '#f59e0b', bg: 'bg-amber-100' };
    case 'password_changed':
      return { name: 'lock-closed', color: '#71717a', bg: 'bg-zinc-100' };
    case 'system':
    default:
      return { name: 'information-circle', color: '#71717a', bg: 'bg-zinc-100' };
  }
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const notifications = useQuery(
    api.notifications.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Auto-clear the bell badge whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (creator?._id) {
        markAllAsRead({ creatorId: creator._id });
      }
    }, [creator?._id])
  );

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead({ id: notification._id });
    }

    // Deep link based on notification type
    if (notification.data?.submissionId) {
      router.push(`/(app)/submissions/${notification.data.submissionId}` as any);
    }
  };

  const handleMarkAllRead = async () => {
    if (creator?._id && unreadCount > 0) {
      await markAllAsRead({ creatorId: creator._id });
    }
  };

  if (!creator || notifications === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between border-b border-zinc-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-zinc-50"
          >
            <Ionicons name="arrow-back" size={20} color="#18181b" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-zinc-900 ml-4">Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text className="text-sm font-semibold text-emerald-600">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {notifications && notifications.length > 0 ? (
          notifications.map((notification) => {
            const icon = getNotificationIcon(notification.type as NotificationType);
            return (
              <TouchableOpacity
                key={notification._id}
                className={`px-4 py-4 flex-row border-b border-zinc-50 ${
                  !notification.read ? 'bg-emerald-50/30' : ''
                }`}
                onPress={() => handleNotificationPress(notification)}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center ${icon.bg}`}>
                  <Ionicons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-sm font-bold ${
                        !notification.read ? 'text-zinc-900' : 'text-zinc-700'
                      }`}
                      numberOfLines={1}
                    >
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View className="w-2 h-2 rounded-full bg-emerald-500 ml-2" />
                    )}
                  </View>
                  <Text className="text-sm text-zinc-500 mt-0.5" numberOfLines={2}>
                    {notification.body}
                  </Text>
                  <Text className="text-xs text-zinc-400 mt-1">
                    {timeAgo(notification.sentAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="notifications-off-outline" size={48} color="#a1a1aa" />
            <Text className="text-zinc-500 text-base mt-4">No notifications yet</Text>
            <Text className="text-zinc-400 text-sm mt-1">
              You'll be notified about submission updates and more.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
