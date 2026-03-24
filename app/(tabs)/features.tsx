import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export default function FeaturesScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    iconBg: { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' },
    accent: isDark ? '#6B9EFF' : '#2563eb',
  };

  const features = [
    { label: 'Payslip', icon: 'file-tray-full-outline', route: '/userpayslip', lib: Ionicons },
    { label: 'Overtime', icon: 'clock-fast', route: '/userovertime', lib: MaterialCommunityIcons },
    { label: 'Leave', icon: 'calendar-outline', route: '/userleave', lib: Ionicons },
    { label: 'On Duty', icon: 'airplane-outline', route: '/useronduty', lib: Ionicons },
  ];

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, dyn.border]}>
        <Text style={[styles.headerTitle, dyn.text]}>Features</Text>
        <Text style={[styles.headerSubtitle, dyn.sub]}>Payslip, leave, overtime & more</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          {features.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.gridItem, dyn.card, dyn.border]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, dyn.iconBg]}>
                <item.lib name={item.icon as any} size={28} color={dyn.accent} />
              </View>
              <Text style={[styles.gridLabel, dyn.text]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.85,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  gridItem: {
    width: '47%',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});

