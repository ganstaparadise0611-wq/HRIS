import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import WheelPicker from 'react-native-wheely';

// Backend configuration
// Update this to your PHP backend URL (e.g., http://localhost:8000 or your deployed URL)
// Use environment variable if available, otherwise use current IP
const PHP_BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.15.20:8000'; // Your computer's IP address

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
  
  // Profile fields for signup
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [role, setRole] = useState('Employee');
  const [deptId, setDeptId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [departments, setDepartments] = useState<Array<{dept_id: number, name: string}>>([]);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  
  // Date picker states
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 25);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);
  const months = [
    { label: 'January', value: 1 }, { label: 'February', value: 2 }, { label: 'March', value: 3 },
    { label: 'April', value: 4 }, { label: 'May', value: 5 }, { label: 'June', value: 6 },
    { label: 'July', value: 7 }, { label: 'August', value: 8 }, { label: 'September', value: 9 },
    { label: 'October', value: 10 }, { label: 'November', value: 11 }, { label: 'December', value: 12 },
  ];
  
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
        throw new Error(`❌ Cannot reach server at ${PHP_BACKEND_URL}\n\n🔧 Quick Fix:\n1. Start PHP server:\n   cd backend-php\\public\n   php -S 0.0.0.0:8000\n\n2. Check server is running:\n   Open browser: ${PHP_BACKEND_URL}/login.php\n\n3. Network check:\n   • Same WiFi network?\n   • Firewall blocking port 8000?\n   • IP address correct?`);
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Use PHP backend login endpoint
      const response = await fetch(`${PHP_BACKEND_URL}/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let result;
      try {
        const text = await response.text();
        console.log('[Login] Response text:', text.substring(0, 500));
        result = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('[Login] Failed to parse response:', parseError);
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok || !result.ok) {
        // Include detail and hint in error message if available
        let errorMsg = result.message || 'Login failed';
        if (result.detail) {
          errorMsg += `\n\nDetail: ${result.detail}`;
        }
        if (result.hint) {
          errorMsg += `\n\n${result.hint}`;
        }
        throw new Error(errorMsg);
      }

      // Store user info in AsyncStorage
      await AsyncStorage.setItem('userId', result.user.log_id.toString());
      await AsyncStorage.setItem('username', result.user.username);
      
      console.log('[Login] Stored userId in AsyncStorage:', result.user.log_id.toString());
      
      Alert.alert('Success', 'Login successful!');

      router.push('/userdashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Better error handling for network issues
      let errorMessage = 'Unable to log in. Please try again.';
      
      if (error.message?.includes('Cannot reach server') || error.message?.includes('❌')) {
        errorMessage = error.message; // Already has troubleshooting info
      } else if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        errorMessage = `Request timed out after 30 seconds.\n\nPossible issues:\n1. PHP server is not running at ${PHP_BACKEND_URL}\n2. Your device is not on the same WiFi network\n3. Firewall is blocking port 8000\n4. Server is too slow to respond\n\nPlease check:\n- Is PHP server running? (Check terminal)\n- Is your phone on the same WiFi?\n- Try restarting the PHP server`;
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMessage = `Request timed out. The server might be slow or unreachable.\n\nCheck:\n1. PHP server is running at ${PHP_BACKEND_URL}\n2. Your device is on the same WiFi\n3. Try again in a moment`;
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = `Cannot connect to server at ${PHP_BACKEND_URL}\n\nMake sure:\n1. PHP server is running\n2. Your device is on the same WiFi\n3. Firewall allows port 8000`;
      } else if (error.message?.includes('Database connection error') || error.message?.includes('Database error')) {
        // Show detailed database error - detail and hint are already included in error.message from the try block
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Login error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!username || !password) {
      Alert.alert('Missing information', 'Please enter username and password.');
      return;
    }

    if (!name) {
      Alert.alert('Missing information', 'Please enter your full name.');
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
        throw new Error(`❌ Cannot reach server at ${PHP_BACKEND_URL}\n\n🔧 Quick Fix:\n1. Start PHP server:\n   cd backend-php\\public\n   php -S 0.0.0.0:8000\n\n2. Check server is running:\n   Open browser: ${PHP_BACKEND_URL}/signup.php\n\n3. Network check:\n   • Same WiFi network?\n   • Firewall blocking port 8000?\n   • IP address correct?`);
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
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
          // Profile fields
          name,
          phone: phone || '',
          birthday: birthday || null,
          address: address || '',
          gender: gender || '',
          role: role || 'Employee',
          dept_id: deptId,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

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
      } else if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        errorMsg = `Request timed out after 30 seconds.\n\nPossible issues:\n1. PHP server is not running at ${PHP_BACKEND_URL}\n2. Your device is not on the same WiFi network\n3. Firewall is blocking port 8000\n4. Server is too slow to respond\n\nPlease check:\n- Is PHP server running? (Check terminal)\n- Is your phone on the same WiFi?\n- Try restarting the PHP server`;
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out') || error.message?.includes('unreachable')) {
        errorMsg = `Request timed out. The server might be slow or unreachable.\n\nCheck:\n1. PHP server is running at ${PHP_BACKEND_URL}\n2. Your device is on the same WiFi\n3. Try again in a moment`;
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMsg = `Cannot connect to server at ${PHP_BACKEND_URL}\n\nMake sure:\n1. PHP server is running\n2. Your device is on the same WiFi\n3. Firewall allows port 8000`;
      } else if (error.message) {
        errorMsg = error.message;
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
      '📷 FOR BEST FACE RECOGNITION:\n\n✅ Position face in the center frame\n✅ Remove eyeglasses, masks, or hats\n✅ Ensure good lighting (face should be well-lit)\n✅ Look directly at camera\n✅ Keep face straight (not tilted)\n✅ Maintain neutral expression\n\n⚠️ This photo will be used for clock-in verification, so make sure your face is clearly visible!',
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
        // Use higher quality (0.7) for better face recognition during clock-in
        // This matches or exceeds clock-in quality (0.6) for better detection
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7, // Increased from 0.3 to 0.7 for better face recognition
          base64: true,
          skipProcessing: false, // Enable processing for better image quality
        });
        setCapturedImage(photo.uri);
        setCapturedBase64(photo.base64 || null);
        setShowCamera(false);
        
        // Debug: Check if base64 was captured
        if (photo.base64) {
          console.log('Base64 captured, length:', photo.base64.length);
          Alert.alert('Success', 'Face captured successfully! This will be used for clock-in verification.');
        } else {
          console.error('No base64 data in photo');
          Alert.alert('Warning', 'Face captured but data may be incomplete. Please retake for better recognition.');
        }
      } catch (error) {
        console.error('Capture error:', error);
        Alert.alert('Error', 'Failed to capture image. Please try again.');
      }
    }
  };

  // Default departments list (fallback if database fetch fails)
  const defaultDepartments = [
    { dept_id: 1, name: 'HR' },
    { dept_id: 2, name: 'Admin' },
    { dept_id: 3, name: 'Business Development' },
    { dept_id: 4, name: 'Accounting and Finance' },
    { dept_id: 5, name: 'Purchasing' },
    { dept_id: 6, name: 'Sales and Marketing' },
  ];

  // Fetch departments when signup mode is active
  useEffect(() => {
    if (isSignUp) {
      const fetchDepartments = async () => {
        try {
          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/departments?select=dept_id,name&order=name.asc`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );
          const data = await response.json();
          if (data && Array.isArray(data) && data.length > 0) {
            // Use departments from database
            setDepartments(data);
          } else {
            // Fallback to default departments if database is empty or fetch fails
            console.log('Using default departments list');
            setDepartments(defaultDepartments);
          }
        } catch (error) {
          console.error('Error fetching departments:', error);
          // Use default departments as fallback
          setDepartments(defaultDepartments);
        }
      };
      fetchDepartments();
    }
  }, [isSignUp]);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setUsername('');
    setPassword('');
    setCapturedImage(null);
    setCapturedBase64(null);
    // Reset profile fields
    setName('');
    setPhone('');
    setBirthday('');
    setAddress('');
    setGender('');
    setRole('Employee');
    setDeptId(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.contentWrapper}>
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
            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
            >
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

              {/* PROFILE FIELDS - Only show in Sign Up mode */}
              {isSignUp && (
                <>
                  <Text style={[styles.label, { marginTop: 15 }]}>Full Name *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter your full name"
                    placeholderTextColor="#666"
                    value={name}
                    onChangeText={setName}
                  />

                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter phone number"
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />

                  <Text style={styles.label}>Birthday</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.datePickerButton]}
                    onPress={() => {
                      if (birthday) {
                        const date = new Date(birthday);
                        setSelectedYear(date.getFullYear());
                        setSelectedMonth(date.getMonth() + 1);
                        setSelectedDay(date.getDate());
                      }
                      setShowDatePicker(true);
                    }}
                  >
                    <Text style={{ color: birthday ? '#fff' : '#666' }}>
                      {birthday || 'Select Birthday'}
                    </Text>
                    <Text style={{ color: '#F27121' }}>📅</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.genderContainer}>
                    <TouchableOpacity
                      style={[
                        styles.genderButton,
                        gender === 'Male' && styles.genderButtonActive,
                      ]}
                      onPress={() => setGender('Male')}
                    >
                      <Text
                        style={[
                          styles.genderButtonText,
                          gender === 'Male' && styles.genderButtonTextActive,
                        ]}
                      >
                        Male
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.genderButton,
                        gender === 'Female' && styles.genderButtonActive,
                      ]}
                      onPress={() => setGender('Female')}
                    >
                      <Text
                        style={[
                          styles.genderButtonText,
                          gender === 'Female' && styles.genderButtonTextActive,
                        ]}
                      >
                        Female
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Address</Text>
                  <TextInput 
                    style={[styles.input, styles.textArea]} 
                    placeholder="Enter your address"
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={3}
                    value={address}
                    onChangeText={setAddress}
                  />

                  <Text style={styles.label}>Role</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter your role (e.g., Employee)"
                    placeholderTextColor="#666"
                    value={role}
                    onChangeText={setRole}
                  />

                  <Text style={styles.label}>Department</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.datePickerButton]}
                    onPress={() => setShowDeptPicker(true)}
                  >
                    <Text style={{ color: deptId ? '#fff' : '#666' }}>
                      {departments.find(d => d.dept_id === deptId)?.name || 'Select Department'}
                    </Text>
                    <Text style={{ color: '#F27121' }}>▼</Text>
                  </TouchableOpacity>
                </>
              )}

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
            </ScrollView>
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
                {/* Face Frame Overlay - Helps user position face correctly */}
                <View style={styles.cameraOverlay}>
                  <View style={styles.faceFrameGuide} />
                  <Text style={styles.faceFrameText}>
                    Position your face within the frame{'\n'}
                    Ensure good lighting and look directly at camera
                  </Text>
                </View>
                <View style={styles.cameraControls}>
                  <TouchableOpacity 
                    style={styles.capturePhotoButton}
                    onPress={captureFace}
                  >
                    <Text style={styles.capturePhotoText}>📷 Capture</Text>
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

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Birthday</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.pickersContainer}>
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Year</Text>
                  <WheelPicker
                    selectedIndex={years.indexOf(selectedYear)}
                    options={years.map(year => year.toString())}
                    onChange={(index) => setSelectedYear(years[index])}
                    itemHeight={40}
                    containerStyle={styles.wheelPicker}
                    itemTextStyle={styles.wheelPickerText}
                    selectedIndicatorStyle={styles.wheelPickerIndicator}
                  />
                </View>
                
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Month</Text>
                  <WheelPicker
                    selectedIndex={selectedMonth - 1}
                    options={months.map(month => month.label)}
                    onChange={(index) => setSelectedMonth(months[index].value)}
                    itemHeight={40}
                    containerStyle={styles.wheelPicker}
                    itemTextStyle={styles.wheelPickerText}
                    selectedIndicatorStyle={styles.wheelPickerIndicator}
                  />
                </View>
                
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Day</Text>
                  <WheelPicker
                    selectedIndex={selectedDay - 1}
                    options={days.map(day => day.toString())}
                    onChange={(index) => setSelectedDay(days[index])}
                    itemHeight={40}
                    containerStyle={styles.wheelPicker}
                    itemTextStyle={styles.wheelPickerText}
                    selectedIndicatorStyle={styles.wheelPickerIndicator}
                  />
                </View>
              </View>
              
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={[styles.datePickerButton2, styles.cancelButton2]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.cancelButtonText2}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.datePickerButton2, styles.confirmButton]}
                  onPress={() => {
                    const formattedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                    setBirthday(formattedDate);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Department Picker Modal */}
        <Modal
          visible={showDeptPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDeptPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Department</Text>
                <TouchableOpacity onPress={() => setShowDeptPicker(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ maxHeight: 300 }}>
                <TouchableOpacity
                  style={styles.deptOption}
                  onPress={() => {
                    setDeptId(null);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text style={styles.deptOptionText}>None</Text>
                </TouchableOpacity>
                {departments.map((dept) => (
                  <TouchableOpacity
                    key={dept.dept_id}
                    style={styles.deptOption}
                    onPress={() => {
                      setDeptId(dept.dept_id);
                      setShowDeptPicker(false);
                    }}
                  >
                    <Text style={styles.deptOptionText}>{dept.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>We Empower Development</Text>
      </View>
    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  keyboardView: { flex: 1, paddingHorizontal: 30 },
  contentWrapper: { flex: 1, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logoTextContainer: { flexDirection: 'row', alignItems: 'center' },
  logoTDT: { color: '#D3D3D3', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  logoPowersteel: { color: '#F27121', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: '#888', fontSize: 12, marginTop: 5, letterSpacing: 2, fontWeight: '600', textTransform: 'uppercase' },
  formContainer: { width: '100%', backgroundColor: '#252525', borderRadius: 15, elevation: 8, maxHeight: '85%' },
  formScrollView: { maxHeight: 600 },
  formScrollContent: { padding: 25 },
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
  footer: { paddingVertical: 20, width: '100%', alignItems: 'center' },
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
  cameraOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  faceFrameGuide: {
    width: 280,
    height: 350,
    borderRadius: 140,
    borderWidth: 3,
    borderColor: '#F27121',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  faceFrameText: {
    position: 'absolute',
    bottom: 120,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    fontWeight: '600',
  },
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
  
  // Profile fields styles
  datePickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  genderContainer: { flexDirection: 'row', gap: 12 },
  genderButton: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#333', 
    backgroundColor: '#1A1A1A', 
    alignItems: 'center' 
  },
  genderButtonActive: { backgroundColor: '#F27121', borderColor: '#F27121' },
  genderButtonText: { color: '#ccc', fontSize: 16, fontWeight: '600' },
  genderButtonTextActive: { color: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 15 },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#252525',
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  pickersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    height: 220,
    paddingVertical: 10,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  wheelPicker: {
    height: 180,
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  wheelPickerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  wheelPickerIndicator: {
    backgroundColor: 'rgba(242, 113, 33, 0.2)',
    borderRadius: 8,
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  datePickerButton2: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton2: {
    backgroundColor: '#555',
  },
  cancelButtonText2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#F27121',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deptOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  deptOptionText: {
    color: '#fff',
    fontSize: 16,
  },
});