import { View, Pressable, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from './useTheme';
import { ThemedText } from './ThemedText';

type TabId = 'home' | 'feed' | 'lapor' | 'aspirasi' | 'profile';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: {
  id: TabId;
  label: string;
  route: `/${string}`;
  active: IconName;
  inactive: IconName;
}[] = [
  {
    id: 'home',
    label: 'Beranda',
    route: '/home',
    active: 'home',
    inactive: 'home-outline',
  },
  {
    id: 'feed',
    label: 'Feed',
    route: '/feed',
    active: 'newspaper',
    inactive: 'newspaper-outline',
  },
  {
    id: 'lapor',
    label: 'Lapor',
    route: '/lapor',
    active: 'add',
    inactive: 'add',
  },
  {
    id: 'aspirasi',
    label: 'Aspirasi',
    route: '/aspirasi',
    active: 'chatbubbles',
    inactive: 'chatbubbles-outline',
  },
  {
    id: 'profile',
    label: 'Profil',
    route: '/profile',
    active: 'person',
    inactive: 'person-outline',
  },
];

/**
 * Tab dianggap aktif juga untuk rute turunannya. `pathname === tab.route`
 * gagal di `/aspirasi/new`, `/aduan/[id]`, dan `/layanan/[id]`, sehingga
 * TIDAK ADA tab yang tampak terpilih di layar detail mana pun.
 */
function isTabActive(pathname: string, route: string): boolean {
  if (route === '/home') return pathname === '/home' || pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function BottomNav() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.row}>
        {TABS.map((tab, index) => {
          const active = isTabActive(pathname, tab.route);
          const color = active ? colors.primary : colors.textMuted;
          const isCenter = index === 2;

          if (isCenter) {
            return (
              <View key={tab.id} style={styles.centerWrapper}>
                <Pressable
                  onPress={() => router.replace(tab.route)}
                  style={({ pressed }) => [
                    styles.centerButton,
                    {
                      backgroundColor: colors.primary,
                      transform: [{ translateY: -14 }],
                      opacity: pressed ? 0.9 : 1,
                      shadowColor: colors.textPrimary,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                >
                  <Ionicons
                    name="add"
                    size={28}
                    color={colors.surface}
                  />
                </Pressable>
                <ThemedText
                  variant="micro"
                  style={{
                    color: colors.primary,
                    marginTop: spacing(1),
                  }}
                >
                  {tab.label}
                </ThemedText>
              </View>
            );
          }

          return (
            <Pressable
              key={tab.id}
              onPress={() => router.replace(tab.route)}
              style={({ pressed }) => [
                styles.tab,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={active ? tab.active : tab.inactive}
                size={22}
                color={color}
              />
              <ThemedText
                variant="micro"
                style={{
                  color,
                  marginTop: spacing(1),
                }}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
});
