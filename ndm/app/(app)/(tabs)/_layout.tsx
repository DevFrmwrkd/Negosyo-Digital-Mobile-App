import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TAB_ITEMS = [
  { routeName: 'index',    label: 'Home',    icon: 'home-outline' as const,    activeIcon: 'home' as const },
  { routeName: 'referrals', label: 'Referral', icon: 'people-outline' as const, activeIcon: 'people' as const },
  { routeName: 'wallet',   label: 'Wallet',  icon: 'wallet-outline' as const,  activeIcon: 'wallet' as const },
  { routeName: 'profile',  label: 'Profile', icon: 'person-outline' as const,  activeIcon: 'person' as const },
];

function CustomTabBar({ state, navigation }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Build a lookup: routeName → index in state.routes
  const routeIndexMap: Record<string, number> = {};
  state.routes.forEach((r: any, i: number) => { routeIndexMap[r.name] = i; });

  const handleTabPress = (routeName: string) => {
    const routeIdx = routeIndexMap[routeName];
    if (routeIdx === undefined) return;
    const isFocused = state.index === routeIdx;
    if (!isFocused) navigation.navigate(routeName);
  };

  // Render 5 visible slots: [left-2] [FAB] [right-2]
  const leftTabs  = TAB_ITEMS.slice(0, 2);
  const rightTabs = TAB_ITEMS.slice(2, 4);

  const renderTab = (item: typeof TAB_ITEMS[0]) => {
    const routeIdx = routeIndexMap[item.routeName] ?? -1;
    const isFocused = state.index === routeIdx;
    return (
      <TouchableOpacity
        key={item.routeName}
        style={styles.tab}
        onPress={() => handleTabPress(item.routeName)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isFocused ? item.activeIcon : item.icon}
          size={22}
          color={isFocused ? '#10b981' : '#a1a1aa'}
        />
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabRow}>
        {leftTabs.map(renderTab)}

        {/* Center FAB */}
        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => router.push('/(app)/submit/info' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.fabLabel}>Submit</Text>
        </View>

        {rightTabs.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  tabRow: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'flex-end',
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    color: '#a1a1aa',
    fontWeight: '500',
    marginTop: 1,
  },
  tabLabelActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ translateY: -12 }],
  },
  fabLabel: {
    fontSize: 10,
    color: '#a1a1aa',
    fontWeight: '500',
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="referrals" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
