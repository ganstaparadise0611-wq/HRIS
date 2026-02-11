import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { useTheme } from './ThemeContext';

// Backend configuration
const PHP_BACKEND_URL = 'http://192.168.15.229:8000';
const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

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
}

export default function UserProfile() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
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
  });

  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);
  
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
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // Get logged-in user ID from AsyncStorage
      const userId = await AsyncStorage.getItem('userId');
      
      console.log('[Profile] Loading profile for userId:', userId);
      
      if (!userId) {
        console.log('[Profile] No userId found in AsyncStorage');
        Alert.alert('Error', 'User not logged in');
        router.replace('/userlogin');
        return;
      }

      // Query employees by log_id (foreign key to accounts)
      const url = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${userId}&select=*`;
      console.log('[Profile] Fetching from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      console.log('[Profile] Response status:', response.status);
      const data = await response.json();
      console.log('[Profile] Response data:', JSON.stringify(data, null, 2));

      if (data && data.length > 0) {
        const employee = data[0];
        console.log('[Profile] Found employee:', employee);
        
        // Fetch department name if dept_id exists
        if (employee.dept_id) {
          console.log('[Profile] Fetching department for dept_id:', employee.dept_id);
          const deptResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/departments?dept_id=eq.${employee.dept_id}&select=name`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );
          const deptData = await deptResponse.json();
          console.log('[Profile] Department data:', deptData);
          if (deptData && deptData.length > 0) {
            employee.department_name = deptData[0].name;
          }
        }
        
        console.log('[Profile] Setting profile state:', employee);
        setProfile(employee);
        setEditedProfile(employee);
      } else {
        console.log('[Profile] No employee found for log_id:', userId);
        // Offer to create employee record
        Alert.alert(
          'No Profile Found', 
          'No employee record exists. Would you like to create one?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Profile', 
              onPress: () => createEmployeeRecord(userId)
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data: ' + (error?.message || 'Unknown error'));
    } finally {
      setLoading(false);
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
        Alert.alert('Success', 'Profile created! You can now edit your information.');
        setProfile(result[0]);
        setEditedProfile(result[0]);
        setEditing(true);
      } else {
        const errorMsg = result?.message || result?.hint || 'Failed to create profile';
        Alert.alert('Error', `Could not create profile: ${errorMsg}\n\nPlease contact your administrator.`);
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      Alert.alert('Error', 'Failed to create profile. Please contact administrator.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

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
            role: editedProfile.role,
            dept_id: editedProfile.dept_id,
          }),
        }
      );

      if (response.ok) {
        setProfile(editedProfile);
        setEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setEditing(false);
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
        {/* PROFILE PICTURE */}
        <View style={styles.profilePictureContainer}>
          <View style={styles.profilePicture}>
            <Ionicons name="person" size={60} color="#F27121" />
          </View>
          {editing && (
            <TouchableOpacity style={styles.changePictureButton}>
              <MaterialCommunityIcons name="camera" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* PROFILE INFORMATION */}
        <View style={[styles.card, dyn.card]}>
          <Text style={[styles.sectionTitle, dyn.text]}>Personal Information</Text>

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

          {/* Address */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Address</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input, styles.textArea]}
                value={editedProfile.address}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, address: text })
                }
                placeholder="Enter your address"
                placeholderTextColor={colors.subText}
                multiline
                numberOfLines={3}
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput, styles.textArea]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.address}</Text>
              </View>
            )}
          </View>

          {/* Role */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, dyn.sub]}>Role</Text>
            {editing ? (
              <TextInput
                style={[styles.input, dyn.input]}
                value={editedProfile.role}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, role: text })
                }
                placeholder="Enter your role"
                placeholderTextColor={colors.subText}
              />
            ) : (
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Text style={[styles.inputText, dyn.text]}>{profile.role}</Text>
              </View>
            )}
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
      </ScrollView>
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
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
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
  saveButton: {
    backgroundColor: '#27AE60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
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
});
