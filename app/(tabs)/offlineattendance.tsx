import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from './ThemeContext';
import { saveOfflineAttendance } from '../../constants/offline-storage';

const { width } = Dimensions.get('window');

export default function OfflineAttendance() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [qrVerified, setQrVerified] = useState(false);
  const [lastScannedQr, setLastScannedQr] = useState<string | null>(null);

  // Location state
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Result modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Dynamic styles
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
  };

  // Entrance animation
  const fadeAnim = useSharedValue(0);
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [20, 0]) }],
  }));

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Request camera permission
  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  // Get location (GPS works offline via satellite)
  const fetchLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel('Location permission denied');
        setLocationLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setLocation(coords);
      setLocationLabel(
        `Lat: ${coords.latitude.toFixed(7)}, Lng: ${coords.longitude.toFixed(7)}`
      );

      // Try reverse geocode (might work if cached)
      try {
        const results = await Location.reverseGeocodeAsync(coords);
        if (results && results.length > 0) {
          const g = results[0];
          const pieces = [g.name, g.street, g.subregion || g.city].filter(Boolean);
          if (pieces.length > 0) setLocationLabel(pieces.join(', '));
        }
      } catch {
        // Reverse geocode needs internet, keep coordinate display
      }
    } catch (e: any) {
      setLocationLabel('Could not get GPS location');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const formattedDate = currentTime.toDateString();

  const validateQrForCurrentUser = async (qrData: string): Promise<boolean> => {
    const storedUserId   = await AsyncStorage.getItem('userId');
    const storedUsername = await AsyncStorage.getItem('username');

    if (!storedUserId && !storedUsername) {
      throw new Error('User not logged in. Please log in again.');
    }

    if (storedUserId) {
      const logidMarker = `LOGID:${storedUserId}|`;
      if (qrData.includes(logidMarker)) return true;
    }

    if (storedUsername) {
      const usernameMarker = `USER:${storedUsername}|`;
      if (qrData.includes(usernameMarker)) return true;
    }

    return false;
  };

  const handleBarcodeScanned = async (event: any) => {
    if (qrVerified || isTakingPhoto) return;
    const data: string | undefined = event?.data;
    if (!data) return;

    try {
      const isValid = await validateQrForCurrentUser(data);
      if (isValid) {
        setQrVerified(true);
        setLastScannedQr(data);
        showModal(
          'success',
          'QR Code Verified',
          'Look at the camera and take your photo to record offline attendance.'
        );
      } else {
        setQrVerified(false);
        setLastScannedQr(data);
        showModal(
          'error',
          'Invalid QR Code',
          'This QR code does not match your account. Please use your own QR code.'
        );
      }
    } catch (e: any) {
      setQrVerified(false);
      showModal('error', 'QR Error', e?.message || 'Could not validate QR code.');
    }
  };

  // Take photo for verification
  const handleTakePhoto = async () => {
    if (!qrVerified) {
      showModal('error', 'Scan QR Code First', 'Please hold your QR code to the camera to verify your identity before taking a photo.');
      return;
    }
    if (!cameraRef.current || isTakingPhoto) return;
    
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        skipProcessing: true,
        base64: true,
      });

      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
        if (photo.base64) {
          setPhotoBase64(photo.base64);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  // Save the attendance record offline
  const handleSaveAttendance = async () => {
    if (!qrVerified) {
      showModal('error', 'Scan QR Code First', 'Please scan your personal QR code before recording attendance.');
      return;
    }
    if (!capturedPhoto) {
      showModal('error', 'Photo Required', 'Please take a selfie photo first.');
      return;
    }

    try {
      const userId = await AsyncStorage.getItem('userId');
      const empId = await AsyncStorage.getItem('emp_id');
      const userName = await AsyncStorage.getItem('username');

      if (!userId) {
        Alert.alert('Error', 'User not logged in. Please log in again.');
        return;
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

      await saveOfflineAttendance({
        userId,
        empId: empId || '',
        action: 'clock_in',
        timestamp: now.toISOString(),
        date: dateStr,
        time: timeStr,
        displayTime: formattedTime,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        photoBase64: photoBase64,
        userName: userName || undefined,
      });

      showModal('success', '✅ Saved Offline', `Attendance recorded at ${formattedTime}.\n\nThis will be synced to the server when you're back online.`);

      // Reset the camera
      setCapturedPhoto(null);
      setPhotoBase64(null);
      setQrVerified(false);
    } catch (e) {
      showModal('error', '❌ Save Failed', 'Could not save the attendance record locally. Please try again.');
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPhoto(null);
    setPhotoBase64(null);
  };

  // Modal helpers
  const showModal = (type: 'success' | 'error', title: string, message: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setShowResultModal(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowResultModal(false);
      scaleAnim.setValue(0);
      // If success, go back to offline mode hub
      if (modalType === 'success') {
        router.back();
      }
    });
  };

  if (!permission)
    return (
      <View style={[styles.loadingContainer, dyn.bg]}>
        <ActivityIndicator size="large" color="#F27121" />
      </View>
    );

  if (!permission.granted)
    return (
      <View style={[styles.loadingContainer, dyn.bg]}>
        <Text style={dyn.text}>Camera access is needed for offline attendance.</Text>
        <TouchableOpacity
          style={{ marginTop: 16, backgroundColor: '#F27121', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          onPress={requestPermission}
        >
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Attendance</Text>
        <View style={styles.offlineBadge}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#E74C3C" />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Reanimated.View style={animatedStyle}>
          {/* User Info Card */}
          <View style={[styles.infoCard, dyn.card]}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar-today" size={18} color={colors.subText} />
              <Text style={[styles.infoText, dyn.text]}>{formattedDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color="#F27121" />
              {locationLoading ? (
                <ActivityIndicator size="small" color="#F27121" style={{ marginLeft: 8 }} />
              ) : (
                <Text style={[styles.infoText, dyn.sub]} numberOfLines={1}>
                  {locationLabel || 'Getting location...'}
                </Text>
              )}
            </View>
            {location && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.subText} />
                <Text style={[styles.coordText, dyn.sub]}>
                  Latitude: {location.latitude.toFixed(7)} {' · '} Longitude: {location.longitude.toFixed(7)}
                </Text>
              </View>
            )}
          </View>

          {/* Time Display */}
          <View style={styles.timeSection}>
            <Text style={[styles.timeLabel, dyn.sub]}>Record time (offline)</Text>
            <Text style={[styles.timeValue, { color: '#F27121' }]}>{formattedTime}</Text>
          </View>

          {/* Camera / Photo Section */}
          <View style={[styles.cameraCard, dyn.card]}>
            {capturedPhoto ? (
              // Show captured photo
              <View style={styles.previewContainer}>
                <View style={styles.photoPreviewWrapper}>
                  <View style={styles.previewImageContainer}>
                    <Reanimated.Image
                      source={{ uri: capturedPhoto }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.photoVerifiedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                    <Text style={styles.photoVerifiedText}>Photo Captured</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                  <Ionicons name="refresh" size={18} color="#F27121" />
                  <Text style={styles.retakeText}>Retake Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Show camera
              <View style={styles.cameraSection}>
                <Text style={[styles.cameraLabel, dyn.sub]}>
                  {!qrVerified ? "Scan your QR Code to verify identity" : "Identity verified! Take a selfie."}
                </Text>
                <View style={[styles.cameraWrapper, qrVerified && { borderColor: '#27AE60', borderWidth: 3 }]}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="front"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                  <View style={styles.cameraOverlay}>
                    {isTakingPhoto ? (
                      <View style={styles.captureIndicator}>
                        <ActivityIndicator size="large" color="#F27121" />
                        <Text style={styles.captureText}>Capturing...</Text>
                      </View>
                    ) : (
                      <View style={[styles.faceFrame, qrVerified && { borderColor: '#27AE60' }]} />
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.captureButton, !qrVerified && { opacity: 0.5 }]}
                  onPress={handleTakePhoto}
                  disabled={isTakingPhoto || !qrVerified}
                >
                  <View style={[styles.captureButtonInner, qrVerified && { backgroundColor: '#27AE60' }]} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: capturedPhoto ? '#27AE60' : '#95a5a6' },
            ]}
            onPress={handleSaveAttendance}
            disabled={!capturedPhoto}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="content-save-outline" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>SAVE ATTENDANCE</Text>
          </TouchableOpacity>

          {/* GPS Reminder */}
          <View style={styles.gpsReminder}>
            <Ionicons name="information-circle-outline" size={16} color={colors.subText} />
            <Text style={[styles.gpsReminderText, dyn.sub]}>
              GPS location is captured automatically. This record will be synced when you reconnect.
            </Text>
          </View>
        </Reanimated.View>
      </ScrollView>

      {/* Result Modal */}
      <Modal visible={showResultModal} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContainer,
              { transform: [{ scale: scaleAnim }], backgroundColor: colors.card },
            ]}
          >
            <View
              style={[
                styles.modalIconContainer,
                {
                  backgroundColor:
                    modalType === 'success' ? '#d4edda' : '#f8d7da',
                },
              ]}
            >
              {modalType === 'success' ? (
                <Ionicons name="checkmark-circle" size={80} color="#28a745" />
              ) : (
                <Ionicons name="close-circle" size={80} color="#dc3545" />
              )}
            </View>
            <Text style={[styles.modalTitle, dyn.text]}>{modalTitle}</Text>
            <Text style={[styles.modalMessage, dyn.sub]}>{modalMessage}</Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                {
                  backgroundColor:
                    modalType === 'success' ? '#28a745' : '#dc3545',
                },
              ]}
              onPress={closeModal}
            >
              <Text style={styles.modalButtonText}>
                {modalType === 'success' ? 'Done' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  offlineBadgeText: { color: '#E74C3C', fontWeight: '700', fontSize: 13 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Info card
  infoCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, fontWeight: '600' },
  coordText: { fontSize: 12 },

  // Time section
  timeSection: { alignItems: 'center', marginBottom: 16 },
  timeLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  timeValue: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },

  // Camera card
  cameraCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  cameraSection: { alignItems: 'center' },
  cameraLabel: { fontSize: 14, fontWeight: '600', marginBottom: 14 },
  cameraWrapper: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: (width * 0.55) / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#F27121',
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: '80%',
    height: '80%',
    borderRadius: 200,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
  },
  captureIndicator: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  captureText: { color: '#FFF', fontWeight: '600', marginTop: 8 },

  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#F27121',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F27121',
  },

  // Preview
  previewContainer: { alignItems: 'center' },
  photoPreviewWrapper: { alignItems: 'center', marginBottom: 12 },
  previewImageContainer: {
    width: width * 0.45,
    height: width * 0.45,
    borderRadius: (width * 0.45) / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#27AE60',
  },
  previewImage: { width: '100%', height: '100%' },
  photoVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39,174,96,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  photoVerifiedText: { color: '#27AE60', fontWeight: '700', fontSize: 14 },

  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  retakeText: { color: '#F27121', fontWeight: '600', fontSize: 14 },

  // Save button
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    gap: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  saveButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  // GPS reminder
  gpsReminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  gpsReminderText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
