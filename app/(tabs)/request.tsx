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
      label: 'Attendance Correction',
      description: 'Fix missed clock-ins or incorrect logs.',
      icon: 'time-outline' as const,
      route: '/userattendancecorrection',
      lib: Ionicons,
    },
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
        <Text style={[styles.headerTitle, dyn.text]}>Requests</Text>
        <Text style={[styles.headerSubtitle, dyn.sub]}>
          Submit and track your HR requests.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {requestTiles.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.tile, dyn.card]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.75}
          >
            <View style={styles.tileIconCircle}>
              <item.lib
                name={item.icon as any}
                size={24}
                color="#F27121"
              />
            </View>
            <View style={styles.tileText}>
              <Text style={[styles.tileLabel, dyn.text]}>{item.label}</Text>
              <Text style={[styles.tileDescription, dyn.sub]}>{item.description}</Text>
            </View>
            <View style={styles.chevronWrapper}>
              <Ionicons name="chevron-forward" size={18} color="#F27121" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  headerSubtitle: { marginTop: 4, fontSize: 15, opacity: 0.55 },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  tileIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(242,113,33,0.1)',
  },
  tileText: {
    flex: 1,
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tileDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.65,
  },
  chevronWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(242,113,33,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

