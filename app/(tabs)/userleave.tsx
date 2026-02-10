import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from './ThemeContext';

// Supabase configuration (same project as login)
const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

export default function UserLeave() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('apply');
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [reason, setReason] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [empId, setEmpId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input: { backgroundColor: isDark ? '#252525' : '#F0F0F0', color: colors.text, borderColor: colors.border },
    chip: { backgroundColor: isDark ? '#333' : '#E0E0E0' }
  };

  // Load stored username from login
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const stored = await AsyncStorage.getItem('username');
        if (stored) {
          setUsername(stored);
        }
      } catch (e) {
        console.warn('Failed to load username from storage', e);
      }
    };
    loadUsername();
  }, []);

  // Helper to ensure we have emp_id for the logged-in user
  const ensureEmpId = async (): Promise<number | null> => {
    if (empId !== null) return empId;
    if (!username) {
      Alert.alert('Not logged in', 'Username not found. Please log in again.');
      return null;
    }

    try {
      // 1) Get log_id from accounts by username
      const accRes = await fetch(
        `${SUPABASE_URL}/rest/v1/accounts?username=eq.${encodeURIComponent(username)}&select=log_id`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!accRes.ok) {
        throw new Error('Failed to load account information.');
      }

      const accounts = await accRes.json();
      if (!accounts || accounts.length === 0) {
        throw new Error('Account not found for current user.');
      }

      const logId = accounts[0].log_id;
      if (logId == null) {
        throw new Error('log_id is missing on account.');
      }

      // 2) Get emp_id from employees by log_id
      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${encodeURIComponent(
          String(logId)
        )}&select=emp_id`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!empRes.ok) {
        throw new Error('Failed to load employee information.');
      }

      const employees = await empRes.json();
      if (!employees || employees.length === 0) {
        throw new Error('Employee record not found for current user.');
      }

      const resolvedEmpId = employees[0].emp_id as number;
      setEmpId(resolvedEmpId);
      return resolvedEmpId;
    } catch (error: any) {
      console.error('ensureEmpId error', error);
      Alert.alert('Error', error.message || 'Unable to load employee information.');
      return null;
    }
  };

  const submitLeave = async () => {
    if (!reason.trim()) {
      Alert.alert('Missing information', 'Please enter a reason for your leave.');
      return;
    }

    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) return;

    try {
      setSubmitting(true);

      const body = [
        {
          emp_id: resolvedEmpId,
          leave_type: leaveType,
          reason: reason.trim(),
          start_date: null,
          end_date: null,
        },
      ];

      const res = await fetch(`${SUPABASE_URL}/rest/v1/leave_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to submit leave request.');
      }

      Alert.alert('Success', 'Request Sent');
      setReason('');

      // Refresh history so the new request appears
      if (activeTab === 'history') {
        await loadHistory();
      }
    } catch (error: any) {
      console.error('submitLeave error', error);
      Alert.alert('Error', error.message || 'Unable to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistory = async () => {
    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) return;

    try {
      setLoadingHistory(true);

      const url =
        `${SUPABASE_URL}/rest/v1/leave_requests?emp_id=eq.${encodeURIComponent(
          String(resolvedEmpId)
        )}&select=*&order=created_at.desc`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to load leave history.');
      }

      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('loadHistory error', error);
      Alert.alert('Error', error.message || 'Unable to load leave history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Automatically load history when switching to the "history" tab
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Leave Application</Text>
        <TouchableOpacity style={styles.iconBtn}>
           <Ionicons name="information-circle-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        {['apply', 'history'].map(tab => (
            <TouchableOpacity 
                key={tab} 
                style={[styles.tab, activeTab === tab && styles.activeTab]} 
                onPress={() => setActiveTab(tab)}
            >
                <Text style={[styles.tabText, activeTab === tab ? styles.activeTabText : dyn.sub]}>
                    {tab === 'apply' ? 'FILE REQUEST' : 'MY HISTORY'}
                </Text>
            </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {activeTab === 'apply' ? (
            <View>
                <Text style={[styles.sectionLabel, dyn.sub]}>LEAVE DETAILS</Text>
                
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, dyn.sub]}>Leave Type</Text>
                    <View style={[styles.fakeDropdown, dyn.input]}>
                        <Text style={[styles.inputText, dyn.text]}>{leaveType}</Text>
                        <Ionicons name="chevron-down" size={20} color={colors.subText} />
                    </View>
                    <View style={styles.typeRow}>
                        {['Sick Leave', 'Vacation', 'Emergency'].map((type) => (
                            <TouchableOpacity 
                                key={type} 
                                style={[styles.chip, leaveType === type ? styles.activeChip : dyn.chip]}
                                onPress={() => setLeaveType(type)}
                            >
                                <Text style={[styles.chipText, leaveType === type ? styles.activeChipText : dyn.sub]}>{type}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, dyn.sub]}>Reason for Leave</Text>
                    <TextInput 
                        style={[styles.fakeInput, dyn.input, { height: 100, textAlignVertical: 'top' }]}
                        placeholder="State your reason here..."
                        placeholderTextColor={colors.subText}
                        multiline
                        value={reason}
                        onChangeText={setReason}
                    />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={submitLeave} disabled={submitting}>
                    <Text style={styles.submitText}>{submitting ? 'SUBMITTING...' : 'SUBMIT APPLICATION'}</Text>
                    <Ionicons name="paper-plane-outline" size={20} color="#FFF" style={{marginLeft: 10}} />
                </TouchableOpacity>
            </View>
        ) : (
            <View>
                <Text style={[styles.sectionLabel, dyn.sub]}>RECENT REQUESTS</Text>
                {history.map((item, i) => {
                    const status = item.status || 'Pending';
                    const color =
                        status === 'Approved' ? '#27AE60' :
                        status === 'Rejected' ? '#C0392B' :
                        '#F1C40F';

                    const createdAt = item.created_at
                        ? new Date(item.created_at).toLocaleDateString()
                        : '';

                    return (
                        <View key={item.leave_id ?? i} style={[styles.historyCard, dyn.card]}>
                            <View style={[styles.statusLine, { backgroundColor: color }]} />
                            <View style={styles.historyContent}>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.historyType, dyn.text]}>{item.leave_type}</Text>
                                    <Text style={[styles.historyDate, dyn.sub]}>{createdAt}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                                    <Text style={[styles.badgeText, { color }]}>{status}</Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
                {history.length === 0 && !loadingHistory && (
                    <Text style={[styles.historyDate, dyn.sub]}>
                        No leave requests found.
                    </Text>
                )}
            </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 15 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#F27121' },
  tabText: { fontWeight: 'bold', fontSize: 14 },
  activeTabText: { color: '#F27121' },
  content: { padding: 20 },
  sectionLabel: { marginBottom: 20, fontSize: 12, letterSpacing: 1, fontWeight: 'bold' },
  inputGroup: { marginBottom: 25 },
  label: { marginBottom: 10, fontSize: 14 },
  fakeDropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 10, borderWidth: 1 },
  fakeInput: { padding: 15, borderRadius: 10, borderWidth: 1 },
  inputText: { fontSize: 16 },
  typeRow: { flexDirection: 'row', marginTop: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10 },
  activeChip: { backgroundColor: '#F27121' },
  chipText: { fontSize: 12 },
  activeChipText: { color: '#FFF', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#F27121', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 12, marginTop: 10 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  historyCard: { borderRadius: 10, marginBottom: 15, overflow: 'hidden', flexDirection: 'row', elevation: 2 },
  statusLine: { width: 6, height: '100%' },
  historyContent: { flex: 1, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyType: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  historyDate: { fontSize: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
});