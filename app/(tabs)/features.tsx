import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
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
    iconBg: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
    accent: '#F27121',
  };

  const features = [
    { label: 'Attendance\nList', icon: 'list-outline', route: '/(tabs)/attendancehistory', lib: Ionicons },
    { label: 'Attendance\nCorrection', icon: 'time-outline', route: '/(tabs)/userattendancecorrection', lib: Ionicons },
    { label: 'Leave', icon: 'calendar-outline', route: '/userleave', lib: Ionicons },
    { label: 'Overtime', icon: 'clock-fast', route: '/userovertime', lib: MaterialCommunityIcons },
    { label: 'On Duty', icon: 'airplane-outline', route: '/useronduty', lib: Ionicons },
    { label: 'Shift Schedule', icon: 'moon-outline', route: '/(tabs)/shiftschedule', lib: Ionicons },
    { label: 'Payslip', icon: 'file-tray-full-outline', route: '/userpayslip', lib: Ionicons },
    { label: 'Timesheet', icon: 'journal-outline', route: '/(tabs)/usertimesheet', lib: Ionicons },
    { label: 'Attendance\nReport', icon: 'clock-time-four-outline', route: '/(tabs)/attendancereport', lib: MaterialCommunityIcons },
    { label: 'Attendance\nLocation Report', icon: 'map-marker-radius-outline', route: '/(tabs)/attendancelocationreport', lib: MaterialCommunityIcons },
  ];

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, dyn.text]}>Features</Text>
        <Text style={[styles.headerSubtitle, dyn.sub]}>Payslip, leave, overtime & more</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {features.map((item, index) => (
            <FeatureTile key={item.label} item={item} index={index} dyn={dyn} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureTile({ item, index, dyn }: { item: any; index: number; dyn: any }) {
  const router = useRouter();
  const anim = useSharedValue(0);
  React.useEffect(() => {
    anim.value = withDelay(index * 55, withTiming(1, { duration: 480, easing: Easing.out(Easing.exp) }));
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: (1 - anim.value) * 18 }],
  }));
  return (
    <Animated.View style={[{ width: '47%' }, animStyle]}>
      <TouchableOpacity
        style={[styles.gridItem, dyn.card]}
        onPress={() => router.push(item.route as any)}
        activeOpacity={0.75}
      >
        <View style={[styles.iconCircle, dyn.iconBg]}>
          <item.lib name={item.icon as any} size={30} color={dyn.accent} />
        </View>
        <Text style={[styles.gridLabel, dyn.text]}>{item.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    marginTop: 4,
    opacity: 0.55,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  gridItem: {
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
});

