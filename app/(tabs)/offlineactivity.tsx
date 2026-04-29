import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { useTheme } from './ThemeContext';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import {
  saveOfflineActivity,
  getOfflineActivityRecords,
  getUnsyncedActivityRecords,
  syncActivityRecords,
  deleteOfflineActivity,
  clearSyncedActivities,
  isOnline,
  type OfflineActivityRecord,
  type SyncResult,
} from '../../constants/offline-storage';

const { width } = Dimensions.get('window');

export default function OfflineActivity() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const { visible, config, showAlert, hideAlert } = useCustomAlert();

  // Form state
  const [task, setTask] = useState('');
  const [locationText, setLocationText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Records state
  const [records, setRecords] = useState<OfflineActivityRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // View mode: 'form' or 'list'
  const [viewMode, setViewMode] = useState<'form' | 'list'>('form');

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    input: { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', color: colors.text, borderColor: colors.border },
  };

  // Entrance animation
  const fadeAnim = useSharedValue(0);
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [20, 0]) }],
  }));

  // Auto-fill location from GPS
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        try {
          const results = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (results && results.length > 0) {
            const g = results[0];
            const pieces = [g.name, g.street, g.subregion || g.city].filter(Boolean);
            if (pieces.length > 0 && !locationText) {
              setLocationText(pieces.join(', '));
            }
          }
        } catch {
          // Reverse geocode might not work offline
          if (!locationText) {
            setLocationText(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
          }
        }
      } catch {}
    };
    getLocation();
  }, []);

  // Load records
  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const all = await getOfflineActivityRecords();
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecords(all);
    } catch {
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Take photo
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'error', title: '❌ Permission Denied', message: 'Camera access is needed to take photos.' });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        if (asset.base64) setPhotoBase64(asset.base64);
      }
    } catch {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to take photo.' });
    }
  };

  // Pick image from gallery
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ type: 'error', title: '❌ Permission Denied', message: 'Gallery access is needed.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        if (asset.base64) setPhotoBase64(asset.base64);
      }
    } catch {
      showAlert({ type: 'error', title: '❌ Error', message: 'Failed to pick image.' });
    }
  };

  // Submit activity offline
  const handleSubmit = async () => {
    if (!task.trim()) {
      showAlert({ type: 'warning', title: '⚠️ Missing Information', message: 'Please enter a task description.' });
      return;
    }
    if (!locationText.trim()) {
      showAlert({ type: 'warning', title: '⚠️ Missing Information', message: 'Please enter a location.' });
      return;
    }

    setSubmitting(true);
    try {
      const empId = await AsyncStorage.getItem('emp_id');
      if (!empId) {
        showAlert({ type: 'error', title: '❌ Error', message: 'Employee ID not found. Please log in again.' });
        return;
      }

      await saveOfflineActivity({
        empId,
        taskDescription: task.trim(),
        location: locationText.trim(),
        photoBase64: photoBase64,
        fileType: photoBase64 ? 'image/jpeg' : null,
        timestamp: new Date().toISOString(),
      });

      showAlert({
        type: 'success',
        title: '✅ Saved Offline',
        message: 'Activity will be synced when you reconnect.',
        onClose: () => {
          setTask('');
          setLocationText('');
          setPhotoUri(null);
          setPhotoBase64(null);
          loadRecords();
        }
      });
    } catch {
      showAlert({ type: 'error', title: '❌ Error', message: 'Could not save the activity locally.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Sync activities
  const handleSync = async () => {
    const online = await isOnline();
    if (!online) {
      showAlert({ type: 'warning', title: '⚠️ No Internet', message: 'Please connect to the internet before syncing.' });
      return;
    }

    const unsynced = await getUnsyncedActivityRecords();
    if (unsynced.length === 0) {
      showAlert({ type: 'info', title: 'ℹ️ All Synced', message: 'All activity records have been sent to the server.' });
      return;
    }

    setSyncing(true);
    try {
      const result = await syncActivityRecords();
      setSyncResult(result);
      setShowSyncResult(true);
      await loadRecords();
    } catch {
      showAlert({ type: 'error', title: '❌ Sync Error', message: 'An error occurred during syncing.' });
    } finally {
      setSyncing(false);
    }
  };

  const unsyncedCount = records.filter(r => !r.synced).length;

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <CustomAlert visible={visible} {...config} onClose={hideAlert} onConfirm={config.onClose} onCancel={config.onCancel} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Offline Activity</Text>
        <View style={styles.offlineBadge}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#E74C3C" />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'form' && styles.tabActive]}
          onPress={() => setViewMode('form')}
        >
          <Text style={[styles.tabText, viewMode === 'form' && styles.tabTextActive]}>
            New Record
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'list' && styles.tabActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.tabText, viewMode === 'list' && styles.tabTextActive]}>
            History ({records.length})
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'form' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Reanimated.View style={animatedStyle}>
            {/* Form Card */}
            <View style={[styles.formCard, dyn.card]}>
              {/* Photo section */}
              <TouchableOpacity
                style={[styles.photoUpload, dyn.input, photoUri && styles.photoUploadFilled]}
                onPress={handleTakePhoto}
                onLongPress={handlePickImage}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera-plus" size={30} color={colors.subText} />
                    <Text style={[styles.photoHint, dyn.sub]}>Tap to take photo · Long press for gallery</Text>
                  </>
                )}
              </TouchableOpacity>
              {photoUri && (
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
                >
                  <Ionicons name="close-circle" size={18} color="#E74C3C" />
                  <Text style={{ color: '#E74C3C', fontSize: 13, fontWeight: '600' }}>Remove Photo</Text>
                </TouchableOpacity>
              )}

              {/* Task description */}
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

              {/* Location */}
              <Text style={[styles.label, dyn.sub]}>Location</Text>
              <TextInput
                style={[styles.input, dyn.input]}
                placeholder="Where are you?"
                placeholderTextColor={colors.subText}
                value={locationText}
                onChangeText={setLocationText}
              />

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save-outline" size={20} color="#FFF" />
                    <Text style={styles.submitText}>SAVE OFFLINE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        </ScrollView>
      ) : (
        // Activity List
        <>
          {recordsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F27121" />
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="text-box-check-outline" size={56} color={colors.subText} />
              <Text style={[styles.emptyText, dyn.sub]}>No offline activity records</Text>
            </View>
          ) : (
            <FlatList
              data={records}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <Reanimated.View
                  entering={FadeInDown.delay(index * 60).duration(400)}
                  style={[styles.activityCard, dyn.card]}
                >
                  <View style={styles.activityHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityTask, dyn.text]} numberOfLines={2}>
                        {item.taskDescription}
                      </Text>
                      <Text style={[styles.activityMeta, dyn.sub]}>
                        {formatTime(item.timestamp)} · {formatDate(item.timestamp)} · 📍 {item.location}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        showAlert({
                          type: 'warning',
                          title: '🗑️ Delete?',
                          message: 'Remove this offline activity record?',
                          buttonText: 'Delete',
                          cancelText: 'Cancel',
                          onConfirm: async () => {
                            await deleteOfflineActivity(item.id);
                            await loadRecords();
                          }
                        });
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.activitySyncBadge, {
                    backgroundColor: item.synced
                      ? (item.syncError ? 'rgba(231,76,60,0.1)' : 'rgba(39,174,96,0.1)')
                      : 'rgba(243,156,18,0.1)',
                  }]}>
                    <Ionicons
                      name={item.synced ? (item.syncError ? 'close-circle' : 'checkmark-circle') : 'time-outline'}
                      size={14}
                      color={item.synced ? (item.syncError ? '#E74C3C' : '#27AE60') : '#F39C12'}
                    />
                    <Text style={{
                      color: item.synced ? (item.syncError ? '#E74C3C' : '#27AE60') : '#F39C12',
                      fontSize: 12,
                      fontWeight: '600',
                    }}>
                      {item.synced ? (item.syncError ? 'Sync Failed' : 'Synced') : 'Pending'}
                    </Text>
                  </View>
                </Reanimated.View>
              )}
            />
          )}

          {/* Sync button */}
          {unsyncedCount > 0 && (
            <View style={[styles.bottomBar, dyn.card]}>
              <TouchableOpacity
                style={[styles.syncButton, { backgroundColor: syncing ? '#95a5a6' : '#F27121' }]}
                onPress={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.syncButtonText}>SENDING...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
                    <Text style={styles.syncButtonText}>SEND TO SERVER</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Sync Result Modal */}
      <Modal visible={showSyncResult} transparent animationType="fade" onRequestClose={() => setShowSyncResult(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, dyn.card]}>
            <Ionicons
              name={syncResult?.failCount === 0 ? 'checkmark-circle' : 'warning'}
              size={60}
              color={syncResult?.failCount === 0 ? '#27AE60' : '#F39C12'}
            />
            <Text style={[styles.modalTitle, dyn.text, { marginTop: 16 }]}>
              Sent: {syncResult?.successCount || 0}. Failed: {syncResult?.failCount || 0}.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#F27121' }]}
              onPress={() => setShowSyncResult(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  offlineBadgeText: { color: '#E74C3C', fontWeight: '700', fontSize: 13 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 14,
    padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  tabActive: { backgroundColor: '#F27121' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#FFF' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Form
  formCard: {
    borderRadius: 28,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  photoUpload: {
    height: 100,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoUploadFilled: { borderStyle: 'solid', padding: 0 },
  photoPreview: { width: '100%', height: '100%', borderRadius: 20 },
  photoHint: { marginTop: 4, fontSize: 12 },
  removePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    alignSelf: 'center',
  },
  label: { marginBottom: 8, fontWeight: '600', fontSize: 14 },
  input: { padding: 15, borderRadius: 20, borderWidth: 1, marginBottom: 16, fontSize: 15 },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#27AE60',
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  // Activity list
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', marginTop: 12 },

  activityCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  activityHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  activityTask: { fontSize: 15, fontWeight: '700' },
  activityMeta: { fontSize: 12, marginTop: 4 },
  activitySyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  syncButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    gap: 10,
    shadowColor: '#F27121',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
  },
  syncButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '85%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 14,
    marginTop: 20,
  },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
