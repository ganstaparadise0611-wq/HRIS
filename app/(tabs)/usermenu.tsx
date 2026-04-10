import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl } from '../../constants/backend-config';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext'; // <--- IMPORT HOOK

const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

export default function UserMenu() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme(); // <--- GET THEME DATA
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';
  const [userName, setUserName] = useState<string>('User');
  const [userRole, setUserRole] = useState<string>('Employee');
  const [userDept, setUserDept] = useState<string>('Not assigned');
  
  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadUserInfo = async () => {
        try {
          const userId = await AsyncStorage.getItem('userId');
          if (userId) {
            try {
              // Fetch employee info
              const response = await fetch(
                `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${userId}&select=name,role,dept_id`,
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
              if (data && data.length > 0) {
                if (data[0].name) setUserName(data[0].name);
                if (data[0].role) setUserRole(data[0].role);
                
                // Fetch department name if dept_id exists
                if (data[0].dept_id) {
                  const deptResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/departments?dept_id=eq.${data[0].dept_id}&select=name`,
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
                  if (deptData && deptData.length > 0 && deptData[0].name) {
                    setUserDept(deptData[0].name);
                  }
                }
              } else {
                // Fallback to username from AsyncStorage
                const username = await AsyncStorage.getItem('username');
                if (username) {
                  setUserName(username);
                }
              }
            } catch (e) {
              console.log('Error loading user info:', e);
              // Fallback to username from AsyncStorage
              const username = await AsyncStorage.getItem('username');
              if (username) {
                setUserName(username);
              }
            }
          }
        } catch (e) {
          console.log('Error loading user info:', e);
        }
      };
      loadUserInfo();
    }, [])
  );

  // MENU ITEMS
  const menuItems = [
    { icon: 'person-outline', label: 'My Profile', sub: 'Edit details' },
    { icon: 'notifications-outline', label: 'Notifications', sub: 'Manage alerts' },
    { icon: 'lock-closed-outline', label: 'Security', sub: 'Change password' },
    { icon: 'help-circle-outline', label: 'Help & Support', sub: 'FAQs' },
  ];

  const handleMenuPress = (label: string) => {
    if (label === 'My Profile') {
      router.push('/userprofile');
    }
    // Add more navigation cases here as needed
  };

  const handleLogout = async () => {
    showAlert({
      type: 'warning',
      title: 'Logout',
      message: 'Are you sure you want to log out?',
      buttonText: 'Logout',
      cancelText: 'Cancel',
      onClose: async () => {
        try {
          // Clear all session data including remember-me
          await Promise.all([
            AsyncStorage.removeItem('userId'),
            AsyncStorage.removeItem('username'),
            AsyncStorage.removeItem('emp_id'),
            AsyncStorage.removeItem('login_keep_logged'),
            AsyncStorage.removeItem('login_saved_username'),
            AsyncStorage.removeItem('userClockInTime'),
          ]);
        } catch (_e) {
          // Ignore storage errors
        }
        hideAlert();
        router.replace('/userlogin');
      }
    });
  };

  const handleSecurityPress = () => {
    setShowPasswordModal(true);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert({ type: 'error', title: 'Missing Information', message: 'Please fill in all password fields.' });
      return;
    }

    if (newPassword.length < 6) {
      showAlert({ type: 'error', title: 'Invalid Password', message: 'New password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({ type: 'error', title: 'Password Mismatch', message: 'New password and confirm password do not match.' });
      return;
    }

    if (oldPassword === newPassword) {
      showAlert({ type: 'error', title: 'Invalid Password', message: 'New password must be different from current password.' });
      return;
    }

    try {
      setChangingPassword(true);
      const userId = await AsyncStorage.getItem('userId');
      
      if (!userId) {
        showAlert({ type: 'error', title: 'Error', message: 'User session not found. Please log in again.' });
        return;
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${getBackendUrl()}/change_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          user_id: parseInt(userId, 10),
          old_password: oldPassword,
          new_password: newPassword,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('[Change Password] Failed to parse response:', parseError);
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok || !result.ok) {
        const errorMsg = result.message || 'Failed to change password. Please try again.';
        throw new Error(errorMsg);
      }

      // Success
      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Password changed successfully!',
        buttonText: 'OK',
        onClose: () => {
          setShowPasswordModal(false);
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          hideAlert();
        }
      });
    } catch (error: any) {
      console.error('[Change Password] Error:', error);
      
      let errorMessage = 'Failed to change password. Please try again.';
      
      if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showAlert({ type: 'error', title: 'Change Password Error', message: errorMessage });
    } finally {
      setChangingPassword(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // DYNAMIC STYLES
  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.background },
    text: { color: colors.text },
    subText: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderBottomColor: colors.border },
    iconBox: { backgroundColor: isDark ? '#333' : '#F0F0F0' },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>More Options</Text>
        <View style={{width: 30}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* PROFILE CARD */}
        <View style={[styles.profileCard, dynamicStyles.card]}>
            <View style={[styles.avatarCircle, dynamicStyles.iconBox]}>
                <Ionicons name="person" size={40} color={colors.text} />
            </View>
            <View style={styles.profileInfo}>
                <Text style={[styles.profileName, dynamicStyles.text]}>{userName}</Text>
                <Text style={[styles.profileRole, dynamicStyles.subText]}>{userDept}</Text>
                <Text style={styles.profileId}>Role: {userRole}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn}>
                <MaterialCommunityIcons name="pencil" size={20} color="#F27121" />
            </TouchableOpacity>
        </View>

        {/* FEATURE SHORTCUTS (from Home quick access) */}
        <Text style={[styles.sectionTitle, dynamicStyles.subText]}>FEATURES</Text>
        <View style={[styles.featuresRow, dynamicStyles.card]}>
          {[
            { label: 'Payslip', icon: 'file-tray-full-outline', route: '/userpayslip' },
            { label: 'Overtime', icon: 'time-outline', route: '/userovertime' },
            { label: 'Leave', icon: 'calendar-outline', route: '/userleave' },
            { label: 'On Duty', icon: 'airplane-outline', route: '/useronduty' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.featureItem}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.featureIconBox, dynamicStyles.iconBox]}>
                <Ionicons name={item.icon as any} size={22} color={colors.text} />
              </View>
              <Text style={[styles.featureLabel, dynamicStyles.text]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* SETTINGS GROUP */}
        <Text style={[styles.sectionTitle, dynamicStyles.subText]}>GENERAL</Text>
        <View style={[styles.menuGroup, dynamicStyles.card]}>
            {menuItems.map((item, index) => (
                <TouchableOpacity 
                    key={index} 
                    style={[styles.menuItem, dynamicStyles.border]}
                    onPress={() => handleMenuPress(item.label)}
                >
                    <View style={[styles.menuIconBox, dynamicStyles.iconBox]}>
                        <Ionicons name={item.icon as any} size={22} color={colors.text} />
                    </View>
                    <View style={styles.menuText}>
                        <Text style={[styles.menuLabel, dynamicStyles.text]}>{item.label}</Text>
                        <Text style={[styles.menuSub, dynamicStyles.subText]}>{item.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.subText} />
                </TouchableOpacity>
            ))}
        </View>

        {/* PREFERENCES (THE SWITCH) */}
        <Text style={[styles.sectionTitle, dynamicStyles.subText]}>PREFERENCES</Text>
        <View style={[styles.menuGroup, dynamicStyles.card]}>
            <View style={styles.menuItem}>
                <View style={[styles.menuIconBox, dynamicStyles.iconBox]}>
                    <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={22} color={colors.text} />
                </View>
                <View style={styles.menuText}>
                    <Text style={[styles.menuLabel, dynamicStyles.text]}>Dark Mode</Text>
                </View>
                
                {/* THE WORKING SWITCH */}
                <Switch 
                    value={isDark} 
                    onValueChange={toggleTheme} 
                    trackColor={{false: '#767577', true: '#F27121'}} 
                    thumbColor="#f4f3f4" 
                />
            
            </View>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: '#C0392B' }]} onPress={handleLogout}>
            <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>
        
        <Text style={[styles.versionText, dynamicStyles.subText]}>TDT Powersteel App v1.0.0 (Beta)</Text>

      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closePasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.card]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>Change Password</Text>
              <TouchableOpacity onPress={closePasswordModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, dynamicStyles.text]}>Current Password</Text>
              <View style={[styles.passwordInputContainer, { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', borderColor: isDark ? '#333' : '#DDD' }]}>
                <TextInput
                  style={[styles.passwordInput, dynamicStyles.text]}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.subText}
                  secureTextEntry={!showOldPassword}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)}>
                  <Ionicons 
                    name={showOldPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={colors.subText} 
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, dynamicStyles.text, { marginTop: 15 }]}>New Password</Text>
              <View style={[styles.passwordInputContainer, { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', borderColor: isDark ? '#333' : '#DDD' }]}>
                <TextInput
                  style={[styles.passwordInput, dynamicStyles.text]}
                  placeholder="Enter new password (min. 6 characters)"
                  placeholderTextColor={colors.subText}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <Ionicons 
                    name={showNewPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={colors.subText} 
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, dynamicStyles.text, { marginTop: 15 }]}>Confirm New Password</Text>
              <View style={[styles.passwordInputContainer, { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', borderColor: isDark ? '#333' : '#DDD' }]}>
                <TextInput
                  style={[styles.passwordInput, dynamicStyles.text]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.subText}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={colors.subText} 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.changePasswordButton, { opacity: changingPassword ? 0.6 : 1 }]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                <Text style={styles.changePasswordButtonText}>
                  {changingPassword ? 'CHANGING...' : 'CHANGE PASSWORD'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

// STATIC LAYOUT STYLES
const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  content: { padding: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 15, marginBottom: 30 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold' },
  profileRole: { fontSize: 12, marginBottom: 4 },
  profileId: { color: '#F27121', fontSize: 12, fontWeight: 'bold' },
  editBtn: { padding: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginLeft: 5, letterSpacing: 1 },
  menuGroup: { borderRadius: 15, marginBottom: 25, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  menuIconBox: { width: 35, height: 35, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '500' },
  menuSub: { fontSize: 11 },
  logoutBtn: { borderWidth: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#C0392B', fontWeight: 'bold', fontSize: 16 },
  versionText: { textAlign: 'center', fontSize: 12, marginBottom: 30 },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 25,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  // Password Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  changePasswordButton: {
    backgroundColor: '#F27121',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  changePasswordButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});