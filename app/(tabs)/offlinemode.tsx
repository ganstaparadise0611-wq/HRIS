import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from './ThemeContext';
import {
  getUnsyncedAttendanceRecords,
  getUnsyncedActivityRecords,
  isOnline,
} from '../../constants/offline-storage';

const { width } = Dimensions.get('window');

export default function OfflineMode() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [checking, setChecking] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // Load unsynced record count
  useEffect(() => {
    const loadCounts = async () => {
      const att = await getUnsyncedAttendanceRecords();
      const act = await getUnsyncedActivityRecords();
      setUnsyncedCount(att.length + act.length);
    };
    loadCounts();
  }, []);

  // Floating WiFi icon animation
  const wifiFloat = useSharedValue(0);
  useEffect(() => {
    wifiFloat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  const wifiAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(wifiFloat.value, [0, 1], [0, -12]) }],
  }));

  // Entrance animation
  const fadeAnim = useSharedValue(0);
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [30, 0]) }],
  }));

  // Dynamic styles
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
  };

  // Check online status and redirect if online
  const handleGoOnline = async () => {
    setChecking(true);
    try {
      const online = await isOnline();
      if (online) {
        router.replace('/(tabs)/userdashboard' as any);
      } else {
        Alert.alert(
          'Still Offline',
          'Your device is not connected to the internet yet. Please check your WiFi or mobile data connection.',
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert('Error', 'Could not check network status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Offline Mode</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View style={animatedStyle}>
          {/* Hero Illustration Area */}
          <View style={styles.heroSection}>
            {/* Animated WiFi-off icon */}
            <Reanimated.View style={[styles.heroIconWrapper, wifiAnimStyle]}>
              <View style={[styles.heroIconCircle, { backgroundColor: isDark ? 'rgba(242,113,33,0.15)' : 'rgba(242,113,33,0.10)' }]}>
                <MaterialCommunityIcons name="wifi-off" size={64} color="#F27121" />
              </View>
            </Reanimated.View>

            <Text style={[styles.heroTitle, dyn.text]}>Oh Dear...</Text>
            <Text style={[styles.heroSubtitle, dyn.sub]}>
              Connection can get bad sometimes, but we{'\n'}know the solution for this. Here's how...
            </Text>

            {/* Step indicators */}
            <View style={styles.dotIndicator}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={[styles.dot, { backgroundColor: colors.border }]} />
              <View style={[styles.dot, { backgroundColor: colors.border }]} />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Offline Attendance Record */}
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => setShowBottomSheet(true)}
              activeOpacity={0.85}
            >
              <View style={[styles.actionButtonIcon, { backgroundColor: isDark ? 'rgba(242,113,33,0.15)' : 'rgba(242,113,33,0.08)' }]}>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#F27121" />
              </View>
              <Text style={[styles.secondaryButtonText, dyn.text]}>Offline Attendance Record</Text>
            </TouchableOpacity>

            {/* Offline Activity Record */}
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => {
                router.push('/(tabs)/offlineactivity' as any);
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.actionButtonIcon, { backgroundColor: isDark ? 'rgba(242,113,33,0.15)' : 'rgba(242,113,33,0.08)' }]}>
                <MaterialCommunityIcons name="video-outline" size={24} color="#F27121" />
              </View>
              <Text style={[styles.secondaryButtonText, dyn.text]}>Offline Activity Record</Text>
            </TouchableOpacity>

            {/* Unsynced badge */}
            {unsyncedCount > 0 && (
              <View style={styles.unsyncedBanner}>
                <Ionicons name="cloud-offline-outline" size={18} color="#E67E22" />
                <Text style={styles.unsyncedText}>
                  {unsyncedCount} record{unsyncedCount > 1 ? 's' : ''} pending sync
                </Text>
              </View>
            )}
          </View>

          {/* Online Mode Button */}
          <TouchableOpacity
            style={[styles.onlineButton, { backgroundColor: '#F27121' }]}
            onPress={handleGoOnline}
            disabled={checking}
            activeOpacity={0.85}
          >
            {checking ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="wifi" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.onlineButtonText}>ONLINE MODE</Text>
              </>
            )}
          </TouchableOpacity>

          {/* GPS Reminder */}
          <View style={styles.gpsReminder}>
            <Ionicons name="location" size={16} color="#F27121" />
            <Text style={[styles.gpsReminderText, { color: '#F27121' }]}>
              Make sure that your GPS is ON.
            </Text>
          </View>
        </Reanimated.View>
      </ScrollView>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={showBottomSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBottomSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowBottomSheet(false)}
        >
          <TouchableOpacity
            style={[styles.bottomSheet, dyn.card]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View style={styles.sheetHandle}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
            </View>

            {/* Offline Attendance Record Button */}
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetSecondaryButton, { borderColor: colors.border }]}
              onPress={() => {
                setShowBottomSheet(false);
                router.push('/(tabs)/offlineattendance' as any);
              }}
            >
              <MaterialCommunityIcons name="clock-alert-outline" size={22} color="#F27121" />
              <Text style={[styles.sheetSecondaryText, dyn.text]}>OFFLINE ATTENDANCE RECORD</Text>
            </TouchableOpacity>

            {/* Scan QR Code */}
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetSecondaryButton, { borderColor: colors.border }]}
              onPress={() => {
                setShowBottomSheet(false);
                // Use the existing attendance module's QR scanner
                router.push('/(tabs)/offlineattendance' as any);
              }}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={22} color="#F27121" />
              <Text style={[styles.sheetSecondaryText, dyn.text]}>SCAN QR CODE</Text>
            </TouchableOpacity>

            {/* Offline Attendance List */}
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetSecondaryButton, { borderColor: colors.border }]}
              onPress={() => {
                setShowBottomSheet(false);
                router.push('/(tabs)/offlineattendancelist' as any);
              }}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={22} color="#F27121" />
              <Text style={[styles.sheetSecondaryText, dyn.text]}>OFFLINE ATTENDANCE LIST</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  // Hero section
  heroSection: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  heroIconWrapper: { marginBottom: 24 },
  heroIconCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { fontSize: 28, fontWeight: '800', marginBottom: 10 },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
    marginBottom: 16,
  },
  dotIndicator: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#F27121', width: 24 },

  // Buttons
  buttonsContainer: { gap: 14, marginBottom: 30 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 4,
  },
  actionButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  primaryButton: { backgroundColor: '#F27121' },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1 },
  secondaryButton: { borderWidth: 1.5 },
  secondaryButtonText: { fontSize: 16, fontWeight: '700', flex: 1 },

  unsyncedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(230,126,34,0.10)',
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  unsyncedText: { color: '#E67E22', fontWeight: '600', fontSize: 14 },

  // Online button
  onlineButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#F27121',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
  },
  onlineButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 1 },

  // GPS reminder
  gpsReminder: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  gpsReminderText: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandle: { alignItems: 'center', marginBottom: 20 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
    gap: 12,
  },
  sheetPrimaryButton: { backgroundColor: '#27AE60' },
  sheetPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
  sheetSecondaryButton: { borderWidth: 1.5 },
  sheetSecondaryText: { fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
});
