import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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

export default function VerifyCode() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  const { visible, config, showAlert, hideAlert } = useCustomAlert();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Create refs for each input
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (numericText.length > 1) {
      // If user pastes multiple digits, distribute them
      const digits = numericText.split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      
      // Focus on the last filled input or the next empty one
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Single digit entry
      const newCode = [...code];
      newCode[index] = numericText;
      setCode(newCode);

      // Auto-focus next input if digit was entered
      if (numericText && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Please enter the complete 6-digit code',
      });
      return;
    }

    setLoading(true);

    try {
      const backendUrl = await getBackendUrl();
      console.log('[VerifyCode] Verifying code for:', email);

      const response = await fetch(`${backendUrl}/verify-code.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          code: fullCode,
        }),
      });

      const result = await response.json();
      console.log('[VerifyCode] Response:', result);

      if (result.success) {
        showAlert({
          type: 'success',
          title: '✅ Success',
          message: 'Code verified successfully!',
          onClose: () => {
            // Navigate to reset password screen
            router.push({
              pathname: '/resetpassword',
              params: { email: email },
            });
          },
        });
      } else {
        showAlert({
          type: 'error',
          title: '❌ Error',
          message: result.message || 'Invalid or expired code',
        });
      }
    } catch (error) {
      console.error('[VerifyCode] Error:', error);
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Network error. Please check your connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);

    try {
      const backendUrl = await getBackendUrl();
      console.log('[VerifyCode] Resending code to:', email);

      const response = await fetch(`${backendUrl}/forgot-password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email }),
      });

      const result = await response.json();
      console.log('[VerifyCode] Resend response:', result);

      if (result.success) {
        // Clear the input fields
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        showAlert({
          type: 'success',
          title: '✅ Success',
          message: 'New verification code sent!',
        });
      } else {
        showAlert({
          type: 'error',
          title: '❌ Error',
          message: result.message || 'Failed to resend code',
        });
      }
    } catch (error) {
      console.error('[VerifyCode] Resend error:', error);
      showAlert({
        type: 'error',
        title: '❌ Error',
        message: 'Network error. Please try again.',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomAlert visible={visible} {...config} onClose={hideAlert} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.contentWrapper}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/forgotpassword')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Icon/Illustration */}
          <View style={styles.iconContainer}>
            <View style={styles.shieldIcon}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
            </View>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            <Text style={styles.headerTitle}>Verify Code</Text>
            <Text style={styles.headerSubtitle}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>

            {/* Code Input Boxes */}
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.codeInput,
                    digit ? styles.codeInputFilled : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={2} // Allow 2 to handle paste
                  selectTextOnFocus
                  editable={!loading}
                />
              ))}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>VERIFY CODE</Text>
              )}
            </TouchableOpacity>

            {/* Resend Code */}
            <TouchableOpacity
              style={styles.resendContainer}
              onPress={handleResendCode}
              disabled={resending || loading}
            >
              <Text style={styles.resendText}>
                {resending ? 'Sending...' : 'Resend Code'}
              </Text>
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
  shieldIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F27121',
  },
  shieldEmoji: {
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
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 20,
  },
  emailText: {
    color: '#F27121',
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: '#F27121',
    backgroundColor: '#252525',
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resendContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resendText: {
    color: '#F27121',
    fontSize: 14,
    fontWeight: '600',
  },
});
