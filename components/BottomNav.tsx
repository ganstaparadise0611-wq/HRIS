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
    <View style={styles.floatingWrapper}>
      <View style={[
        styles.container, 
        { 
          backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          shadowColor: '#000',
        }
      ]}>
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.route);
          const tint = active ? '#F27121' : (isDark ? '#888' : '#A0A0A0');
          return (
            <TouchableOpacity
              key={item.label}
              style={styles.item}
              onPress={() => handlePress(item.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, active && styles.activeIconWrapper]}>
                <Ionicons name={active ? item.icon.replace('-outline', '') as any : item.icon} size={24} color={tint} />
              </View>
              {active && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 70,
    width: '100%',
    borderRadius: 35,
    paddingHorizontal: 10,
    elevation: 15,
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(242, 113, 33, 0.1)',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F27121',
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
});

export default BottomNav;


