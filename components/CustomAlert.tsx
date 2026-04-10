import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../app/(tabs)/ThemeContext';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  hint?: string;
  buttonText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
  onCancel?: () => void;
  backgroundColor?: string;
  textColor?: string;
}

export default function CustomAlert({
  visible,
  type = 'info',
  title,
  message,
  hint,
  buttonText,
  cancelText,
  onConfirm,
  onClose,
  onCancel,
  backgroundColor,
  textColor,
}: CustomAlertProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const { colors, theme } = useTheme();
    
    // Force dynamic theme matching regardless of props
    const finalBgColor = colors.card;
    const finalTextColor = colors.text;
  
    useEffect(() => {
      if (visible) {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }).start();
      } else {
        scaleAnim.setValue(0);
      }
    }, [visible]);
  
    const handleClose = (action: 'confirm' | 'cancel' | 'dismiss' = 'dismiss') => {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onClose(); // Just hides the modal
        if (action === 'confirm' && onConfirm) {
          onConfirm();
        } else if (action === 'cancel' && onCancel) {
          onCancel();
        }
      });
    };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={80} color="#28a745" />;
      case 'error':
        return <MaterialCommunityIcons name="alert-circle" size={80} color="#dc3545" />;
      case 'warning':
        return <Ionicons name="warning" size={80} color="#ffc107" />;
      case 'info':
      default:
        return <Ionicons name="information-circle" size={80} color="#17a2b8" />;
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'success':
        return '#d4edda';
      case 'error':
        return '#f8d7da';
      case 'warning':
        return '#fff3cd';
      case 'info':
      default:
        return '#d1ecf1';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return '#28a745';
      case 'error':
        return '#dc3545';
      case 'warning':
        return '#ffc107';
      case 'info':
      default:
        return '#17a2b8';
    }
  };

  const getDefaultButtonText = () => {
    switch (type) {
      case 'success':
        return 'Great!';
      case 'error':
        return 'OK';
      case 'warning':
        return 'Got it';
      case 'info':
      default:
        return 'OK';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => handleClose()}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: scaleAnim }], backgroundColor: finalBgColor },
          ]}
        >
          {/* Icon */}
          <View style={[styles.modalIconContainer, { backgroundColor: getIconBgColor() }]}>
            {getIcon()}
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: finalTextColor }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: finalTextColor, opacity: 0.8 }]}>
            {message}
          </Text>

          {/* Hint */}
          {hint ? (
            <View style={styles.modalHintContainer}>
              <Ionicons name="information-circle" size={20} color="#17a2b8" />
              <Text style={styles.modalHint}>{hint}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 20 }}>
            {cancelText ? (
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: getButtonColor() + '80' }]}
                onPress={() => handleClose('cancel')}
              >
                <Text style={[styles.modalButtonText, { color: finalTextColor, opacity: 0.8 }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.modalButton, { flex: 1, backgroundColor: getButtonColor() }]}
              onPress={() => handleClose('confirm')}
            >
              <Text style={styles.modalButtonText}>
                {buttonText || getDefaultButtonText()}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
