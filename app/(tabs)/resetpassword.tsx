import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl } from '../../constants/backend-config';
import { useCustomAlert } from '../../hooks/useCustomAlert';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const { visible, config, showAlert, hideAlert } = useCustomAlert();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    // Validation
    if (!newPassword || !confirmPassword) {
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Please fill in all fields',
      });
      return;
    }

    if (newPassword.length < 6) {
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Password must be at least 6 characters long',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Passwords do not match',
      });
      return;
    }

    setLoading(true);

    try {
      const backendUrl = await getBackendUrl();
      console.log('[ResetPassword] Resetting password for:', email);

      const response = await fetch(`${backendUrl}/reset-password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          newPassword: newPassword,
        }),
      });

      const result = await response.json();
      console.log('[ResetPassword] Response:', result);

      if (result.success) {
        showAlert({
          type: 'success',
          title: '✅ Success',
          message: 'Password reset successfully! You can now login with your new password.',
          onClose: () => {
            // Navigate back to login screen
            router.replace('/userlogin');
          },
        });
      } else {
        showAlert({
          type: 'error',
          title: '❌ Error',
          message: result.message || 'Failed to reset password',
        });
      }
    } catch (error) {
      console.error('[ResetPassword] Error:', error);
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Network error. Please check your connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomAlert 
        visible={visible} 
        {...config} 
        onClose={hideAlert} 
        onConfirm={config.onClose}
        onCancel={config.onCancel}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.contentWrapper}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/verifycode')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Icon/Illustration */}
          <View style={styles.iconContainer}>
            <View style={styles.keyIcon}>
              <Text style={styles.keyEmoji}>🔑</Text>
            </View>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            <Text style={styles.headerTitle}>Reset Password</Text>
            <Text style={styles.headerSubtitle}>
              Enter your new password
            </Text>

            {/* New Password Input */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor="#666"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Text style={styles.eyeIconText}>
                  {showNewPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor="#666"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIconText}>
                  {showConfirmPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsText}>
                • Password must be at least 6 characters{'\n'}
                • Make sure both passwords match
              </Text>
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[styles.resetButton, loading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.resetButtonText}>RESET PASSWORD</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 30,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 0,
    zIndex: 10,
  },
  backButtonText: {
    color: '#F27121',
    fontSize: 16,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  keyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F27121',
  },
  keyEmoji: {
    fontSize: 50,
  },
  formContainer: {
    width: '100%',
    backgroundColor: '#252525',
    borderRadius: 15,
    padding: 25,
    elevation: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 20,
  },
  label: {
    color: '#ccc',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 15,
    marginBottom: 15,
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
  requirementsContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  requirementsText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  resetButton: {
    backgroundColor: '#F27121',
    height: 55,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F27121',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
