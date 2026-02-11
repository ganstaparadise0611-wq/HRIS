import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// Backend configuration
// Update this to your PHP backend URL (e.g., http://localhost:8000 or your deployed URL)
const PHP_BACKEND_URL = 'http://192.168.15.229:8000'; // Your computer's IP address

// Supabase configuration (for direct API calls if needed)
const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

export default function UserLogin() {
  const router = useRouter();
  const [keepLogged, setKeepLogged] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const cameraRef = useRef<any>(null);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Missing information', 'Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);

      // Use PHP backend login endpoint
      const response = await fetch(`${PHP_BACKEND_URL}/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const result = await response.json();
      
      console.log('[Login] Response:', result);

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Login failed');
      }

      // Store user info in AsyncStorage
      await AsyncStorage.setItem('userId', result.user.log_id.toString());
      await AsyncStorage.setItem('username', result.user.username);
      
      console.log('[Login] Stored userId in AsyncStorage:', result.user.log_id.toString());
      
      Alert.alert('Success', 'Login successful!');

      router.push('/userdashboard');
    } catch (error: any) {
      Alert.alert('Login error', error.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!username || !password) {
      Alert.alert('Missing information', 'Please enter username and password.');
      return;
    }

    if (!capturedImage) {
      Alert.alert('Missing information', 'Please capture your face for verification.');
      return;
    }

    try {
      setLoading(true);

      // Use the base64 data captured from camera
      if (!capturedBase64) {
        throw new Error('Face data not available. Please capture your face again.');
      }

      // Generate QR code based on face data (unique hash)
      // Create a unique identifier combining username, timestamp, and face hash
      const timestamp = Date.now();
      const faceHash = generateFaceHash(capturedBase64);
      const qrCodeData = `USER:${username}|HASH:${faceHash}|TIME:${timestamp}`;

      console.log('Creating account with data:', {
        username,
        hasPassword: !!password,
        faceDataLength: capturedBase64.length,
        qrCodeLength: qrCodeData.length,
        backendUrl: PHP_BACKEND_URL,
      });

      // Create new account via PHP backend
      console.log('Attempting to connect to:', `${PHP_BACKEND_URL}/signup.php`);
      
      const response = await fetch(`${PHP_BACKEND_URL}/signup.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username,
          password, // Backend can handle password hashing
          face: capturedBase64, // Store face image as base64
          qr_code: qrCodeData, // Store QR code based on face
        }),
      });

      // Get response text first to handle non-JSON responses
      const responseText = await response.text();
      console.log('Response text:', responseText.substring(0, 200)); // Log first 200 chars
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response was:', responseText);
        throw new Error('Server returned invalid response. Please check PHP backend.');
      }

      if (!response.ok || !result.ok) {
        console.error('Server error:', result);
        console.error('Response status:', response.status);
        throw new Error(result.message || 'Failed to create account.');
      }

      console.log('Account created successfully:', result);

      Alert.alert('Success', 'Account created successfully! Your QR code has been generated based on your face data.');
      
      // Reset form and switch to login mode
      setIsSignUp(false);
      setCapturedImage(null);
      setCapturedBase64(null);
      setPassword('');
    } catch (error: any) {
      console.error('Sign up error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      
      let errorMsg = 'Unable to create account. Please try again.';
      
      if (error.message === 'Network request failed') {
        errorMsg = `Cannot connect to server at ${PHP_BACKEND_URL}\n\nMake sure:\n1. PHP server is running\n2. Your device is connected to the same WiFi\n3. Firewall allows port 8000`;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      Alert.alert('Sign up error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Generate a hash from face data for QR code
  const generateFaceHash = (base64Data: string): string => {
    // Simple hash function using the face data
    let hash = 0;
    const dataSubset = base64Data.substring(0, 1000); // Use first 1000 chars for hash
    
    for (let i = 0; i < dataSubset.length; i++) {
      const char = dataSubset.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36).toUpperCase();
  };

  const requestCameraPermission = async () => {
    // Show validation message before opening camera
    Alert.alert(
      'Face Capture Guidelines',
      '⚠️ IMPORTANT:\n\n• Remove eyeglasses\n• Remove face masks\n• Remove hats or caps\n• Ensure good lighting\n• Look directly at camera\n\nYour face must be clearly visible for verification.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Proceed',
          onPress: async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
            if (status === 'granted') {
              setShowCamera(true);
            } else {
              Alert.alert('Permission Denied', 'Camera permission is required for face capture.');
            }
          },
        },
      ]
    );
  };

  const captureFace = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.3,
          base64: true,
          skipProcessing: true, // Skip processing for faster capture and no sound on some devices
        });
        setCapturedImage(photo.uri);
        setCapturedBase64(photo.base64 || null);
        setShowCamera(false);
        
        // Debug: Check if base64 was captured
        if (photo.base64) {
          console.log('Base64 captured, length:', photo.base64.length);
          Alert.alert('Success', 'Face captured successfully!');
        } else {
          console.error('No base64 data in photo');
          Alert.alert('Warning', 'Face captured but data may be incomplete. Try again if sign-up fails.');
        }
      } catch (error) {
        console.error('Capture error:', error);
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setUsername('');
    setPassword('');
    setCapturedImage(null);
    setCapturedBase64(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        
        {/* LOGO AREA */}
        <View style={styles.logoContainer}>
          <View style={styles.logoTextContainer}>
             <Text style={styles.logoTDT}>TDT</Text>
             <Text style={styles.logoPowersteel}>POWERSTEEL</Text>
          </View>
          <Text style={styles.tagline}>THE NO.1 STEEL SUPPLIER</Text>
        </View>

        {/* LOGIN FORM */}
        <View style={styles.formContainer}>
          
          <Text style={styles.headerTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
          <Text style={styles.headerSubtitle}>
            {isSignUp ? 'Sign up to access HR Portal' : 'Sign in to access HR Portal'}
          </Text>

          <Text style={styles.label}>Username / Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter your username"
            placeholderTextColor="#666"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput 
              style={styles.passwordInput} 
              placeholder="Enter your password"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword} 
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeIconText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {/* FACE CAPTURE SECTION - Only show in Sign Up mode */}
          {isSignUp && (
            <View style={styles.faceSection}>
              <Text style={styles.label}>Face Recognition</Text>
              <TouchableOpacity 
                style={styles.captureButton}
                onPress={requestCameraPermission}
              >
                <Text style={styles.captureButtonText}>
                  {capturedImage ? '✓ Face Captured' : '📷 Capture Face'}
                </Text>
              </TouchableOpacity>
              
              {capturedImage && (
                <View style={styles.imagePreview}>
                  <Image 
                    source={{ uri: capturedImage }} 
                    style={styles.previewImage}
                  />
                  <TouchableOpacity 
                    style={styles.retakeButton}
                    onPress={requestCameraPermission}
                  >
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Show Keep Logged In and Forgot Password only in Login mode */}
          {!isSignUp && (
            <View style={styles.toggleContainer}>
              <View style={styles.switchWrapper}>
                <Switch 
                  trackColor={{ false: "#555", true: "#F27121" }} 
                  thumbColor={keepLogged ? "#fff" : "#ccc"}
                  onValueChange={() => setKeepLogged(!keepLogged)}
                  value={keepLogged}
                />
                <Text style={styles.toggleText}>Keep me logged in</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* LOGIN/SIGNUP BUTTON */}
          <TouchableOpacity 
            style={[styles.loginButton, isSignUp && { marginTop: 20 }]} 
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? (isSignUp ? 'CREATING ACCOUNT...' : 'LOGGING IN...') : (isSignUp ? 'SIGN UP' : 'LOGIN')}
            </Text>
          </TouchableOpacity>

          {/* Toggle between Login and Sign Up */}
          <View style={styles.switchModeContainer}>
            <Text style={styles.switchModeText}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <TouchableOpacity onPress={toggleMode}>
              <Text style={styles.switchModeLink}>
                {isSignUp ? ' Sign In' : ' Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Camera Modal */}
        <Modal
          visible={showCamera}
          animationType="slide"
          transparent={false}
        >
          <View style={styles.cameraContainer}>
            {hasPermission === false ? (
              <View style={styles.permissionDenied}>
                <Text style={styles.permissionText}>Camera permission denied</Text>
              </View>
            ) : (
              <>
                <CameraView 
                  ref={cameraRef}
                  style={styles.camera}
                  facing="front"
                />
                <View style={styles.cameraControls}>
                  <TouchableOpacity 
                    style={styles.capturePhotoButton}
                    onPress={captureFace}
                  >
                    <Text style={styles.capturePhotoText}>Capture</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setShowCamera(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Modal>

        <View style={styles.footer}>
          <Text style={styles.footerText}>We Empower Development</Text>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 50 },
  logoTextContainer: { flexDirection: 'row', alignItems: 'center' },
  logoTDT: { color: '#D3D3D3', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  logoPowersteel: { color: '#F27121', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: '#888', fontSize: 12, marginTop: 5, letterSpacing: 2, fontWeight: '600', textTransform: 'uppercase' },
  formContainer: { width: '100%', backgroundColor: '#252525', padding: 25, borderRadius: 15, elevation: 8 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  headerSubtitle: { color: '#888', fontSize: 14, marginBottom: 25 },
  label: { color: '#ccc', fontWeight: '600', marginBottom: 8, marginTop: 10, fontSize: 14 },
  input: { height: 55, backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 15, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#333' },
  passwordContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    height: 55, 
    backgroundColor: '#1A1A1A', 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#333',
    paddingHorizontal: 15,
  },
  passwordInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#fff',
    height: '100%',
  },
  eyeIcon: { 
    padding: 5,
    marginLeft: 10,
  },
  eyeIconText: { 
    fontSize: 13,
    color: '#F27121',
    fontWeight: '600',
  },
  toggleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 25 },
  switchWrapper: { flexDirection: 'row', alignItems: 'center' },
  toggleText: { marginLeft: 8, color: '#ccc', fontSize: 13 },
  loginButton: { backgroundColor: '#F27121', height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: "#F27121", shadowOpacity: 0.4, shadowRadius: 5, elevation: 5 },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  forgotPassword: { color: '#F27121', fontSize: 13, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center', alignSelf: 'center' },
  footerText: { color: '#555', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  // New styles for Sign Up and Face Capture
  faceSection: { marginTop: 10 },
  captureButton: { 
    backgroundColor: '#333', 
    height: 50, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F27121',
    marginTop: 5,
  },
  captureButtonText: { color: '#F27121', fontSize: 16, fontWeight: '600' },
  imagePreview: { 
    marginTop: 15, 
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 10,
    borderRadius: 8,
  },
  previewImage: { 
    width: 150, 
    height: 150, 
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#F27121',
  },
  retakeButton: { 
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F27121',
    borderRadius: 5,
  },
  retakeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  switchModeContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginTop: 20,
  },
  switchModeText: { color: '#888', fontSize: 14 },
  switchModeLink: { color: '#F27121', fontSize: 14, fontWeight: 'bold' },
  
  // Camera Modal Styles
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  permissionDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  permissionText: { color: '#fff', fontSize: 18 },
  cameraControls: { 
    position: 'absolute', 
    bottom: 40, 
    width: '100%', 
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  capturePhotoButton: { 
    backgroundColor: '#F27121', 
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    elevation: 5,
  },
  capturePhotoText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelButton: { 
    backgroundColor: '#555', 
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
  },
  cancelButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});