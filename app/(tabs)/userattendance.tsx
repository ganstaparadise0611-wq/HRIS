import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendUrl } from '../../constants/backend-config';
import { recheckNetwork } from '../../constants/network-detector';
import { useTheme } from './ThemeContext';

const { width } = Dimensions.get('window');

// Office geofence configuration
const OFFICE_COORD = {
  latitude: 14.613002,
  longitude: 120.9935661,
};
const OFFICE_RADIUS_METERS = 60;

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

export default function UserAttendance() {
  const router = useRouter();
  const { colors, theme } = useTheme(); // <--- GET COLORS
  const isDark = theme === 'dark';
  
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrVerified, setQrVerified] = useState(false);
  const [lastScannedQr, setLastScannedQr] = useState<string | null>(null);
  
  // Modal states
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalHint, setModalHint] = useState("");
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Map / location (when clocked in)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  // DYNAMIC STYLES
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    footer: { backgroundColor: colors.card },
    border: { borderColor: colors.border }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const savedTime = await AsyncStorage.getItem('userClockInTime');
        if (savedTime) {
          setIsClockedIn(true);
          setClockInTime(savedTime);
        }
      } catch (e) { console.log("Failed to load status"); } 
      finally { setIsLoading(false); }
    };
    checkStatus();
  }, []);

  useEffect(() => { if (permission && !permission.granted) requestPermission(); }, [permission]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Recheck network when screen mounts so verify uses ngrok if local is unreachable
  useEffect(() => {
    recheckNetwork().catch(() => {});
  }, []);

  // Get current location when clocked in (for map)
  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }

      setLocationError(null);
      setLocationLabel(null);

      // Strategy:
      // - Start with a quick reading so the map shows something fast
      // - Then watch location briefly and choose the "best" (lowest accuracy meters)
      const quick = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const quickCoords = {
        latitude: quick.coords.latitude,
        longitude: quick.coords.longitude,
      };
      setLocation(quickCoords);

      let best = {
        latitude: quick.coords.latitude,
        longitude: quick.coords.longitude,
        accuracy: typeof quick.coords.accuracy === 'number' ? quick.coords.accuracy : Number.POSITIVE_INFINITY,
      };

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 0,
          mayShowUserSettingsDialog: true,
        },
        (pos) => {
          const acc = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : Number.POSITIVE_INFINITY;
          if (acc < best.accuracy) {
            best = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: acc,
            };
            setLocation({ latitude: best.latitude, longitude: best.longitude });
          }
        }
      );

      // Wait a short window for GPS to settle, then stop watching.
      await new Promise((r) => setTimeout(r, 8000));
      sub.remove();

      // If accuracy is still poor (e.g. indoors / Wi‑Fi), we keep the best we have but warn via label fallback.
      const finalCoords = { latitude: best.latitude, longitude: best.longitude };
      setLocation(finalCoords);

      // If inside office geofence, always label as company name (even if GPS drifts a bit)
      const d = distanceMeters(finalCoords, OFFICE_COORD);
      if (d <= OFFICE_RADIUS_METERS) {
        setLocationLabel('TDT PowerSteel Corp.');
        return;
      }

      // Otherwise reverse-geocode for a readable place name
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: finalCoords.latitude,
          longitude: finalCoords.longitude,
        });
        if (results && results.length > 0) {
          const g = results[0];
          const pieces = [g.name, g.street, g.subregion || g.city].filter(Boolean);
          if (pieces.length > 0) setLocationLabel(pieces.join(', '));
        }
      } catch {
        // ignore reverse‑geocode failures
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Could not get location');
    }
  }, []);

  useEffect(() => {
    if (isClockedIn) {
      fetchLocation();
    } else {
      setLocation(null);
      setLocationError(null);
    }
  }, [isClockedIn, fetchLocation]);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = currentTime.toDateString();

  const validateQrForCurrentUser = async (qrData: string): Promise<boolean> => {
    const storedUsername = await AsyncStorage.getItem('username');
    if (!storedUsername) {
      throw new Error('User not logged in (missing username). Please log in again.');
    }
    const marker = `USER:${storedUsername}|`;
    return qrData.includes(marker);
  };

  const handleBarcodeScanned = async (event: any) => {
    if (qrVerified || isVerifying) return;
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
          'Look at the camera and press CLOCK IN to verify your face and record your attendance.',
          ''
        );
      } else {
        setQrVerified(false);
        setLastScannedQr(data);
        showModal(
          'error',
          'Invalid QR Code',
          'This QR code does not match your account.',
          'Please use the QR code that was generated for your account.'
        );
      }
    } catch (e: any) {
      setQrVerified(false);
      showModal(
        'error',
        'QR Validation Error',
        e?.message || 'Could not validate QR code. Please try again.',
        ''
      );
    }
  };

  const verifyFace = async (photoUri: string) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) throw new Error('Missing backend URL');
    
    let userId = null;
    try {
      userId = await AsyncStorage.getItem('userId');
    } catch (e) {
      console.log('Could not get userId from storage');
    }
    if (!userId) {
      throw new Error('User not logged in (missing userId). Please log in again.');
    }
    
    const form = new FormData();
    form.append('photo', {
      uri: photoUri,
      name: 'selfie.jpg',
      type: 'image/jpeg',
    } as any);
    form.append('clock_time', formattedTime);
    form.append('user_id', userId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s: enough for Face++ over ngrok, fail fast if unreachable

      const response = await fetch(`${backendUrl}/verify.php`, {
        method: 'POST',
        body: form,
        headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Get response text first to handle both JSON and non-JSON responses
      const responseText = await response.text();
      
      let json: any = {};
      try {
        json = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('[Verify] JSON parse error:', parseError);
        console.error('[Verify] Response was:', responseText);
        throw new Error(`Server returned invalid response. Status: ${response.status}\n\nResponse: ${responseText.substring(0, 200)}`);
      }
      
      // Handle 401 (face verification failed) as a validation result, not an error
      if (response.status === 401 && json.message) {
        // This is an expected validation failure (wrong face, poor lighting, etc.)
        // Return the result without throwing an error
        return {
          ok: false,
          verified: false,
          message: json.message,
          hint: json.hint,
          match_score: json.match_score,
          threshold: json.threshold
        };
      }
      
      // Handle other error responses
      if (!response.ok || !json.ok) {
        // Unexpected server errors (500, etc.)
        let errorMsg = json.message || 'Verification failed';
        if (json.detail) errorMsg += `\n\nDetail: ${json.detail}`;
        if (json.hint) errorMsg += `\n\n${json.hint}`;
        throw new Error(errorMsg);
      }
      
      return json;
    } catch (error: any) {
      // Better error handling for network issues
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error(`Request timed out.\n\nTry:\n1. Use same WiFi as PC and ensure PHP is running\n2. Or start ngrok on PC (ngrok http 8000), then reopen this screen and try again`);
      }
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        throw new Error(`Cannot connect to server.\n\nStart PHP + ngrok on PC, or use same WiFi and open this screen again.`);
      }
      throw error;
    }
  };

  const runVerification = async () => {
    if (!cameraRef.current) throw new Error('Camera not ready');
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.5,
      skipProcessing: true,
      base64: false,
    });
    if (!photo?.uri) throw new Error('No image captured');
    return verifyFace(photo.uri);
  };

  const recordAttendance = async (action: 'clock_in' | 'clock_out') => {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) return;
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/record_attendance.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ user_id: userId, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.warn('[Attendance] record_attendance failed:', data.message || res.status);
    }
  };

  const handleAttendance = async () => {
    if (isClockedIn) {
        try {
          await recordAttendance('clock_out');
        } catch (e) {
          console.warn('Clock-out record failed:', e);
        }
        setIsClockedIn(false);
        setClockInTime("");
        await AsyncStorage.removeItem('userClockInTime');
        showModal('success', '👋 Goodbye', 'Clocked out successfully.', '');
        setTimeout(() => router.back(), 1500);
        return;
    }

    if (!qrVerified) {
        showModal(
          'warning',
          'Scan QR Code First',
          'Please scan your personal QR code before clocking in.',
          'Hold your printed QR card in front of the camera until it is detected.'
        );
        return;
    }

    if (!permission?.granted) {
        showModal('warning', '📷 Camera Required', 'Please allow camera access to verify your identity.', '');
        return;
    }

    setIsVerifying(true);
    try {
        const result = await runVerification();
        
        // Check if verification was successful
        if (result?.ok === true) {
          try {
            await recordAttendance('clock_in');
          } catch (e) {
            console.warn('Clock-in record failed:', e);
          }
          setClockInTime(formattedTime);
          setIsClockedIn(true);
          await AsyncStorage.setItem('userClockInTime', formattedTime);
          showModal('success', '✅ Face Verified!', result?.message || "Face match success. You are clocked in.", '');
        } else if (result?.verified === false) {
          // Validation failed (wrong face, poor lighting, etc.) - This is expected, not an error
          const message = result?.message || "Face verification failed";
          const hint = result?.hint || "Please try again";
          showModal('error', '❌ Verification Failed', message, hint);
        } else {
          // Unexpected response format
          showModal('error', 'Verification Failed', 'Please try again.', '');
        }
    } catch (e: any) {
        // Only log actual errors (network issues, server errors, etc.)
        console.error('Verification error:', e);
        const errorMessage = e?.message || "Please try again.";
        showModal('error', 'Connection Error', errorMessage, 'Check your internet connection');
    } finally {
        setIsVerifying(false);
    }
  };

  const showModal = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string, hint: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalHint(hint);
    setShowResultModal(true);
    
    // Animate modal entrance
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
    });
  };

  if (isLoading || !permission) return <View style={[styles.loadingContainer, dyn.bg]}><ActivityIndicator size="large" color="#F27121" /></View>;
  if (!permission.granted) return <View style={[styles.loadingContainer, dyn.bg]}><Text style={dyn.text}>Camera access needed.</Text></View>;

  const isInOffice =
    !!location && distanceMeters(location, OFFICE_COORD) <= OFFICE_RADIUS_METERS;
  const mapCoord = location
    ? (isInOffice ? OFFICE_COORD : location)
    : null;

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 10}}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Attendance</Text>
        <View style={{width: 44}} />
      </View>

      {/* CENTER */}
      <View style={[styles.centerStage, !isClockedIn && styles.centerStageCentered]}>
        {isClockedIn ? (
          <ScrollView
            style={styles.clockedInScroll}
            contentContainerStyle={styles.clockedInScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status card */}
            <View style={[styles.statusCard, dyn.card]}>
              <View style={styles.statusIconWrapper}>
                <MaterialCommunityIcons name="shield-check" size={64} color="#2ecc71" />
              </View>
              <Text style={styles.statusTitle}>YOU ARE CLOCKED IN</Text>
              <Text style={[styles.statusTime, dyn.text]}>{clockInTime}</Text>
              {locationLabel && (
                <Text style={[styles.statusLocation, dyn.sub]}>
                  You are clocked in at {locationLabel}
                </Text>
              )}
            </View>

            {/* Map card */}
            <View style={[styles.mapCard, dyn.card]}>
              <View style={styles.mapCardHeader}>
                <Ionicons name="location" size={20} color="#F27121" />
                <Text style={[styles.mapCardTitle, dyn.text]}>Your Location</Text>
              </View>
              {mapCoord ? (
                <View style={styles.mapWrapper}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: mapCoord.latitude,
                      longitude: mapCoord.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                  >
                    <Marker
                      coordinate={mapCoord}
                      title={locationLabel || 'Clock‑in location'}
                    />
                  </MapView>
                </View>
              ) : locationError ? (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="location-outline" size={40} color={colors.subText} />
                  <Text style={[styles.mapPlaceholderText, dyn.sub]}>{locationError}</Text>
                  <TouchableOpacity style={styles.retryLocationButton} onPress={fetchLocation}>
                    <Text style={styles.retryLocationText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator size="small" color="#F27121" />
                  <Text style={[styles.mapPlaceholderText, dyn.sub]}>Getting location...</Text>
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] as any }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.cameraOverlay}>
              {isVerifying ? (
                <View style={styles.verifyingContainer}>
                  <ActivityIndicator size="large" color="#F27121" />
                  <Text style={styles.verifyingText}>Verifying face...</Text>
                </View>
              ) : (
                <View style={styles.faceFrame} />
              )}
            </View>
          </View>
        )}
      </View>

      {/* FOOTER */}
      <View style={[styles.footer, dyn.footer]}>
        {!isClockedIn && (
          <View style={styles.requirementSteps}>
            <View style={[styles.stepRow, qrVerified && styles.stepDone]}>
              <Ionicons name={qrVerified ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={qrVerified ? '#2ecc71' : colors.subText} />
              <Text style={[styles.stepText, dyn.sub]}>QR Code 1/2</Text>
            </View>
            <View style={[styles.stepRow, isClockedIn && styles.stepDone]}>
              {isVerifying ? (
                <ActivityIndicator size="small" color="#F27121" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name={isClockedIn ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isClockedIn ? '#2ecc71' : colors.subText} />
              )}
              <Text style={[styles.stepText, dyn.sub]}>Face Recognition 2/2</Text>
            </View>
          </View>
        )}
        <View style={styles.footerTimeBlock}>
          <Text style={[styles.footerDate, dyn.sub]}>{formattedDate}</Text>
          <Text style={[styles.footerTime, dyn.text]}>{formattedTime}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.bigButton,
            { backgroundColor: isClockedIn ? '#C0392B' : '#F27121', opacity: isVerifying ? 0.7 : 1 },
          ]}
          onPress={handleAttendance}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialCommunityIcons name={isClockedIn ? 'logout' : 'face-recognition'} size={28} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.buttonText}>{isClockedIn ? 'CLOCK OUT' : 'CLOCK IN'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* CUSTOM RESULT MODAL */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[
            styles.modalContainer,
            { 
              transform: [{ scale: scaleAnim }],
              backgroundColor: colors.card
            }
          ]}>
            {/* Icon */}
            <View style={[
              styles.modalIconContainer,
              { backgroundColor: modalType === 'success' ? '#d4edda' : modalType === 'warning' ? '#fff3cd' : modalType === 'info' ? '#d1ecf1' : '#f8d7da' }
            ]}>
              {modalType === 'success' ? (
                <Ionicons name="checkmark-circle" size={80} color="#28a745" />
              ) : modalType === 'warning' ? (
                <Ionicons name="warning" size={80} color="#ffc107" />
              ) : modalType === 'info' ? (
                <Ionicons name="information-circle" size={80} color="#17a2b8" />
              ) : (
                <MaterialCommunityIcons name="face-recognition" size={80} color="#dc3545" />
              )}
            </View>

            {/* Title */}
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {modalTitle}
            </Text>

            {/* Message */}
            <Text style={[styles.modalMessage, { color: colors.subText }]}>
              {modalMessage}
            </Text>

            {/* Hint */}
            {modalHint ? (
              <View style={styles.modalHintContainer}>
                <Ionicons name="information-circle" size={20} color="#17a2b8" />
                <Text style={styles.modalHint}>{modalHint}</Text>
              </View>
            ) : null}

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.modalButton, { 
                backgroundColor: modalType === 'success' ? '#28a745' : modalType === 'warning' ? '#ffc107' : modalType === 'info' ? '#17a2b8' : '#dc3545'
              }]}
              onPress={closeModal}
            >
              <Text style={styles.modalButtonText}>
                {modalType === 'success' ? 'Great!' : modalType === 'warning' ? 'Got it' : modalType === 'info' ? 'OK' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const MAP_HEIGHT = 200;

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  centerStage: { flex: 1, minHeight: 0 },
  centerStageCentered: { justifyContent: 'center', alignItems: 'center' },
  clockedInScroll: { flex: 1 },
  clockedInScrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 24 },
  cameraWrapper: { width: width * 0.7, height: width * 0.7, borderRadius: (width * 0.7) / 2, overflow: 'hidden', borderWidth: 4, borderColor: '#F27121', backgroundColor: 'black', alignSelf: 'center' },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  faceFrame: { width: '85%', height: '85%', borderRadius: 200, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed' },
  verifyingContainer: { backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 10 },
  verifyingText: { color: 'white', marginTop: 10, fontWeight: 'bold' },
  statusCard: { alignItems: 'center', padding: 24, borderRadius: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  statusIconWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(46, 204, 113, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statusTitle: { color: '#2ecc71', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  statusTime: { fontSize: 44, fontWeight: 'bold', marginTop: 8 },
  statusLocation: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  mapCard: { borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  mapCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10, gap: 8 },
  mapCardTitle: { fontSize: 16, fontWeight: '700' },
  mapWrapper: { height: MAP_HEIGHT, width: '100%' },
  map: { flex: 1, width: '100%', height: MAP_HEIGHT, ...(Platform.OS === 'android' ? { borderRadius: 12 } : {}) },
  mapPlaceholder: { height: MAP_HEIGHT, justifyContent: 'center', alignItems: 'center', padding: 20 },
  mapPlaceholderText: { marginTop: 8, fontSize: 13, textAlign: 'center' },
  retryLocationButton: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#F27121', borderRadius: 10 },
  retryLocationText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  footer: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  footerTimeBlock: { alignItems: 'center', marginBottom: 20 },
  footerDate: { fontSize: 13 },
  requirementSteps: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  stepDone: { opacity: 1 },
  stepText: { fontSize: 13, marginLeft: 6, fontWeight: '600' },
  footerTime: { fontSize: 40, fontWeight: 'bold' },
  bigButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20, borderRadius: 15 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 24,
  },
  modalHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  modalHint: {
    fontSize: 14,
    color: '#0c5460',
    marginLeft: 8,
    flex: 1,
  },
  modalButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});