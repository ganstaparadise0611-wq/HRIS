import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export default function RequestScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
  };

  const requestTiles = [
    {
      label: 'Leave Request',
      description: 'Apply for vacation, sick leave, or other absences.',
      icon: 'calendar-outline' as const,
      route: '/userleave',
      lib: Ionicons,
    },
    {
      label: 'Overtime Request',
      description: 'Submit overtime work for approval and tracking.',
      icon: 'clock-fast' as const,
      route: '/userovertime',
      lib: MaterialCommunityIcons,
    },
    {
      label: 'On Duty / Official Business',
      description: 'Log field work, client visits, and off-site duties.',
      icon: 'airplane-takeoff' as const,
      route: '/useronduty',
      lib: MaterialCommunityIcons,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, dyn.text]}>Request</Text>
        <Text style={[styles.headerSubtitle, dyn.sub]}>
          Central place for all HR and attendance-related requests.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {requestTiles.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.tile, dyn.card, dyn.border]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.tileIconCircle}>
              <item.lib
                name={item.icon as any}
                size={22}
                color={isDark ? '#FFF' : '#333'}
              />
            </View>
            <View style={styles.tileText}>
              <Text style={[styles.tileLabel, dyn.text]}>{item.label}</Text>
              <Text style={[styles.tileDescription, dyn.sub]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subText} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { marginTop: 4, fontSize: 13 },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(242,113,33,0.12)',
  },
  tileText: {
    flex: 1,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  tileDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
});

