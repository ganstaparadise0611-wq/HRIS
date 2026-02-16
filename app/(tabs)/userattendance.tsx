import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PHP_BACKEND_URL } from '../../constants/backend-config';
import { useTheme } from './ThemeContext'; // <--- IMPORT HOOK

const { width } = Dimensions.get('window');

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
  
  // Modal states
  const [showResultModal, setShowResultModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'info'>('success');
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalHint, setModalHint] = useState("");
  const scaleAnim = useRef(new Animated.Value(0)).current;

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

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = currentTime.toDateString();

  const verifyFace = async (photoUri: string) => {
    if (!PHP_BACKEND_URL) throw new Error('Missing backend URL');
    
    // Get logged-in user ID from AsyncStorage for fallback matching
    let userId = null;
    try {
      userId = await AsyncStorage.getItem('userId');
    } catch (e) {
      console.log('Could not get userId from storage');
    }
    
    const form = new FormData();
    form.append('photo', {
      uri: photoUri,
      name: 'selfie.jpg',
      type: 'image/jpeg',
    } as any);
    form.append('clock_time', formattedTime);
    if (userId) {
      form.append('user_id', userId);
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout (increased for face comparison)

      const response = await fetch(`${PHP_BACKEND_URL}/verify.php`, {
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
        throw new Error(errorMsg);
      }
      
      return json;
    } catch (error: any) {
      // Better error handling for network issues
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        throw new Error(`Request timed out. The server might be slow or unreachable.\n\nCheck:\n1. PHP server is running at ${PHP_BACKEND_URL}\n2. Your device is on the same WiFi\n3. Try again in a moment`);
      }
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        throw new Error(`Cannot connect to server at ${PHP_BACKEND_URL}\n\nMake sure:\n1. PHP server is running\n2. Your device is on the same WiFi\n3. Firewall allows port 8000`);
      }
      throw error;
    }
  };

  const runVerification = async () => {
    if (!cameraRef.current) throw new Error('Camera not ready');
    // Use same quality as signup (0.7) for better face recognition accuracy
    const photo = await cameraRef.current.takePictureAsync({ 
      quality: 0.7, // Increased from 0.6 to match signup quality
      skipProcessing: false, // Enable processing for better image quality
      base64: false // Not needed for verification, saves memory
    });
    if (!photo?.uri) throw new Error('No image captured');
    return verifyFace(photo.uri);
  };

  const handleAttendance = async () => {
    if (isClockedIn) {
        setIsClockedIn(false);
        setClockInTime("");
        await AsyncStorage.removeItem('userClockInTime');
        Alert.alert("Goodbye", "Clocked out successfully.");
        setTimeout(() => router.back(), 500);
        return;
    }

    if (!permission?.granted) {
        Alert.alert("Camera required", "Please allow camera access to verify.");
        return;
    }

    setIsVerifying(true);
    try {
        const result = await runVerification();
        
        // Check if verification was successful
        if (result?.ok === true) {
          // Success - face recognized
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

  const showModal = (type: 'success' | 'error' | 'info', title: string, message: string, hint: string) => {
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
      <View style={styles.centerStage}>
        {isClockedIn ? (
            <View style={styles.statusBox}>
                <MaterialCommunityIcons name="shield-check" size={80} color="#2ecc71" />
                <Text style={styles.statusTitle}>YOU ARE CLOCKED IN</Text>
                <Text style={[styles.statusTime, dyn.text]}>{clockInTime}</Text>
            </View>
        ) : (
            <View style={styles.cameraWrapper}>
                <CameraView ref={cameraRef} style={styles.camera} facing="front" />
                <View style={styles.cameraOverlay}>
                    {isVerifying ? (
                        <View style={styles.verifyingContainer}>
                            <ActivityIndicator size="large" color="#F27121" />
                            <Text style={styles.verifyingText}>Verifying Face...</Text>
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
        <View style={{alignItems: 'center', marginBottom: 20}}>
            <Text style={dyn.sub}>{formattedDate}</Text>
            <Text style={[styles.footerTime, dyn.text]}>{formattedTime}</Text>
        </View>

        <TouchableOpacity 
            style={[styles.bigButton, { backgroundColor: isClockedIn ? '#C0392B' : '#F27121', opacity: isVerifying ? 0.7 : 1 }]}
            onPress={handleAttendance}
            disabled={isVerifying}
        >
            {isVerifying ? (
                <ActivityIndicator color="white" />
            ) : (
                <>
                    <MaterialCommunityIcons name={isClockedIn ? "logout" : "face-recognition"} size={28} color="white" style={{marginRight: 10}} />
                    <Text style={styles.buttonText}>{isClockedIn ? "CLOCK OUT" : "CLOCK IN"}</Text>
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
              { backgroundColor: modalType === 'success' ? '#d4edda' : '#f8d7da' }
            ]}>
              {modalType === 'success' ? (
                <Ionicons name="checkmark-circle" size={80} color="#28a745" />
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
                backgroundColor: modalType === 'success' ? '#28a745' : '#F27121'
              }]}
              onPress={closeModal}
            >
              <Text style={styles.modalButtonText}>
                {modalType === 'success' ? 'Great!' : 'Try Again'}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  centerStage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraWrapper: { width: width * 0.7, height: width * 0.7, borderRadius: (width * 0.7) / 2, overflow: 'hidden', borderWidth: 4, borderColor: '#F27121', backgroundColor: 'black' },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  faceFrame: { width: '85%', height: '85%', borderRadius: 200, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed' },
  verifyingContainer: { backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 10 },
  verifyingText: { color: 'white', marginTop: 10, fontWeight: 'bold' },
  statusBox: { alignItems: 'center' },
  statusTitle: { color: '#2ecc71', fontSize: 18, fontWeight: 'bold', marginTop: 15, letterSpacing: 1 },
  statusTime: { fontSize: 48, fontWeight: 'bold' },
  footer: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
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