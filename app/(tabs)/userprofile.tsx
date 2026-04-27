import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import WheelPicker from 'react-native-wheely';
import CustomAlert from '../../components/CustomAlert';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../constants/backend-config';
import { detectBestNetwork } from '../../constants/network-detector';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, interpolate } from 'react-native-reanimated';

interface UserProfile {
  emp_id: number;
  log_id: number;
  name: string;
  phone: string;
  birthday: string;
  address: string;
  gender: string;
  role: string;
  dept_id: number;
  department_name?: string;
  marital_status?: string;
  spouse_name?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

export default function UserProfile() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [pendingProfilePicture, setPendingProfilePicture] = useState<string | null>(null);
  
  // Date picker states
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 25);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  
  const [profile, setProfile] = useState<UserProfile>({
    emp_id: 0,
    log_id: 0,
    name: '',
    phone: '',
    birthday: '',
    address: '',
    gender: '',
    role: '',
    dept_id: 0,
    department_name: '',
    marital_status: '',
    spouse_name: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
  });

  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);
  const [faceImageUri, setFaceImageUri] = useState<string | null>(null);
  
  // Generate years (1950 to current year)
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);
  const months = [
    { label: 'January', value: 1 },
    { label: 'February', value: 2 },
    { label: 'March', value: 3 },
    { label: 'April', value: 4 },
    { label: 'May', value: 5 },
    { label: 'June', value: 6 },
    { label: 'July', value: 7 },
    { label: 'August', value: 8 },
    { label: 'September', value: 9 },
    { label: 'October', value: 10 },
    { label: 'November', value: 11 },
    { label: 'December', value: 12 },
  ];
  
  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    loadProfile();
    loadProfilePicture();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      
      console.log('[Profile] Loading profile for userId:', userId);
      
      if (!userId) {
        console.log('[Profile] No userId found in AsyncStorage');
        showAlert({ type: 'error', title: 'Error', message: 'User not logged in' });
        router.replace('/userlogin');
        return;
      }

      // Fetch via PHP backend (avoids direct Supabase call from device)
      const baseUrl = await detectBestNetwork();
      const url = `${baseUrl}/get-employee-profile.php?user_id=${userId}`;
      console.log('[Profile] Fetching from PHP backend:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      console.log('[Profile] Response status:', response.status);
      const result = await response.json();
      console.log('[Profile] Response data:', JSON.stringify(result, null, 2));

      if (result?.ok && result.employee) {
        const employee = result.employee;
        console.log('[Profile] Found employee:', employee);

        // Handle profile picture if returned
        if (employee.profile_picture) {
          const picData = employee.profile_picture;
          if (typeof picData === 'string') {
            if (picData.startsWith('data:image')) {
              setProfilePicture(picData);
            } else if (!picData.startsWith('\\x')) {
              setProfilePicture(`data:image/jpeg;base64,${picData}`);
            }
          }
        }

        // Handle face image if present
        if (employee.face) {
          let faceBase64 = employee.face;
          if (faceBase64.startsWith('\\x')) {
            // skip hex format
            setFaceImageUri(null);
          } else if (faceBase64.startsWith('data:image')) {
            setFaceImageUri(faceBase64);
          } else {
            setFaceImageUri(`data:image/jpeg;base64,${faceBase64}`);
          }
        }

        console.log('[Profile] Setting profile state:', employee);
        setProfile(employee);
        setEditedProfile(employee);
      } else {
        console.log('[Profile] No employee found for log_id:', userId);
        showAlert({
          type: 'warning',
          title: 'No Profile Found',
          message: 'No employee record exists. Would you like to create one?',
          buttonText: 'Create Profile',
          onClose: () => {
            createEmployeeRecord(userId);
            hideAlert();
          }
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load profile data: ' + (error?.message || 'Unknown error') });
    } finally {
      setLoading(false);
    }
  };

  const loadProfilePicture = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.log('[Profile Picture] No userId found');
        return;
      }

      console.log('[Profile Picture] Fetching for userId:', userId);

      // Route through PHP backend to avoid direct Supabase call from device
      const baseUrl = await detectBestNetwork();
      const response = await fetch(
        `${baseUrl}/get-employee-profile.php?user_id=${userId}`,
        { headers: { 'ngrok-skip-browser-warning': 'true' } }
      );

      const result = await response.json();
      console.log('[Profile Picture] Response status:', response.status);

      const picData = result?.employee?.profile_picture;
      if (picData && typeof picData === 'string') {
        if (picData.startsWith('data:image')) {
          setProfilePicture(picData);
          console.log('[Profile Picture] ✓ Set as data URI');
        } else if (picData.startsWith('/9j') || picData.startsWith('iVBOR') || picData.startsWith('R0lG')) {
          setProfilePicture(`data:image/jpeg;base64,${picData}`);
          console.log('[Profile Picture] ✓ Set as base64 with prefix');
        } else if (!picData.startsWith('\\x')) {
          setProfilePicture(`data:image/jpeg;base64,${picData}`);
          console.log('[Profile Picture] ✓ Set as base64 (fallback)');
        } else {
          console.warn('[Profile Picture] ⚠ PostgreSQL hex format — cannot display');
        }
      } else {
        console.log('[Profile Picture] No profile_picture found in database');
      }
    } catch (error) {
      console.error('[Profile Picture] Error:', error);
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'error', title: 'Permission Denied', message: 'We need camera roll permissions to change your profile picture.' });
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = result.assets[0].base64;
        
        // Show preview immediately and store for later upload
        const imageUri = `data:image/jpeg;base64,${base64Image}`;
        setProfilePicture(imageUri);
        setPendingProfilePicture(base64Image);
        
        console.log('[Profile Picture] Image selected, will upload on Save');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to pick image' });
    }
  };

  const uploadAndUpdateProfilePicture = async (base64Image: string) => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      console.log('[Profile Picture] Updating profile picture...');

      // Create complete data URI (this prevents PostgreSQL from converting to hex)
      const dataUri = `data:image/jpeg;base64,${base64Image}`;

      // Update profile_picture column (NOT face — that's for face recognition)
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/accounts?log_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            profile_picture: dataUri, // Dedicated profile photo column
          }),
        }
      );

      if (response.ok) {
        console.log('[Profile Picture] Update successful');
      } else {
        throw new Error('Failed to update profile picture');
      }
    } catch (error) {
      console.error('[Profile Picture] Update error:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update profile picture' });
    }
  };
  const createEmployeeRecord = async (logId: string) => {
    try {
      setLoading(true);
      const username = await AsyncStorage.getItem('username');
      
      console.log('[Profile] Creating employee record for log_id:', logId);
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/employees`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            log_id: parseInt(logId),
            name: username || 'User',
            phone: '0',
            birthday: null,
            address: '',
            gender: '',
            role: 'Employee',
            dept_id: null,
          }),
        }
      );

      const result = await response.json();
      console.log('[Profile] Create response:', result);

      if (response.ok && result && result.length > 0) {
        showAlert({ type: 'success', title: 'Success', message: 'Profile created! You can now edit your information.' });
        setProfile(result[0]);
        setEditedProfile(result[0]);
        setEditing(true);
      } else {
        const errorMsg = result?.message || result?.hint || 'Failed to create profile';
        showAlert({ type: 'error', title: 'Error', message: `Could not create profile: ${errorMsg}\n\nPlease contact your administrator.` });
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create profile. Please contact administrator.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Upload profile picture first if there's a pending one
      if (pendingProfilePicture) {
        console.log('[Profile Picture] Uploading profile picture...');
        await uploadAndUpdateProfilePicture(pendingProfilePicture);
        setPendingProfilePicture(null);
      }

      // Then update employee data
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/employees?emp_id=eq.${profile.emp_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            name: editedProfile.name,
            phone: editedProfile.phone,
            birthday: editedProfile.birthday,
            address: editedProfile.address,
            gender: editedProfile.gender,
            marital_status: editedProfile.marital_status,
            spouse_name: editedProfile.spouse_name,
            emergency_contact_name: editedProfile.emergency_contact_name,
            emergency_contact_phone: editedProfile.emergency_contact_phone,
            emergency_contact_relation: editedProfile.emergency_contact_relation,
          }),
        }
      );

      if (response.ok) {
        setProfile(editedProfile);
        setEditing(false);
        showAlert({ type: 'success', title: 'Success', message: 'Profile updated successfully' });
        // Reload profile picture to confirm
        await loadProfilePicture();
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setPendingProfilePicture(null);
    setEditing(false);
    // Reload profile picture to revert any preview changes
    loadProfilePicture();
  };

  const regenerateQR = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        showAlert({ type: 'error', title: 'Error', message: 'User not logged in.' });
        return;
      }

      setLoading(true);

      // Build stable QR: LOGID-based (never changes with username)
      const timestamp = Date.now();
      const stableQr  = `LOGID:${userId}|TIME:${timestamp}`;

      const { getBackendUrl } = await import('../../constants/backend-config');
      const backendUrl = getBackendUrl();

      const res = await fetch(`${backendUrl}/update-qr.php`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept:         'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ log_id: parseInt(userId), qr_code: stableQr }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        showAlert({
          type:    'success',
          title:   '✅ QR Regenerated',
          message: 'Your QR code has been updated. You can now use it to clock in — it will keep working even if you change your username again.',
        });
      } else {
        throw new Error(data.message || 'Failed to update QR code');
      }
    } catch (err: any) {
      showAlert({ type: 'error', title: 'Failed', message: err?.message || 'Could not regenerate QR code.' });
    } finally {
      setLoading(false);
    }
  };

  // Dynamic styles
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input: {
      backgroundColor: isDark ? '#2C3E50' : '#F5F5F5',
      color: colors.text,
      borderColor: colors.border,
    },
  };

  // Entrance animations
  const fadeAnim = useSharedValue(0);
  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [20, 0]) }]
  }));

  if (loading && !profile.emp_id) {
    return (
      <SafeAreaView style={[styles.container, dyn.bg]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F27121" />
          <Text style={[styles.loadingText, dyn.text]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={[styles.header, dyn.card]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>My Profile</Text>
        <TouchableOpacity
          onPress={() => {
            if (editing) {
              handleCancel();
            } else {
              setEditing(true);
            }
          }}
          style={styles.editButton}
        >
          {editing ? (
            <Text style={styles.cancelText}>Cancel</Text>
          ) : (
            <Ionicons name="create-outline" size={24} color="#F27121" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={animatedStyle}>
      {/* PROFILE PICTURE SECTION */}
        <View style={styles.profilePictureContainer}>
          <View style={styles.profilePicture}>
            {profilePicture ? (
              <Image 
                source={{ uri: profilePicture }} 
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={60} color="#F27121" />
            )}
          </View>
          {editing && (
            <TouchableOpacity 
              style={styles.changePictureButton}
              onPress={pickImage}
            >
              <MaterialCommunityIcons name="camera" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* PROFILE INFORMATION */}
        <View style={[styles.card, dyn.card]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#F27121" />
            <Text style={[styles.sectionTitle, dyn.text]}>Personal Information</Text>
          </View>

          {/* Name */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Full Name</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input]}
                value={editedProfile.name}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, name: text })
                }
                placeholder="Enter your name"
                placeholderTextColor={colors.subText}
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.name}</Text>
              </View>
            )}
          </View>

          {/* Phone Number */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Phone Number</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input]}
                value={editedProfile.phone}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, phone: text })
                }
                placeholder="Enter phone number"
                placeholderTextColor={colors.subText}
                keyboardType="phone-pad"
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.phone}</Text>
              </View>
            )}
          </View>

          {/* Birthday */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Birthday</Text>
            {editing ? (
              <>
                <TouchableOpacity
                  style={[styles.input, dyn.input, styles.datePickerButton]}
                  onPress={() => {
                    // Initialize picker with current birthday if exists
                    if (editedProfile.birthday) {
                      const date = new Date(editedProfile.birthday);
                      setSelectedYear(date.getFullYear());
                      setSelectedMonth(date.getMonth() + 1);
                      setSelectedDay(date.getDate());
                    }
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={[styles.inputText, dyn.text]}>
                    {editedProfile.birthday || 'Select Birthday'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.subText} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.birthday}</Text>
              </View>
            )}
          </View>
          
          {/* Custom Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.datePickerModal, dyn.card]}>
                <View style={styles.datePickerHeader}>
                  <Text style={[styles.datePickerTitle, dyn.text]}>Select Birthday</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.pickersContainer}>
                  {/* Year Picker */}
                  <View style={styles.pickerWrapper}>
                    <Text style={[styles.pickerLabel, dyn.text]}>Year</Text>
                    <WheelPicker
                      selectedIndex={years.indexOf(selectedYear)}
                      options={years.map(year => year.toString())}
                      onChange={(index) => setSelectedYear(years[index])}
                      itemHeight={40}
                      containerStyle={styles.wheelPicker}
                      selectedIndicatorStyle={{ backgroundColor: 'transparent' }}
                      itemTextStyle={{ color: isDark ? '#FFF' : '#333' }}
                    />
                  </View>
                  
                  {/* Month Picker */}
                  <View style={styles.pickerWrapper}>
                    <Text style={[styles.pickerLabel, dyn.text]}>Month</Text>
                    <WheelPicker
                      selectedIndex={selectedMonth - 1}
                      options={months.map(month => month.label)}
                      onChange={(index) => setSelectedMonth(months[index].value)}
                      itemHeight={40}
                      containerStyle={styles.wheelPicker}
                      selectedIndicatorStyle={{ backgroundColor: 'transparent' }}
                      itemTextStyle={{ color: isDark ? '#FFF' : '#333' }}
                    />
                  </View>
                  
                  {/* Day Picker */}
                  <View style={styles.pickerWrapper}>
                    <Text style={[styles.pickerLabel, dyn.text]}>Day</Text>
                    <WheelPicker
                      selectedIndex={selectedDay - 1}
                      options={days.map(day => day.toString())}
                      onChange={(index) => setSelectedDay(days[index])}
                      itemHeight={40}
                      containerStyle={styles.wheelPicker}
                      selectedIndicatorStyle={{ backgroundColor: 'transparent' }}
                      itemTextStyle={{ color: isDark ? '#FFF' : '#333' }}
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
                      setEditedProfile({ ...editedProfile, birthday: formattedDate });
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Gender */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Gender</Text>
            {editing ? (
              <View style={styles.genderContainer}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    editedProfile.gender === 'Male' && styles.genderButtonActive,
                  ]}
                  onPress={() =>
                    setEditedProfile({ ...editedProfile, gender: 'Male' })
                  }
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      editedProfile.gender === 'Male' && styles.genderButtonTextActive,
                    ]}
                  >
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    editedProfile.gender === 'Female' && styles.genderButtonActive,
                  ]}
                  onPress={() =>
                    setEditedProfile({ ...editedProfile, gender: 'Female' })
                  }
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      editedProfile.gender === 'Female' && styles.genderButtonTextActive,
                    ]}
                  >
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.gender}</Text>
              </View>
            )}
          </View>
          {/* Marital Status */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Marital Status</Text>
            {editing ? (
              <View style={styles.statusRow}>
                {['Single', 'Married', 'Widowed', 'Separated'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.choiceButton,
                      editedProfile.marital_status === status && styles.choiceButtonActive,
                    ]}
                    onPress={() => setEditedProfile({ ...editedProfile, marital_status: status })}
                  >
                    <Text style={[
                      styles.choiceButtonText,
                      editedProfile.marital_status === status && styles.choiceButtonTextActive
                    ]}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.marital_status || 'Not Set'}</Text>
              </View>
            )}
          </View>

          {/* Spouse Name (Only if Married) */}
          {(editing ? editedProfile.marital_status === 'Married' : profile.marital_status === 'Married') && (
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, dyn.sub]}>Spouse Name</Text>
              {editing ? (
                <TextInput
                  style={[styles.input, dyn.input]}
                  value={editedProfile.spouse_name}
                  onChangeText={(text) => setEditedProfile({ ...editedProfile, spouse_name: text })}
                  placeholder="Enter spouse full name"
                  placeholderTextColor={colors.subText}
                />
              ) : (
                <View style={[styles.input, dyn.input, styles.disabledInput]}>
                  <Text style={[styles.inputText, dyn.text]}>{profile.spouse_name || 'Not Set'}</Text>
                </View>
              )}
            </View>
          )}

          {/* Address */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Permanent Address</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={editedProfile.address}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, address: text })}
                placeholder="Enter complete address"
                placeholderTextColor={colors.subText}
                multiline
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput, { height: 'auto', minHeight: 50, paddingVertical: 10 }]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.address || 'Not Set'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* EMERGENCY CONTACT */}
        <View style={[styles.card, dyn.card]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle-outline" size={20} color="#E74C3C" />
            <Text style={[styles.sectionTitle, dyn.text]}>Emergency Contact</Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Contact Person</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input]}
                value={editedProfile.emergency_contact_name}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, emergency_contact_name: text })}
                placeholder="Name of emergency contact"
                placeholderTextColor={colors.subText}
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.emergency_contact_name || 'Not Set'}</Text>
              </View>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Relationship</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input]}
                value={editedProfile.emergency_contact_relation}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, emergency_contact_relation: text })}
                placeholder="e.g. Spouse, Parent, Sibling"
                placeholderTextColor={colors.subText}
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.emergency_contact_relation || 'Not Set'}</Text>
              </View>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Contact Number</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input]}
                value={editedProfile.emergency_contact_phone}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, emergency_contact_phone: text })}
                placeholder="Phone number"
                placeholderTextColor={colors.subText}
                keyboardType="phone-pad"
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.emergency_contact_phone || 'Not Set'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* EMPLOYMENT INFORMATION */}
        <View style={[styles.card, dyn.card]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase-outline" size={20} color="#3498DB" />
            <Text style={[styles.sectionTitle, dyn.text]}>Employment Details</Text>
          </View>
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Role</Text>
            <View style={[styles.input, dyn.input, styles.disabledInput]}>
              <Text style={[styles.inputText, dyn.text]}>{profile.role || 'Not assigned'}</Text>
            </View>
          </View>

          {/* Department */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Department</Text>
            <View style={[styles.input, dyn.input, styles.disabledInput]}>
              <Text style={[styles.inputText, dyn.text]}>{profile.department_name || 'Not assigned'}</Text>
            </View>
          </View>
        </View>

        {/* SAVE BUTTON */}
        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* REGENERATE QR BUTTON — always visible so users can fix QR after username change */}
        <TouchableOpacity
          style={styles.regenQrButton}
          onPress={regenerateQR}
          disabled={loading}
        >
          <MaterialCommunityIcons name="qrcode-edit" size={20} color="#F27121" />
          <Text style={styles.regenQrText}>Regenerate QR Code</Text>
        </TouchableOpacity>
        <Text style={styles.regenQrHint}>
          Use this if your QR code stopped working after a username change.
        </Text>

      </Animated.View>
      </ScrollView>

      <CustomAlert
        visible={visible}
        {...config}
        onClose={hideAlert}
        onConfirm={config.onClose}
        onCancel={config.onCancel}
        backgroundColor={colors.card}
        textColor={colors.text}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 8,
  },
  cancelText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F27121',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  changePictureButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#F27121',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  card: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
  },
  inputText: {
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.7,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#F27121',
    borderColor: '#F27121',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  genderButtonTextActive: {
    color: '#FFF',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  choiceButtonActive: {
    backgroundColor: '#F27121',
    borderColor: '#F27121',
  },
  choiceButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  choiceButtonTextActive: {
    color: '#FFF',
  },
  saveButton: {
    backgroundColor: '#27AE60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
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
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  pickersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    height: 200,
  },
  pickerWrapper: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  wheelPicker: {
    height: 180,
    width: '100%',
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
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText2: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#F27121',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // QR Regenerate button
  regenQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F27121',
    borderStyle: 'dashed',
  },
  regenQrText: {
    color: '#F27121',
    fontSize: 15,
    fontWeight: '700',
  },
  regenQrHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 30,
  },
});
