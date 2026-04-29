/**
 * Offline Storage Engine
 * 
 * Handles local storage of attendance and activity records when offline.
 * Provides queue management and sync capabilities.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getBackendUrl } from './backend-config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfflineAttendanceRecord {
  id: string;                    // Unique local ID (timestamp-based)
  userId: string;                // log_id from AsyncStorage
  empId: string;                 // emp_id
  action: 'clock_in' | 'clock_out';
  timestamp: string;             // ISO string of when the action happened
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:mm:ss (24h)
  displayTime: string;           // e.g. "08:30 AM"
  latitude: number | null;
  longitude: number | null;
  photoBase64: string | null;    // Selfie photo if taken
  synced: boolean;
  syncError?: string;
  userName?: string;
}

export interface OfflineActivityRecord {
  id: string;
  empId: string;
  taskDescription: string;
  location: string;
  photoBase64: string | null;
  fileType: string | null;
  timestamp: string;
  synced: boolean;
  syncError?: string;
}

// ── Storage Keys ─────────────────────────────────────────────────────────────

const OFFLINE_ATTENDANCE_KEY = '@offline_attendance_records';
const OFFLINE_ACTIVITY_KEY = '@offline_activity_records';

// ── Attendance Functions ─────────────────────────────────────────────────────

/**
 * Save an offline attendance record to local storage
 */
export async function saveOfflineAttendance(record: Omit<OfflineAttendanceRecord, 'id' | 'synced'>): Promise<OfflineAttendanceRecord> {
  const newRecord: OfflineAttendanceRecord = {
    ...record,
    id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    synced: false,
  };

  const existing = await getOfflineAttendanceRecords();
  existing.push(newRecord);
  await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(existing));
  
  return newRecord;
}

/**
 * Get all offline attendance records
 */
export async function getOfflineAttendanceRecords(): Promise<OfflineAttendanceRecord[]> {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_ATTENDANCE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get only unsynced attendance records
 */
export async function getUnsyncedAttendanceRecords(): Promise<OfflineAttendanceRecord[]> {
  const all = await getOfflineAttendanceRecords();
  return all.filter(r => !r.synced);
}

/**
 * Mark an attendance record as synced
 */
export async function markAttendanceSynced(id: string, error?: string): Promise<void> {
  const records = await getOfflineAttendanceRecords();
  const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) {
    records[idx].synced = true;
    if (error) records[idx].syncError = error;
    await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(records));
  }
}

/**
 * Delete a specific attendance record
 */
export async function deleteOfflineAttendance(id: string): Promise<void> {
  const records = await getOfflineAttendanceRecords();
  const filtered = records.filter(r => r.id !== id);
  await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(filtered));
}

/**
 * Clear all synced attendance records
 */
export async function clearSyncedAttendance(): Promise<void> {
  const records = await getOfflineAttendanceRecords();
  const unsynced = records.filter(r => !r.synced);
  await AsyncStorage.setItem(OFFLINE_ATTENDANCE_KEY, JSON.stringify(unsynced));
}

// ── Activity Functions ───────────────────────────────────────────────────────

/**
 * Save an offline activity record to local storage
 */
export async function saveOfflineActivity(record: Omit<OfflineActivityRecord, 'id' | 'synced'>): Promise<OfflineActivityRecord> {
  const newRecord: OfflineActivityRecord = {
    ...record,
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    synced: false,
  };

  const existing = await getOfflineActivityRecords();
  existing.push(newRecord);
  await AsyncStorage.setItem(OFFLINE_ACTIVITY_KEY, JSON.stringify(existing));
  
  return newRecord;
}

/**
 * Get all offline activity records
 */
export async function getOfflineActivityRecords(): Promise<OfflineActivityRecord[]> {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_ACTIVITY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get only unsynced activity records
 */
export async function getUnsyncedActivityRecords(): Promise<OfflineActivityRecord[]> {
  const all = await getOfflineActivityRecords();
  return all.filter(r => !r.synced);
}

/**
 * Mark an activity record as synced
 */
export async function markActivitySynced(id: string, error?: string): Promise<void> {
  const records = await getOfflineActivityRecords();
  const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) {
    records[idx].synced = true;
    if (error) records[idx].syncError = error;
    await AsyncStorage.setItem(OFFLINE_ACTIVITY_KEY, JSON.stringify(records));
  }
}

/**
 * Delete a specific activity record
 */
export async function deleteOfflineActivity(id: string): Promise<void> {
  const records = await getOfflineActivityRecords();
  const filtered = records.filter(r => r.id !== id);
  await AsyncStorage.setItem(OFFLINE_ACTIVITY_KEY, JSON.stringify(filtered));
}

/**
 * Clear all synced activity records
 */
export async function clearSyncedActivities(): Promise<void> {
  const records = await getOfflineActivityRecords();
  const unsynced = records.filter(r => !r.synced);
  await AsyncStorage.setItem(OFFLINE_ACTIVITY_KEY, JSON.stringify(unsynced));
}

// ── Sync Engine ──────────────────────────────────────────────────────────────

export interface SyncResult {
  totalRecords: number;
  successCount: number;
  failCount: number;
  errors: string[];
}

/**
 * Check if the device currently has internet connectivity
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Sync all unsynced attendance records to the server
 */
export async function syncAttendanceRecords(): Promise<SyncResult> {
  const result: SyncResult = { totalRecords: 0, successCount: 0, failCount: 0, errors: [] };
  
  const online = await isOnline();
  if (!online) {
    result.errors.push('No internet connection');
    return result;
  }

  const unsynced = await getUnsyncedAttendanceRecords();
  result.totalRecords = unsynced.length;

  if (unsynced.length === 0) return result;

  const backendUrl = getBackendUrl();

  for (const record of unsynced) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${backendUrl}/sync-offline-attendance.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          user_id: record.userId,
          emp_id: record.empId,
          action: record.action,
          date: record.date,
          time: record.time,
          latitude: record.latitude,
          longitude: record.longitude,
          photo_base64: record.photoBase64,
          offline_id: record.id,
          recorded_at: record.timestamp,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        await markAttendanceSynced(record.id);
        result.successCount++;
      } else {
        const errMsg = data.message || `Server error: ${res.status}`;
        await markAttendanceSynced(record.id, errMsg);
        result.failCount++;
        result.errors.push(errMsg);
      }
    } catch (e: any) {
      const errMsg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Unknown error');
      result.failCount++;
      result.errors.push(errMsg);
    }
  }

  return result;
}

/**
 * Sync all unsynced activity records to the server
 */
export async function syncActivityRecords(): Promise<SyncResult> {
  const result: SyncResult = { totalRecords: 0, successCount: 0, failCount: 0, errors: [] };
  
  const online = await isOnline();
  if (!online) {
    result.errors.push('No internet connection');
    return result;
  }

  const unsynced = await getUnsyncedActivityRecords();
  result.totalRecords = unsynced.length;

  if (unsynced.length === 0) return result;

  const backendUrl = getBackendUrl();

  for (const record of unsynced) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${backendUrl}/user_activities.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          emp_id: parseInt(record.empId, 10),
          task_description: record.taskDescription,
          location: record.location,
          photo_base64: record.photoBase64 || '',
          file_type: record.fileType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        await markActivitySynced(record.id);
        result.successCount++;
      } else {
        const errMsg = data.message || `Server error: ${res.status}`;
        await markActivitySynced(record.id, errMsg);
        result.failCount++;
        result.errors.push(errMsg);
      }
    } catch (e: any) {
      const errMsg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Unknown error');
      result.failCount++;
      result.errors.push(errMsg);
    }
  }

  return result;
}

/**
 * Sync everything (attendance + activities)
 */
export async function syncAll(): Promise<{ attendance: SyncResult; activities: SyncResult }> {
  const attendance = await syncAttendanceRecords();
  const activities = await syncActivityRecords();
  return { attendance, activities };
}
