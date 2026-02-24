import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import CertificateCard from '../../../components/CertificateCard';

type MenuSection = {
  title: string;
  items: {
    icon: any;
    label: string;
    sublabel?: string;
    onPress: () => void;
    tintColor?: string;
    showArrow?: boolean;
    danger?: boolean;
  }[];
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const certModalRef = useRef<View>(null);

  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const handleShareCert = useCallback(async () => {
    try {
      const uri = await captureRef(certModalRef, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your certificate',
      });
    } catch {
      Alert.alert('Error', 'Could not share certificate. Please try again.');
    }
  }, []);

  const handleDownloadCert = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && (Platform.Version as number) < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Save Certificate',
            message: 'Allow the app to save your certificate to your gallery.',
            buttonPositive: 'Allow',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission needed', 'Please allow access to save the certificate.');
          return;
        }
      }
      const uri = await captureRef(certModalRef, {
        format: 'png',
        quality: 1,
      });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('Saved!', 'Certificate has been saved to your gallery.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save certificate. Please try again.');
    }
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  // When online, wait for data. When offline, skip — layout already verified auth.
  if (!isOffline && (!isLoaded || creator === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const displayName = [creator?.firstName, creator?.lastName].filter(Boolean).join(' ') || user?.fullName || 'Creator';
  const email       = creator?.email || user?.primaryEmailAddress?.emailAddress || '';
  const initial     = displayName.charAt(0).toUpperCase();

  const isCertified = !!(creator as any)?.certifiedAt;

  const accountItems: MenuSection['items'] = [
    {
      icon: 'person-outline',
      label: 'Edit Profile',
      sublabel: 'Update your name and details',
      onPress: () => router.push('/(app)/edit-profile' as any),
      showArrow: true,
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      sublabel: 'Manage your notification settings',
      onPress: () => router.push('/(app)/notifications' as any),
      showArrow: true,
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Change Password',
      sublabel: 'Update your account password',
      onPress: () => router.push('/(app)/change-password' as any),
      showArrow: true,
    },
  ];

  if (isCertified) {
    accountItems.push({
      icon: 'ribbon-outline',
      label: 'Show My Certificate',
      sublabel: 'View and share your certification',
      onPress: () => setShowCertModal(true),
      showArrow: true,
      tintColor: '#10b981',
    });
  }

  const menuSections: MenuSection[] = [
    {
      title: 'Account',
      items: accountItems,
    },
    {
      title: 'My Activity',
      items: [
        {
          icon: 'layers-outline',
          label: 'My Submissions',
          sublabel: `${(creator as any)?.submissionCount ?? 0} total submissions`,
          onPress: () => router.push('/(app)/submissions' as any),
          showArrow: true,
        },
        {
          icon: 'people-outline',
          label: 'Referrals',
          sublabel: 'View your referral stats',
          onPress: () => router.push('/(app)/(tabs)/referrals' as any),
          showArrow: true,
        },
        {
          icon: 'wallet-outline',
          label: 'Earnings',
          sublabel: `₱${((creator as any)?.totalEarnings ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} total earned`,
          onPress: () => router.push('/(app)/(tabs)/wallet' as any),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help & FAQ',
          onPress: () => router.push('/(app)/help-faq' as any),
          showArrow: true,
        },
        {
          icon: 'document-text-outline',
          label: 'Terms of Service',
          onPress: () => router.push('/(app)/terms-of-service' as any),
          showArrow: true,
        },
        {
          icon: 'lock-closed-outline',
          label: 'Privacy Policy',
          onPress: () => router.push('/(app)/privacy-policy' as any),
          showArrow: true,
        },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={{
          backgroundColor: '#fff',
          paddingTop: insets.top + 12,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#f4f4f5',
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#18181b', marginBottom: 16 }}>Profile</Text>

          {/* Avatar + Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: '#18181b',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {(creator as any)?.profileImage ? (
                <Image
                  source={{ uri: (creator as any).profileImage }}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
              ) : (
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#18181b' }}>{displayName}</Text>
              <Text style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>{email}</Text>
              {creator?.referralCode && (
                <View style={{
                  marginTop: 6, flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#f4f4f5', borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', gap: 4,
                }}>
                  <Ionicons name="gift-outline" size={11} color="#71717a" />
                  <Text style={{ fontSize: 11, color: '#52525b', fontWeight: '600', letterSpacing: 0.5 }}>
                    {creator.referralCode}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats Strip */}
        <View style={{
          backgroundColor: '#fff', flexDirection: 'row',
          paddingVertical: 16, paddingHorizontal: 8,
          borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
        }}>
          {[
            { label: 'Submissions', value: (creator as any)?.submissionCount ?? 0 },
            { label: 'Balance',     value: `₱${((creator?.balance) ?? 0).toFixed(0)}` },
            { label: 'Total Earned', value: `₱${(((creator as any)?.totalEarnings) ?? 0).toFixed(0)}` },
          ].map((s, i) => (
            <View key={s.label} style={{
              flex: 1, alignItems: 'center',
              borderRightWidth: i < 2 ? 1 : 0,
              borderRightColor: '#f4f4f5',
              paddingHorizontal: 4,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#18181b' }}>{s.value}</Text>
              <Text style={{ fontSize: 10, color: '#a1a1aa', fontWeight: '500', marginTop: 2 }}>
                {s.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        {/* Menu Sections */}
        <View style={{ padding: 16, gap: 20 }}>
          {menuSections.map((section) => (
            <View key={section.title}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {section.title.toUpperCase()}
              </Text>
              <View style={{
                backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                {section.items.map((item, idx) => (
                  <View key={item.label}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
                      onPress={item.onPress}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: item.danger ? '#fee2e2' : '#f4f4f5',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.danger ? '#ef4444' : (item.tintColor ?? '#52525b')}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: item.danger ? '#ef4444' : '#18181b' }}>
                          {item.label}
                        </Text>
                        {item.sublabel && (
                          <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 1 }}>{item.sublabel}</Text>
                        )}
                      </View>
                      {item.showArrow && (
                        <Ionicons name="chevron-forward" size={16} color="#d4d4d8" />
                      )}
                    </TouchableOpacity>
                    {idx < section.items.length - 1 && (
                      <View style={{ height: 1, backgroundColor: '#f4f4f5', marginHorizontal: 14 }} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Sign Out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            style={{
              backgroundColor: '#fff', borderRadius: 20, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              borderWidth: 1, borderColor: '#fee2e2',
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 10, backgroundColor: '#fee2e2',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {signingOut
                ? <ActivityIndicator size="small" color="#ef4444" />
                : <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              }
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444', flex: 1 }}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </Text>
          </TouchableOpacity>

          {/* App version */}
          <Text style={{ fontSize: 11, color: '#d4d4d8', textAlign: 'center' }}>
            Negosyo Digital Mobile v1.0.0
          </Text>
        </View>

      </ScrollView>

      {/* Certificate Modal */}
      <Modal
        visible={showCertModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCertModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            width: '100%',
            maxHeight: '85%',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
            }}>
              <TouchableOpacity
                onPress={() => setShowCertModal(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color="#18181b" />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#18181b', flex: 1, textAlign: 'center' }}>
                My Certificate
              </Text>
              <TouchableOpacity
                onPress={handleShareCert}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#f4f4f5',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="share-outline" size={16} color="#18181b" />
              </TouchableOpacity>
            </View>

            {/* Certificate */}
            <ScrollView
              contentContainerStyle={{ padding: 20, alignItems: 'center' }}
              showsVerticalScrollIndicator={false}
            >
              <CertificateCard
                ref={certModalRef}
                creatorName={
                  creator
                    ? `${(creator.firstName || '').toUpperCase()} ${(creator.lastName || '').toUpperCase()}`.trim()
                    : ''
                }
                certMonth={
                  (creator as any)?.certifiedAt
                    ? new Date((creator as any).certifiedAt).toLocaleString('en-US', { month: 'long' })
                    : new Date().toLocaleString('en-US', { month: 'long' })
                }
                certYear={
                  (creator as any)?.certifiedAt
                    ? new Date((creator as any).certifiedAt).getFullYear()
                    : new Date().getFullYear()
                }
              />
            </ScrollView>

            {/* Action buttons */}
            <View style={{
              paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20,
              borderTopWidth: 1, borderTopColor: '#f4f4f5',
            }}>
              <TouchableOpacity
                onPress={handleDownloadCert}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#10b981',
                  height: 50, borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                  Save to Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShareCert}
                activeOpacity={0.7}
                style={{
                  height: 44, borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="share-outline" size={16} color="#10b981" style={{ marginRight: 6 }} />
                <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '700' }}>
                  Share Certificate
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
