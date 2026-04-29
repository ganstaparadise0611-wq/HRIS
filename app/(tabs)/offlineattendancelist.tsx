import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
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
import {
  getOfflineAttendanceRecords,
  getUnsyncedAttendanceRecords,
  syncAttendanceRecords,
  deleteOfflineAttendance,
  clearSyncedAttendance,
  isOnline,
  type OfflineAttendanceRecord,
  type SyncResult,
} from '../../constants/offline-storage';

const { width } = Dimensions.get('window');

export default function OfflineAttendanceList() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [records, setRecords] = useState<OfflineAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
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

  // Load records
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getOfflineAttendanceRecords();
      // Sort by newest first
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecords(all);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Sync to server
  const handleSync = async () => {
    const online = await isOnline();
    if (!online) {
      Alert.alert(
        'No Internet',
        'Please connect to WiFi or mobile data before syncing.',
        [{ text: 'OK' }]
      );
      return;
    }

    const unsynced = await getUnsyncedAttendanceRecords();
    if (unsynced.length === 0) {
      Alert.alert('All Synced', 'There are no Attendance Data that have not been sent.');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncAttendanceRecords();
      setSyncResult(result);
      setShowResultModal(true);
      await loadRecords();
    } catch (e) {
      Alert.alert('Sync Error', 'An error occurred during syncing. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Delete a single record
  const handleDelete = (record: OfflineAttendanceRecord) => {
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete this offline attendance record from ${record.displayTime}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteOfflineAttendance(record.id);
            await loadRecords();
          },
        },
      ]
    );
  };

  // Clear synced records
  const handleClearSynced = async () => {
    const syncedCount = records.filter(r => r.synced).length;
    if (syncedCount === 0) {
      Alert.alert('Nothing to Clear', 'There are no synced records to clear.');
      return;
    }

    Alert.alert(
      'Clear Synced Records',
      `Remove ${syncedCount} synced record${syncedCount > 1 ? 's' : ''} from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            await clearSyncedAttendance();
            await loadRecords();
          },
        },
      ]
    );
  };

  // Format date nicely
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const unsyncedCount = records.filter(r => !r.synced).length;

  // Render each record
  const renderRecord = ({ item, index }: { item: OfflineAttendanceRecord; index: number }) => (
    <Reanimated.View
      entering={FadeInDown.delay(index * 80).duration(400)}
      style={[styles.recordCard, dyn.card]}
    >
      <View style={styles.recordHeader}>
        <View style={styles.recordLeft}>
          <Text style={[styles.recordType, dyn.sub]}>Record time (offline)</Text>
          <Text style={[styles.recordDate, dyn.text]}>{formatDate(item.timestamp)}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
          <MaterialCommunityIcons name="close-box" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <View style={styles.recordBody}>
        <Text style={[styles.recordTime, { color: '#F27121' }]}>{item.displayTime}</Text>
        
        {item.latitude !== null && item.longitude !== null && (
          <View style={styles.coordsRow}>
            <Ionicons name="location" size={14} color={colors.subText} />
            <Text style={[styles.coordsText, dyn.sub]}>
              Latitude: {item.latitude?.toFixed(7)}  Longitude: {item.longitude?.toFixed(7)}
            </Text>
          </View>
        )}
      </View>

      {/* Sync status */}
      <View style={[styles.syncStatus, { 
        backgroundColor: item.synced 
          ? (item.syncError ? 'rgba(231,76,60,0.1)' : 'rgba(39,174,96,0.1)') 
          : 'rgba(243,156,18,0.1)' 
      }]}>
        <Ionicons
          name={item.synced ? (item.syncError ? 'close-circle' : 'checkmark-circle') : 'time-outline'}
          size={16}
          color={item.synced ? (item.syncError ? '#E74C3C' : '#27AE60') : '#F39C12'}
        />
        <Text
          style={[styles.syncStatusText, {
            color: item.synced ? (item.syncError ? '#E74C3C' : '#27AE60') : '#F39C12',
          }]}
        >
          {item.synced
            ? item.syncError
              ? `Failed: ${item.syncError}`
              : 'Synced to server'
            : 'Pending sync'}
        </Text>
      </View>
    </Reanimated.View>
  );

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#F27121' }]}>View Offline</Text>
        <TouchableOpacity onPress={handleClearSynced} style={{ padding: 10 }}>
          <Ionicons name="trash-outline" size={22} color={colors.subText} />
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={[styles.infoBanner, dyn.card]}>
        <Text style={[styles.infoBannerText, dyn.sub]}>
          {unsyncedCount > 0
            ? `The following are attendance data that have not been sent.`
            : `There are no Attendance Data that have not been sent.`}
        </Text>
        {unsyncedCount > 0 && (
          <Text style={[styles.infoBannerHint, dyn.sub]}>
            If there is a record submission error, please contact your HR department.
          </Text>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F27121" />
          <Text style={[styles.loadingText, dyn.sub]}>Loading records...</Text>
        </View>
      ) : records.length === 0 ? (
        <Reanimated.View style={[animatedStyle, styles.emptyContainer]}>
          <MaterialCommunityIcons name="cloud-check-outline" size={64} color={colors.subText} />
          <Text style={[styles.emptyText, dyn.sub]}>
            No offline attendance records found.
          </Text>
          <Text style={[styles.emptyHint, dyn.sub]}>
            Records saved while offline will appear here.
          </Text>
        </Reanimated.View>
      ) : (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sync Button (Fixed at bottom) */}
      {records.length > 0 && unsyncedCount > 0 && (
        <View style={[styles.bottomBar, dyn.card]}>
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: syncing ? '#95a5a6' : '#F27121' }]}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.85}
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

      {/* Sync Result Modal */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, dyn.card]}>
            <View style={[styles.modalIconBg, {
              backgroundColor: syncResult?.failCount === 0 ? '#d4edda' : '#fff3cd',
            }]}>
              {syncResult?.failCount === 0 ? (
                <Ionicons name="checkmark-circle" size={60} color="#27AE60" />
              ) : (
                <Ionicons name="warning" size={60} color="#F39C12" />
              )}
            </View>

            <Text style={[styles.modalTitle, dyn.text]}>
              {syncResult?.failCount === 0 ? 'Sync Complete!' : 'Sync Completed with Errors'}
            </Text>

            <View style={styles.modalStats}>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, dyn.sub]}>Successfully Sent:</Text>
                <Text style={[styles.statValue, { color: '#27AE60' }]}>
                  {syncResult?.successCount || 0}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, dyn.sub]}>Failed to Send:</Text>
                <Text style={[styles.statValue, { color: '#E74C3C' }]}>
                  {syncResult?.failCount || 0}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#F27121' }]}
              onPress={() => setShowResultModal(false)}
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

  infoBanner: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
  },
  infoBannerText: { fontSize: 14, lineHeight: 20 },
  infoBannerHint: { fontSize: 13, marginTop: 6, fontStyle: 'italic' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptyHint: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  listContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Record card
  recordCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recordLeft: { flex: 1 },
  recordType: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  recordDate: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  deleteButton: { padding: 4 },

  recordBody: { marginBottom: 10 },
  recordTime: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  coordsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  coordsText: { fontSize: 12 },

  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  syncStatusText: { fontSize: 13, fontWeight: '600', flex: 1 },

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
  syncButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    elevation: 10,
  },
  modalIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },

  modalStats: { width: '100%', marginBottom: 20 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  statLabel: { fontSize: 15, fontWeight: '500' },
  statValue: { fontSize: 15, fontWeight: '800' },

  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 50,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
