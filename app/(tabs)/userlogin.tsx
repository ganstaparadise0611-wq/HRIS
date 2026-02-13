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
const PHP_BACKEND_URL = 'http://192.168.15.132:8000';// Your computer's IP address

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

  // Test server connectivity - try to reach the server with a quick test
  const testServerConnection = async (): Promise<{ success: boolean; workingUrl?: string }> => {
    const testUrls = [
      `${PHP_BACKEND_URL}/login.php`,
      `${PHP_BACKEND_URL}/public/login.php`,
    ];

    for (const url of testUrls) {
      try {
        console.log('[Connection Test] Testing:', url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for quick test
        
        // Try a simple POST request (login.php expects POST)
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ test: true }), // Minimal test payload
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // If we get any response (even error), server is reachable
        // Status 0 usually means network error, any other status means server responded
        if (response.status !== 0) {
          console.log('[Connection Test] ✅ Server reachable at:', url, 'Status:', response.status);
          return { success: true, workingUrl: url };
        }
      } catch (error: any) {
        // AbortError means timeout - server not reachable
        if (error.name === 'AbortError') {
          console.log('[Connection Test] ⏱️ Timeout for:', url);
        } else {
          console.log('[Connection Test] ❌ Failed for:', url, error.message);
        }
        // Continue to next URL
      }
    }
    
    console.log('[Connection Test] ❌ Server not reachable at any URL');
    return { success: false };
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Missing information', 'Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);

      // Quick connection test first
      console.log('[Login] Testing server connection...');
      const connectionTest = await testServerConnection();
      
      if (!connectionTest.success) {
        throw new Error(`❌ Cannot reach server at ${PHP_BACKEND_URL}\n\n🔧 Quick Fix:\n1. Start PHP server:\n   cd backend-php\\public\n   php -S 192.168.15.132:8000\n\n2. Check server is running:\n   Open browser: ${PHP_BACKEND_URL}/login.php\n\n3. Network check:\n   • Same WiFi network?\n   • Firewall blocking port 8000?\n   • IP address correct?`);
      }

      // Try with /public path first, then without
      const tryLogin = async (url: string) => {
        try {
          console.log('[Login] Attempting login at:', url);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: username,
              password: password,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok && response.status === 404) {
            console.log('[Login] 404 - trying next URL');
            return null; // Try next URL
          }

          const result = await response.json();
          console.log('[Login] Response received', result);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/37a6dd6b-c237-44c3-9a89-9449c8082df1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userlogin.tsx:133',message:'Frontend received response',data:{status:response.status,ok:response.ok,result_ok:result.ok,result_message:result.message,has_user:!!result.user,log_id:result.user?.log_id},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion

          if (!response.ok || !result.ok) {
            throw new Error(result.message || 'Login failed');
          }

          return result;
        } catch (error: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/37a6dd6b-c237-44c3-9a89-9449c8082df1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'userlogin.tsx:141',message:'Frontend login error',data:{url:url,error_name:error.name,error_message:error.message,error_stack:error.stack?.substring(0,200)},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Handle network errors - return null to try next URL
          if (error.name === 'AbortError') {
            console.log('[Login] Timeout for:', url, '- trying next URL');
            return null; // Try next URL instead of throwing
          }
          if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
            console.log('[Login] Network error for:', url, '- trying next URL');
            return null; // Try next URL
          }
          // Only throw errors that are actual login failures (not connection issues)
          if (error.message && !error.message.includes('timeout') && !error.message.includes('Network')) {
            throw error;
          }
          // For timeout/network errors, try next URL
          return null;
        }
      };

      // Try /public/login.php first
      let result = await tryLogin(`${PHP_BACKEND_URL}/public/login.php`);
      
      // If failed, try /login.php
      if (!result) {
        console.log('[Login] Trying without /public path');
        result = await tryLogin(`${PHP_BACKEND_URL}/login.php`);
      }

      if (!result) {
        throw new Error(`Login request timed out.\n\nServer is reachable but not responding.\n\nTry:\n1. Check PHP error logs\n2. Restart PHP server\n3. Verify login.php file exists`);
      }

      // Store user info in AsyncStorage
      await AsyncStorage.setItem('userId', result.user.log_id.toString());
      await AsyncStorage.setItem('username', result.user.username);
      
      console.log('[Login] Stored userId in AsyncStorage:', result.user.log_id.toString());
      
      Alert.alert('Success', 'Login successful!');

      router.push('/userdashboard');
    } catch (error: any) {
      console.error('[Login] Error:', error);
      let errorMsg = error.message || 'Unable to log in. Please try again.';
      
      // Provide more helpful error messages
      if (error.message?.includes('Cannot reach server') || error.message?.includes('❌')) {
        errorMsg = error.message; // Already has troubleshooting info
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMsg = `⏱️ Request timed out.\n\nServer at ${PHP_BACKEND_URL} is not responding.\n\n🔧 Check:\n1. PHP server is running:\n   cd backend-php\\public\n   php -S 192.168.15.132:8000\n\n2. Test in browser:\n   ${PHP_BACKEND_URL}/login.php\n\n3. Network:\n   • Same WiFi?\n   • Firewall allows port 8000?`;
      } else if (error.message?.includes('Cannot connect') || error.message?.includes('Network')) {
        errorMsg = error.message; // Already has troubleshooting info
      }
      
      Alert.alert('Login Error', errorMsg);
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

      // Quick connection test first
      console.log('[Signup] Testing server connection...');
      const connectionTest = await testServerConnection();
      
      if (!connectionTest.success) {
        throw new Error(`❌ Cannot reach server at ${PHP_BACKEND_URL}\n\n🔧 Quick Fix:\n1. Start PHP server:\n   cd backend-php\\public\n   php -S 192.168.15.132:8000\n\n2. Check server is running:\n   Open browser: ${PHP_BACKEND_URL}/signup.php\n\n3. Network check:\n   • Same WiFi network?\n   • Firewall blocking port 8000?\n   • IP address correct?`);
      }

      // Create new account via PHP backend
      // Try with /public path first, then without
      const trySignup = async (url: string) => {
        try {
          console.log('[Signup] Attempting to connect to:', url);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout for signup
          
          const response = await fetch(url, {
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
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok && response.status === 404) {
            console.log('[Signup] 404 - trying next URL');
            return null; // Try next URL
          }

          return response;
        } catch (error: any) {
          // Handle network errors - return null to try next URL
          if (error.name === 'AbortError') {
            console.log('[Signup] Timeout for:', url, '- trying next URL');
            return null; // Try next URL instead of throwing
          }
          if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
            console.log('[Signup] Network error for:', url, '- trying next URL');
            return null; // Try next URL
          }
          // Only throw errors that are actual signup failures (not connection issues)
          if (error.message && !error.message.includes('timeout') && !error.message.includes('Network')) {
            throw error;
          }
          // For timeout/network errors, try next URL
          return null;
        }
      };

      let response = await trySignup(`${PHP_BACKEND_URL}/public/signup.php`);
      
      // If failed, try /signup.php
      if (!response) {
        console.log('[Signup] Trying without /public path');
        response = await trySignup(`${PHP_BACKEND_URL}/signup.php`);
      }

      if (!response) {
        throw new Error(`Signup request timed out.\n\nServer is reachable but not responding.\n\nTry:\n1. Check PHP error logs\n2. Restart PHP server\n3. Verify signup.php file exists`);
      }

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
      
      let errorMsg = error.message || 'Unable to create account. Please try again.';
      
      // Provide more helpful error messages
      if (error.message?.includes('Cannot reach server') || error.message?.includes('❌')) {
        errorMsg = error.message; // Already has troubleshooting info
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out') || error.message?.includes('unreachable')) {
        errorMsg = `⏱️ Request timed out.\n\nServer at ${PHP_BACKEND_URL} is not responding.\n\n🔧 Check:\n1. PHP server is running:\n   cd backend-php\\public\n   php -S 192.168.15.132:8000\n\n2. Test in browser:\n   ${PHP_BACKEND_URL}/signup.php\n\n3. Network:\n   • Same WiFi?\n   • Firewall allows port 8000?`;
      } else if (error.message?.includes('Cannot connect') || error.message?.includes('Network')) {
        errorMsg = error.message; // Already has troubleshooting info
      }
      
      Alert.alert('Sign Up Error', errorMsg);
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