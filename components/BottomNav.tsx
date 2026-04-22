import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../app/(tabs)/ThemeContext';

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Feeds',    icon: 'list-outline',           route: '/feeds' },
  { label: 'Features', icon: 'grid-outline',           route: '/features' },
  { label: 'Home',     icon: 'home-outline',           route: '/userdashboard' },
  { label: 'Company',  icon: 'people-circle-outline',  route: '/company' },
  { label: 'Request',  icon: 'notifications-outline',  route: '/request' },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const handlePress = (route: string) => {
    if (!pathname.startsWith(route)) {
      router.push(route as any);
    }
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[
        styles.safeArea,
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
    >
      <View style={styles.container}>
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.route);
          const tint = active ? '#F27121' : colors.subText;
          return (
            <TouchableOpacity
              key={item.label}
              style={styles.item}
              onPress={() => handlePress(item.route)}
            >
              <Ionicons name={item.icon} size={22} color={tint} />
              <Text
                style={[
                  styles.label,
                  { color: tint, fontWeight: active ? '600' : '400' },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    borderTopWidth: 1,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 56,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
});

export default BottomNav;

