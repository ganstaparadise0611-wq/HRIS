import { useRouter } from 'expo-router';
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
    View
} from 'react-native';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl } from '../../constants/backend-config';
import { useCustomAlert } from '../../hooks/useCustomAlert';

export default function ForgotPassword() {
  const router = useRouter();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Please enter your email address',
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Please enter a valid email address',
      });
      return;
    }

    setLoading(true);

    try {
      const backendUrl = await getBackendUrl();
      console.log('[ForgotPassword] Sending code to:', email);

      const response = await fetch(`${backendUrl}/forgot-password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const result = await response.json();
      console.log('[ForgotPassword] Response:', result);

      if (result.success) {
        showAlert({
          type: 'success',
          title: '✅ Success',
          message: 'Verification code sent to your email!',
          onClose: () => {
            // Navigate to verify code screen with email
            router.push({
              pathname: '/verifycode',
              params: { email: email.toLowerCase().trim() },
            });
          },
        });
      } else {
        showAlert({
          type: 'error',
          title: '❌ Error',
          message: result.message || 'Failed to send verification code',
        });
      }
    } catch (error) {
      console.error('[ForgotPassword] Error:', error);
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
            onPress={() => router.push('/userlogin')}
          >
            <Text style={styles.backButtonText}>← Back to Login</Text>
          </TouchableOpacity>

          {/* Icon/Illustration */}
          <View style={styles.iconContainer}>
            <View style={styles.lockIcon}>
              <Text style={styles.lockEmoji}>🔓</Text>
            </View>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            <Text style={styles.headerTitle}>Recover Password</Text>
            <Text style={styles.headerSubtitle}>
              Enter your email address to receive a verification code
            </Text>

            {/* Email Input */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* Send Code Button */}
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>SEND RECOVERY CODE</Text>
              )}
            </TouchableOpacity>

            {/* Try Another Way */}
            <TouchableOpacity
              style={styles.tryAnotherWay}
              onPress={() => router.push('/userlogin')}
            >
              <Text style={styles.tryAnotherText}>Try Another Way</Text>
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
  lockIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F27121',
  },
  lockEmoji: {
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
    fontSize: 14,
  },
  input: {
    height: 55,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  sendButton: {
    backgroundColor: '#F27121',
    height: 55,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F27121',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
    marginBottom: 15,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tryAnotherWay: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  tryAnotherText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
});
