import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendUrl, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../constants/backend-config';
import { recheckNetwork } from '../../constants/network-detector';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from './ThemeContext';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming, Easing, interpolate } from 'react-native-reanimated';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';

interface Activity {
  activity_id: number;
  emp_id: number;
  task_description: string;
  location: string;
  photo_url?: string | null;
  photo_data?: string | null;
  file_type?: string | null;
  status: string;
  created_at: string;
}

function isImageAttachment(fileType?: string | null): boolean {
  return !fileType || fileType.startsWith('image/');
}

function getFileDisplayName(fileType?: string | null): string {
  if (!fileType) return 'Document';
  const m = fileType.toLowerCase();
  if (m.includes('pdf')) return 'PDF Document';
  if (m.includes('word') || m.includes('msword') || m.includes('document')) return 'Word Document';
  if (m.includes('excel') || m.includes('spreadsheet')) return 'Excel Document';
  if (m.includes('text/plain')) return 'Text File';
  if (m.includes('image/')) return 'Image';
  return 'Document';
}

function getFileExtension(fileType?: string | null): string {
  if (!fileType) return '.bin';
  const m = fileType.toLowerCase();
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('word') || m.includes('msword')) return '.doc';
  if (m.includes('document') && m.includes('officedocument')) return '.docx';
  if (m.includes('excel') || m.includes('spreadsheet')) return '.xls';
  if (m.includes('text/plain')) return '.txt';
  return '.bin';
}

export default function UserActivity() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  
  const [task, setTask] = useState('');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [empId, setEmpId] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [detailPhotoError, setDetailPhotoError] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);

  // Reset photo error when detail modal opens
  useEffect(() => {
    if (selectedActivity) setDetailPhotoError(false);
  }, [selectedActivity]);

  const openAttachedFile = async () => {
    if (!selectedActivity) return;
    const raw = selectedActivity.photo_url || selectedActivity.photo_data || '';
    const b64 = typeof raw === 'string' ? (raw.startsWith('data:') ? raw.split(',')[1] || raw : raw) : '';
    if (!b64 || b64.length < 100) return;
    const mime = selectedActivity.file_type || 'application/octet-stream';
    const ext = getFileExtension(mime);
    const name = `activity_evidence${ext}`;
    const b64Clean = b64.replace(/\s/g, '');
    try {
      setOpeningFile(true);
      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!dir) throw new Error('No storage directory');
      const filePath = `${dir}${name}`;
      await FileSystem.writeAsStringAsync(filePath, b64Clean, { encoding: FileSystem.EncodingType.Base64 });
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(filePath);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mime,
        });
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(filePath, { mimeType: mime });
        } else {
          const { Linking } = await import('react-native');
          await Linking.openURL(`file://${filePath}`);
        }
      }
    } catch (e) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Could not open file. Try opening from another app.' });
    } finally {
      setOpeningFile(false);
    }
  };

  // DYNAMIC STYLES
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    input: { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', color: colors.text, borderColor: colors.border },
    border: { borderColor: colors.border },
    iconColor: isDark ? "#FFF" : "#333"
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

  useEffect(() => {
    loadEmpIdAndActivities();
  }, []);

  useEffect(() => {
    const checkNetworkAndRedirect = async () => {
      try {
        const state = await NetInfo.fetch();
        if (!state.isConnected || state.isInternetReachable === false) {
          router.replace('/(tabs)/offlineactivity' as any);
          return;
        }
        await recheckNetwork();
      } catch {
        recheckNetwork().catch(() => {});
      }
    };
    checkNetworkAndRedirect();
  }, []);

  const loadEmpIdAndActivities = async () => {
    try {
      setLoading(true);
      
      // Try to get emp_id from AsyncStorage first
      let currentEmpId = await AsyncStorage.getItem('emp_id');
      
      if (!currentEmpId) {
        // If not found, resolve it from log_id
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          currentEmpId = await resolveEmpId(parseInt(userId, 10));
        }
      }
      
      if (currentEmpId) {
        const empIdNum = parseInt(currentEmpId, 10);
        setEmpId(empIdNum);
        await loadActivities(empIdNum);
      } else {
        showAlert({ type: 'error', title: '❌ Error', message: 'Unable to load employee ID. Please log in again.' });
      }
    } catch (_error) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to load activities' });
    } finally {
      setLoading(false);
    }
  };

  const resolveEmpId = async (logId: number): Promise<string | null> => {
    try {
      // Try RPC function first
      const rpcRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_emp_id_by_log_id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ p_log_id: logId }),
        }
      );
      
      if (rpcRes.ok) {
        const rpcResult = await rpcRes.json();
        if (rpcResult && rpcResult.emp_id) {
          await AsyncStorage.setItem('emp_id', String(rpcResult.emp_id));
          return String(rpcResult.emp_id);
        }
      }
      
      // Fallback: direct query
      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logId}&select=emp_id`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      
      if (empRes.ok) {
        const employees = await empRes.json();
        if (employees && employees.length > 0 && employees[0].emp_id) {
          const resolvedEmpId = String(employees[0].emp_id);
          await AsyncStorage.setItem('emp_id', resolvedEmpId);
          return resolvedEmpId;
        }
      }
    } catch (_e) {
      // Resolve failed; avoid logging to reduce console noise
    }
    return null;
  };

  const loadActivities = async (empIdNum: number) => {
    try {
      const baseUrl = getBackendUrl();
      const response = await fetch(
        `${baseUrl}/user_activities.php?emp_id=${empIdNum}&today_only=true`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      const result = await response.json();

      if (result && result.ok === true) {
        setActivities(Array.isArray(result.data) ? result.data : []);
        return;
      }

      if (!response.ok) {
        setActivities([]);
        return;
      }

      setActivities([]);
    } catch (_error) {
      setActivities([]);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'error', title: '❌ Permission Denied', message: 'We need camera access to take photo evidence.' });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        // Clear any previously attached generic file
        setAttachmentUri(null);
        setAttachmentName(null);
        setAttachmentType(null);
        if (asset.base64) {
          setPhotoBase64(asset.base64);
        }
      }
      setShowAttachModal(false);
    } catch (_error) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to take photo' });
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'error', title: '❌ Permission Denied', message: 'We need camera roll permissions to add photo evidence.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        // Clear any previously attached generic file
        setAttachmentUri(null);
        setAttachmentName(null);
        setAttachmentType(null);
        if (asset.base64) {
          setPhotoBase64(asset.base64);
        }
      }
    } catch (_error) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to pick image' });
    }
  };

  const showPhotoOptions = () => {
    setShowAttachModal(true);
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets || !res.assets[0]) {
        return;
      }
      const file = res.assets[0];
      setAttachmentUri(file.uri);
      setAttachmentName(file.name ?? 'attachment');
      setAttachmentType(file.mimeType ?? 'application/octet-stream');
      // Clear photo so this activity uses the file instead
      setPhotoUri(null);
      setPhotoBase64(null);
      setShowAttachModal(false);
    } catch (_error) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to pick file' });
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#f39c12';
      case 'approved':
      case 'synced':
        return '#2ecc71';
      case 'rejected':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const handleSubmit = async () => {
    if (!task.trim()) {
      showAlert({ type: 'warning', title: '⚠️ Missing Information', message: 'Please enter a task description' });
      return;
    }

    if (!location.trim()) {
      showAlert({ type: 'warning', title: '⚠️ Missing Information', message: 'Please enter a location' });
      return;
    }

    if (!empId) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Employee ID not found. Please try again.' });
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('emp_id', empId.toString());
      formData.append('task_description', task.trim());
      formData.append('location', location.trim());

      if (attachmentUri) {
        formData.append('file', {
          uri: attachmentUri,
          name: attachmentName || 'attachment',
          type: attachmentType || 'application/octet-stream',
        } as any);
      } else if (photoUri) {
        formData.append('photo', {
          uri: photoUri,
          name: 'activity_photo.jpg',
          type: 'image/jpeg',
        } as any);
      }

      const response = await fetch(`${getBackendUrl()}/user_activities.php`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const result = await response.json();

      if (result.ok) {
        showAlert({
          type: 'success',
          title: '✅ Success',
          message: 'Activity recorded successfully!',
          onClose: () => {
            // Reset form
            setTask('');
            setLocation('');
            setPhotoUri(null);
            setPhotoBase64(null);
            setAttachmentUri(null);
            setAttachmentName(null);
            setAttachmentType(null);
            // Reload activities
            if (empId) {
              loadActivities(empId);
            }
          }
        });
      } else {
        showAlert({ type: 'error', title: '❌ Error', message: result.message || 'Failed to save activity' });
      }
    } catch (_error) {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to submit activity. Please check your connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
        <CustomAlert visible={visible} {...config} onClose={hideAlert} onConfirm={config.onClose} onCancel={config.onCancel} />
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={[styles.header, dyn.border]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dyn.text]}>Activity Record</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F27121" />
          <Text style={[styles.loadingText, dyn.sub]}>Loading activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <CustomAlert visible={visible} {...config} onClose={hideAlert} onConfirm={config.onClose} onCancel={config.onCancel} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Activity Record</Text>
        <TouchableOpacity onPress={loadEmpIdAndActivities}>
          <Ionicons name="refresh" size={24} color="#F27121" />
        </TouchableOpacity>
      </View>

      <Reanimated.View style={[animatedStyle, { flex: 1 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* NEW ENTRY */}
        <Text style={[styles.sectionTitle, dyn.sub]}>New Entry</Text>
        <View style={[styles.formCard, dyn.card]}>
            <TouchableOpacity 
              style={[styles.photoUpload, dyn.input, photoUri && styles.photoUploadFilled]} 
              onPress={showPhotoOptions}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera-plus" size={30} color={colors.subText} />
                  <Text style={[styles.photoText, dyn.sub]}>
                    {attachmentName ? `Attached: ${attachmentName}` : 'Take Photo, Choose from Gallery, or Attach File'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.label, dyn.sub]}>Task Description</Text>
            <TextInput 
                style={[styles.input, dyn.input]} 
                placeholder="What are you working on?" 
                placeholderTextColor={colors.subText}
                value={task}
                onChangeText={setTask}
                multiline
                numberOfLines={3}
            />

            <Text style={[styles.label, dyn.sub]}>Location</Text>
            <TextInput 
                style={[styles.input, dyn.input]} 
                placeholder="Where are you?" 
                placeholderTextColor={colors.subText}
                value={location}
                onChangeText={setLocation}
            />

            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>SUBMIT RECORD</Text>
              )}
            </TouchableOpacity>
        </View>

        {/* HISTORY */}
        <Text style={[styles.sectionTitle, dyn.sub]}>Today's History</Text>
        
        {activities.length === 0 ? (
          <View style={[styles.emptyContainer, dyn.card]}>
            <Ionicons name="document-text-outline" size={48} color={colors.subText} />
            <Text style={[styles.emptyText, dyn.sub]}>No activities recorded today</Text>
          </View>
        ) : (
          activities.map((item, index) => (
            <View key={item.activity_id} style={styles.activityItem}>
              <View style={styles.timelineContainer}>
                <View style={styles.timelineDot} />
                {index < activities.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                )}
              </View>

              <TouchableOpacity
                style={[styles.activityContent, dyn.card]}
                onPress={() => setSelectedActivity(item)}
                activeOpacity={0.8}
              >
                <View style={styles.activityHeader}>
                  <Text style={styles.activityTime}>{formatTime(item.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Ionicons 
                      name={item.status.toLowerCase() === 'pending' ? 'time-outline' : 'checkmark-circle'} 
                      size={12} 
                      color={getStatusColor(item.status)} 
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.activityTitle, dyn.text]} numberOfLines={1}>{item.task_description}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={12} color={colors.subText} />
                  <Text style={[styles.activityLocation, dyn.sub]} numberOfLines={1}>{item.location}</Text>
                </View>
                {(item.photo_url || item.photo_data) ? (
                  isImageAttachment(item.file_type) ? (
                    <View style={styles.photoThumbnail}>
                      <Image 
                        source={{ uri: (() => {
                          const raw = item.photo_url || item.photo_data || '';
                          const b64 = typeof raw === 'string' && raw.startsWith('data:') ? raw.split(',')[1] || raw : raw;
                          return `data:image/jpeg;base64,${b64}`;
                        })() }} 
                        style={styles.activityPhotoThumb}
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    <View style={styles.fileThumbnail}>
                      <MaterialCommunityIcons name="file-document-outline" size={28} color={colors.subText} />
                      <Text style={[styles.fileThumbnailText, dyn.sub]} numberOfLines={1}>
                        {getFileDisplayName(item.file_type)}
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialCommunityIcons name="camera-plus" size={20} color={colors.subText} />
                    <Text style={[styles.photoPlaceholderText, dyn.sub]}>Tap for details</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Attachment / Photo Picker Modal */}
        <Modal
          visible={showAttachModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAttachModal(false)}
        >
          <TouchableOpacity
            style={styles.attachOverlay}
            activeOpacity={1}
            onPress={() => setShowAttachModal(false)}
          >
            <TouchableOpacity
              style={[styles.attachSheet, dyn.card]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.attachTitle, dyn.text]}>Add Evidence</Text>
              <TouchableOpacity style={styles.attachOption} onPress={takePhoto}>
                <MaterialCommunityIcons name="camera-outline" size={22} color={dyn.iconColor} />
                <Text style={[styles.attachOptionText, dyn.text]}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={pickImage}>
                <MaterialCommunityIcons name="image-outline" size={22} color={dyn.iconColor} />
                <Text style={[styles.attachOptionText, dyn.text]}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={pickFile}>
                <MaterialCommunityIcons name="file-upload-outline" size={22} color={dyn.iconColor} />
                <Text style={[styles.attachOptionText, dyn.text]}>Attach Document / File</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachCancelButton, { borderColor: colors.border }]}
                onPress={() => setShowAttachModal(false)}
              >
                <Text style={[styles.attachCancelText, dyn.sub]}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Activity Detail Modal */}
        <Modal
          visible={selectedActivity !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedActivity(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedActivity(null)}
          >
            <TouchableOpacity
              style={[styles.modalContent, dyn.card]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
              {selectedActivity && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, dyn.text]}>{selectedActivity.task_description}</Text>
                    <TouchableOpacity onPress={() => setSelectedActivity(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={28} color={colors.subText} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.modalDetails}>
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="time-outline" size={18} color={colors.subText} />
                      <Text style={[styles.modalDetailText, dyn.text]}>{formatTime(selectedActivity.created_at)} • {formatDate(selectedActivity.created_at)}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="location-sharp" size={18} color={colors.subText} />
                      <Text style={[styles.modalDetailText, dyn.text]}>{selectedActivity.location}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="information-circle-outline" size={18} color={colors.subText} />
                      <Text style={[styles.modalDetailText, { color: getStatusColor(selectedActivity.status) }]}>
                        Status: {selectedActivity.status.charAt(0).toUpperCase() + selectedActivity.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  {(() => {
                    const raw = selectedActivity.photo_url || selectedActivity.photo_data || '';
                    const b64 = typeof raw === 'string' ? (raw.startsWith('data:') ? raw.split(',')[1] || raw : raw) : '';
                    const hasData = b64 && b64.length > 100;
                    const isImage = isImageAttachment(selectedActivity.file_type);

                    if (!hasData) {
                      return (
                        <View style={styles.modalNoPhoto}>
                          <MaterialCommunityIcons name="image-off-outline" size={40} color={colors.subText} />
                          <Text style={[styles.modalNoPhotoText, dyn.sub]}>No photo or file for this activity</Text>
                        </View>
                      );
                    }

                    if (hasData && !isImage) {
                      return (
                        <View style={styles.modalFileContainer}>
                          <MaterialCommunityIcons name="file-document-outline" size={48} color={colors.subText} />
                          <Text style={[styles.modalFileLabel, dyn.text]}>{getFileDisplayName(selectedActivity.file_type)}</Text>
                          <TouchableOpacity
                            style={[styles.modalViewFileButton, { backgroundColor: '#F27121' }]}
                            onPress={openAttachedFile}
                            disabled={openingFile}
                          >
                            {openingFile ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <Text style={styles.modalViewFileText}>View File</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    if (detailPhotoError) {
                      return (
                        <View style={styles.modalNoPhoto}>
                          <MaterialCommunityIcons name="image-broken-variant" size={40} color={colors.subText} />
                          <Text style={[styles.modalNoPhotoText, dyn.sub]}>Could not load photo</Text>
                        </View>
                      );
                    }

                    return (
                      <View style={styles.modalPhotoContainer}>
                        <Image 
                          source={{ uri: `data:${selectedActivity.file_type || 'image/jpeg'};base64,${b64}` }} 
                          style={styles.modalPhoto}
                          resizeMode="contain"
                          onError={() => setDetailPhotoError(true)}
                        />
                      </View>
                    );
                  })()}
                  <TouchableOpacity
                    style={[styles.modalCloseButton, { backgroundColor: colors.border }]}
                    onPress={() => setSelectedActivity(null)}
                  >
                    <Text style={[styles.modalCloseText, dyn.text]}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </ScrollView>
      </Reanimated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 5, width: 34 },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  formCard: { borderRadius: 24, padding: 20, marginBottom: 30, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15 },
  photoUpload: { height: 100, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  photoUploadFilled: { borderStyle: 'solid', padding: 0 },
  photoPreview: { width: '100%', height: '100%', borderRadius: 16 },
  photoText: { marginTop: 5, fontSize: 12 },
  label: { marginBottom: 8, fontWeight: '600' },
  input: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  submitButton: { backgroundColor: '#F27121', padding: 15, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  activityItem: { flexDirection: 'row', marginBottom: 12 },
  timelineContainer: { alignItems: 'center', marginRight: 12, width: 18 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F27121', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: -4 },
  activityContent: { flex: 1, borderRadius: 24, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' },
  activityTime: { color: '#F27121', fontWeight: 'bold', fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 10, marginLeft: 3, fontWeight: '600' },
  activityTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  activityLocation: { fontSize: 12, marginLeft: 4, flex: 1 },
  photoThumbnail: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  activityPhotoThumb: { width: '100%', height: 72, borderRadius: 16 },
  fileThumbnail: { marginTop: 8, height: 56, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(128,128,128,0.4)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  fileThumbnailText: { marginLeft: 10, fontSize: 13, flex: 1 },
  photoPlaceholder: { marginTop: 8, height: 56, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(128,128,128,0.4)', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  photoPlaceholderText: { fontSize: 12, marginLeft: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 12 },
  modalDetails: { marginBottom: 16 },
  modalDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modalDetailText: { fontSize: 15, marginLeft: 10, flex: 1 },
  modalPhotoContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalPhoto: { width: '100%', height: 220, borderRadius: 16 },
  modalNoPhoto: { marginBottom: 16, padding: 32, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(128,128,128,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalNoPhotoText: { marginTop: 10, fontSize: 14 },
  modalFileContainer: { marginBottom: 16, padding: 24, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(128,128,128,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalFileLabel: { marginTop: 12, fontSize: 15, fontWeight: '600' },
  modalViewFileButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', minWidth: 140 },
  modalViewFileText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  modalCloseButton: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: '600' },
  attachOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  attachSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  attachTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  attachOptionText: {
    marginLeft: 12,
    fontSize: 15,
  },
  attachCancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  attachCancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center', borderRadius: 24, marginTop: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15 },
  emptyText: { marginTop: 10, fontSize: 14 },
});
