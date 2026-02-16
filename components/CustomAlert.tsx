import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message: string;
  hint?: string;
  buttonText?: string;
  onClose: () => void;
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
  onClose,
  backgroundColor = '#1c1c1e',
  textColor = '#ffffff',
}: CustomAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

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

  const handleClose = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
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
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: scaleAnim }], backgroundColor },
          ]}
        >
          {/* Icon */}
          <View style={[styles.modalIconContainer, { backgroundColor: getIconBgColor() }]}>
            {getIcon()}
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: textColor }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: textColor, opacity: 0.8 }]}>
            {message}
          </Text>

          {/* Hint */}
          {hint ? (
            <View style={styles.modalHintContainer}>
              <Ionicons name="information-circle" size={20} color="#17a2b8" />
              <Text style={styles.modalHint}>{hint}</Text>
            </View>
          ) : null}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: getButtonColor() }]}
            onPress={handleClose}
          >
            <Text style={styles.modalButtonText}>
              {buttonText || getDefaultButtonText()}
            </Text>
          </TouchableOpacity>
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
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
