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
    iconBg: { backgroundColor: isDark ? '#333' : '#F0F0F0' },
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
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dyn.text]}>Features</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.gridContainer]}>
          {features.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.gridItem, dyn.card]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.iconCircle, dyn.iconBg]}>
                <item.lib name={item.icon as any} size={26} color={isDark ? '#FFF' : '#333'} />
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: {
    padding: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '47%',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});

