import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore - DateTimePicker types may not be available
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';

// Supabase configuration
const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

// PHP Backend API URL
// Use the same backend URL as login.php (must be reachable from the device/emulator)
// PHP Backend API URL
const API_URL = 'http://192.168.15.14:8000';

export default function UserOvertime() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [empId, setEmpId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Build backend URL for a PHP endpoint. Some setups serve files under "/public".
  const buildPhpUrl = (path: string, opts?: { usePublic?: boolean }) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const prefix = opts?.usePublic ? '/public' : '';
    return `${API_URL}${prefix}${cleanPath}`;
  };

  // Fetch helper that retries with "/public" prefix if the server returns 404.
  const fetchPhpWithPublicFallback = async (
    path: string,
    init: RequestInit
  ): Promise<Response> => {
    // Add ngrok header to the init options
    const headers = {
      ...init.headers,
      'ngrok-skip-browser-warning': 'true',
    };
    const modifiedInit = { ...init, headers };
    
    const url1 = buildPhpUrl(path, { usePublic: false });
    const res1 = await fetch(url1, modifiedInit);
    if (res1.status !== 404) return res1;

    const url2 = buildPhpUrl(path, { usePublic: true });
    console.log('[Overtime] fetch fallback: 404 from', url1, '→ trying', url2);
    return await fetch(url2, modifiedInit);
  };

  // Initialize start and end times to reasonable defaults
  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(17, 0, 0, 0);
    const end = new Date(now);
    end.setHours(20, 0, 0, 0);
    setStartTime(start);
    setEndTime(end);
  }, []);

  // Load stored username and emp_id
  useEffect(() => {
    const loadStoredDataAndHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem('username');
        if (stored) {
          setUsername(stored);
        }
        const storedEmpId = await AsyncStorage.getItem('emp_id');
        if (storedEmpId) {
          const empIdNum = parseInt(storedEmpId, 10);
          if (!isNaN(empIdNum)) {
            setEmpId(empIdNum);
          }
        }
      } catch (e) {
        console.warn('Failed to load stored data', e);
      } finally {
        // Now that username/emp_id have had a chance to load, fetch history
        await loadHistory();
      }
    };
    loadStoredDataAndHistory();
  }, []);

  // Helper to ensure we have emp_id
  const ensureEmpId = async (): Promise<number | null> => {
    if (empId !== null) {
      console.log('[Overtime] ensureEmpId: using cached emp_id:', empId);
      return empId;
    }
    let effectiveUsername = username;
    if (!effectiveUsername) {
      // Fallback: try to pull username from storage if state isn't ready yet
      effectiveUsername = await AsyncStorage.getItem('username');
      if (effectiveUsername) {
        console.log('[Overtime] ensureEmpId: loaded username from AsyncStorage:', effectiveUsername);
        setUsername(effectiveUsername);
      }
    }
    if (!effectiveUsername) {
      console.log('[Overtime] ensureEmpId: missing username in state and storage');
      showAlert({ type: 'error', title: 'Not logged in', message: 'Username not found. Please log in again.' });
      return null;
    }

    try {
      console.log('[Overtime] ensureEmpId: resolving emp_id for username:', effectiveUsername);
      const accRes = await fetch(
        `${SUPABASE_URL}/rest/v1/accounts?username=eq.${encodeURIComponent(effectiveUsername)}&select=log_id`,
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
        const t = await accRes.text().catch(() => '');
        console.log('[Overtime] ensureEmpId: accounts fetch failed:', accRes.status, t);
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

      const logIdValue = typeof logId === 'number' ? logId : Number(logId);
      console.log('[Overtime] ensureEmpId: got log_id:', logIdValue);
      
      // Try RPC function first
      let employees: any[] = [];
      try {
        console.log('[Overtime] ensureEmpId: trying RPC get_emp_id_by_log_id');
        const rpcRes = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_emp_id_by_log_id`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ p_log_id: logIdValue }),
          }
        );
        
        if (rpcRes.ok) {
          const rpcResult = await rpcRes.json();
          console.log('[Overtime] ensureEmpId: RPC result:', rpcResult);
          if (rpcResult && rpcResult.emp_id) {
            employees = [{ emp_id: rpcResult.emp_id }];
          }
        } else {
          const t = await rpcRes.text().catch(() => '');
          console.log('[Overtime] ensureEmpId: RPC failed:', rpcRes.status, t);
        }
      } catch (rpcError) {
        console.log('RPC function error:', rpcError);
      }
      
      // If RPC didn't work, try direct query
      if (!employees || employees.length === 0) {
        const queryUrl = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logIdValue}&select=emp_id`;
        console.log('[Overtime] ensureEmpId: querying employees:', queryUrl);
        const empRes = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (empRes.ok) {
          employees = await empRes.json();
          console.log('[Overtime] ensureEmpId: employees query result:', employees);
        } else {
          const t = await empRes.text().catch(() => '');
          console.log('[Overtime] ensureEmpId: employees query failed:', empRes.status, t);
        }
      }
      
      if (!employees || employees.length === 0) {
        // Workaround mapping
        const logIdToEmpIdMap: { [key: number]: number } = {
          3: 6, // Add more mappings as needed
        };
        
        if (logIdToEmpIdMap[logIdValue]) {
          const mappedEmpId = logIdToEmpIdMap[logIdValue];
          console.log('[Overtime] ensureEmpId: using mapped emp_id:', mappedEmpId);
          setEmpId(mappedEmpId);
          await AsyncStorage.setItem('emp_id', String(mappedEmpId));
          return mappedEmpId;
        }
        
        showAlert({ type: 'error', title: 'Employee ID Not Found', message: 'Unable to find your employee ID. Please contact HR.' });
        return null;
      }

      const resolvedEmpId = employees[0].emp_id;
      console.log('[Overtime] ensureEmpId: resolved emp_id:', resolvedEmpId);
      setEmpId(resolvedEmpId);
      await AsyncStorage.setItem('emp_id', String(resolvedEmpId));
      return resolvedEmpId as number;
    } catch (error: any) {
      console.error('ensureEmpId error', error);
      showAlert({ type: 'error', title: 'Error', message: error.message || 'Unable to load employee information.' });
      return null;
    }
  };

  // Calculate total hours
  const calculateHours = (): number => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Handle case where end time is before start time (next day)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 10) / 10; // Round to 1 decimal place
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format time for display
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Format date for database (YYYY-MM-DD)
  const formatDateForDB = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Submit overtime request
  const submitOvertime = async () => {
    if (!reason.trim()) {
      showAlert({ type: 'error', title: 'Missing information', message: 'Please enter a reason for your overtime.' });
      return;
    }

    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) return;

    try {
      setSubmitting(true);

      const payload = {
        action: 'create',
        emp_id: resolvedEmpId,
        date: formatDateForDB(selectedDate),
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
        reason: reason.trim(),
      };

      console.log('[Overtime] submit: POST', buildPhpUrl('/overtime_requests.php'), payload);

      const res = await fetchPhpWithPublicFallback('/overtime_requests.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const rawErr = await res.text().catch(() => '');
        console.log('[Overtime] submit: non-2xx response:', res.status, rawErr);
        let errData: any = {};
        try {
          errData = JSON.parse(rawErr || '{}');
        } catch {
          errData = {};
        }
        throw new Error(errData.message || 'Failed to submit overtime request.');
      }

      const result = await res.json();
      console.log('[Overtime] submit: response:', result);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit overtime request.');
      }

      showAlert({ type: 'success', title: 'Success', message: 'Overtime request submitted successfully!' });
      setReason('');
      await loadHistory();
    } catch (error: any) {
      console.error('submitOvertime error', error);
      showAlert({ type: 'error', title: 'Error', message: error.message || 'Unable to submit overtime request.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Load overtime history
  const loadHistory = async () => {
    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) return;

    try {
      setLoadingHistory(true);

      const url = `${buildPhpUrl('/overtime_requests.php')}?emp_id=${encodeURIComponent(String(resolvedEmpId))}`;
      console.log('[Overtime] history: GET', url);

      const res = await fetchPhpWithPublicFallback(`/overtime_requests.php?emp_id=${encodeURIComponent(String(resolvedEmpId))}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const rawErr = await res.text().catch(() => '');
        console.log('[Overtime] history: non-2xx response:', res.status, rawErr);
        let errData: any = {};
        try {
          errData = JSON.parse(rawErr || '{}');
        } catch {
          errData = {};
        }
        throw new Error(errData.message || 'Failed to load overtime history.');
      }

      const result = await res.json();
      console.log('[Overtime] history: response:', result);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load overtime history.');
      }

      setHistory(Array.isArray(result.data) ? result.data : []);
    } catch (error: any) {
      console.error('loadHistory error', error);
      // Don't show alert on initial load failure
      if (history.length > 0) {
        showAlert({ type: 'error', title: 'Error', message: error.message || 'Unable to load overtime history.' });
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalHours = calculateHours();

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    input: { backgroundColor: isDark ? '#252525' : '#F0F0F0', color: colors.text },
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Overtime Request</Text>
        <View style={{width: 30}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* TIME CARD */}
        <View style={[styles.timeCard, dyn.card]}> 
            <Text style={styles.cardLabel}>TOTAL HOURS</Text>
            <View style={styles.timeDisplay}>
                <MaterialCommunityIcons name="clock-time-eight-outline" size={40} color="#F27121" />
                <Text style={[styles.bigTime, dyn.text]}>{totalHours.toFixed(1)}</Text> 
                <Text style={styles.unit}>HRS</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: isDark ? '#444' : '#E0E0E0' }]} />
            <View style={styles.row}>
                <TouchableOpacity onPress={() => setShowStartTimePicker(true)}>
                    <Text style={styles.label}>START</Text>
                    <Text style={[styles.value, dyn.text]}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={20} color={colors.subText} />
                <TouchableOpacity onPress={() => setShowEndTimePicker(true)}>
                    <Text style={styles.label}>END</Text>
                    <Text style={[styles.value, dyn.text]}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
            </View>
        </View>

        <Text style={[styles.sectionTitle, dyn.text]}>REQUEST DETAILS</Text>
        
        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>Date</Text>
            <TouchableOpacity style={[styles.fakeInput, dyn.input]} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.inputText, dyn.text]}>{formatDate(selectedDate)}</Text>
                <Ionicons name="calendar" size={20} color="#F27121" />
            </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>Reason / Project</Text>
            <TextInput 
                style={[styles.textInput, dyn.input]} 
                placeholder="Why is overtime needed?" 
                placeholderTextColor={colors.subText}
                value={reason}
                onChangeText={setReason}
            />
        </View>

        <TouchableOpacity 
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
            onPress={submitOvertime}
            disabled={submitting}
        >
            <Text style={styles.submitText}>
                {submitting ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
            </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, dyn.text]}>RECENT REQUESTS</Text>
        {loadingHistory ? (
            <Text style={[styles.historyDate, dyn.sub]}>Loading...</Text>
        ) : history.length === 0 ? (
            <Text style={[styles.historyDate, dyn.sub]}>No overtime requests found.</Text>
        ) : (
            history.map((item, i) => {
                // Parse time range if stored as "HH:MM-HH:MM"
                let hours = '0.0 hrs';
                if (item.time) {
                    const timeParts = item.time.split('-');
                    if (timeParts.length === 2) {
                        const [start, end] = timeParts;
                        const startDate = new Date(`${item.date} ${start}`);
                        const endDate = new Date(`${item.date} ${end}`);
                        if (endDate < startDate) {
                            endDate.setDate(endDate.getDate() + 1);
                        }
                        const diffMs = endDate.getTime() - startDate.getTime();
                        const diffHours = diffMs / (1000 * 60 * 60);
                        hours = `${diffHours.toFixed(1)} hrs`;
                    }
                }
                
                const status = item.status || 'Pending';
                const statusColor = status === 'Approved' ? '#27AE60' : status === 'Rejected' ? '#C0392B' : '#F39C12';
                const displayDate = item.date ? formatDate(new Date(item.date)) : 'N/A';
                
                return (
                    <View key={item.ovt_id || i} style={[styles.historyItem, dyn.card]}>
                        <View>
                            <Text style={[styles.historyDate, dyn.text]}>{displayDate}</Text>
                            <Text style={[styles.historyReason, dyn.sub]}>{item.reason || 'N/A'}</Text>
                        </View>
                        <View style={{alignItems: 'flex-end'}}>
                            <Text style={[styles.historyHours, dyn.text]}>{hours}</Text>
                            <Text style={[styles.historyStatus, { color: statusColor }]}>
                                {status}
                            </Text>
                        </View>
                    </View>
                );
            })
        )}

        {/* Date Picker Modal */}
        {showDatePicker && (
            <Modal
                visible={showDatePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDatePicker(false)}
                >
                    <View 
                        style={[styles.datePickerContainer, dyn.card, { borderColor: colors.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={[styles.datePickerTitle, dyn.text]}>Select Date</Text>
                        <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event: any, selectedDate?: Date) => {
                                if (Platform.OS === 'android') {
                                    setShowDatePicker(false);
                                    if (event.type === 'set' && selectedDate) {
                                        setSelectedDate(selectedDate);
                                    }
                                } else if (Platform.OS === 'ios' && selectedDate) {
                                    setSelectedDate(selectedDate);
                                }
                            }}
                            minimumDate={new Date()}
                        />
                        {Platform.OS === 'ios' && (
                            <View style={styles.datePickerButtons}>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: colors.border }]}
                                    onPress={() => setShowDatePicker(false)}
                                >
                                    <Text style={[styles.datePickerButtonText, dyn.text]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: '#F27121' }]}
                                    onPress={() => setShowDatePicker(false)}
                                >
                                    <Text style={styles.datePickerButtonText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        )}

        {/* Start Time Picker Modal */}
        {showStartTimePicker && (
            <Modal
                visible={showStartTimePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowStartTimePicker(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowStartTimePicker(false)}
                >
                    <View 
                        style={[styles.datePickerContainer, dyn.card, { borderColor: colors.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={[styles.datePickerTitle, dyn.text]}>Select Start Time</Text>
                        <DateTimePicker
                            value={startTime}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event: any, selectedTime?: Date) => {
                                if (Platform.OS === 'android') {
                                    setShowStartTimePicker(false);
                                    if (event.type === 'set' && selectedTime) {
                                        setStartTime(selectedTime);
                                    }
                                } else if (Platform.OS === 'ios' && selectedTime) {
                                    setStartTime(selectedTime);
                                }
                            }}
                        />
                        {Platform.OS === 'ios' && (
                            <View style={styles.datePickerButtons}>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: colors.border }]}
                                    onPress={() => setShowStartTimePicker(false)}
                                >
                                    <Text style={[styles.datePickerButtonText, dyn.text]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: '#F27121' }]}
                                    onPress={() => setShowStartTimePicker(false)}
                                >
                                    <Text style={styles.datePickerButtonText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        )}

        {/* End Time Picker Modal */}
        {showEndTimePicker && (
            <Modal
                visible={showEndTimePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowEndTimePicker(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowEndTimePicker(false)}
                >
                    <View 
                        style={[styles.datePickerContainer, dyn.card, { borderColor: colors.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={[styles.datePickerTitle, dyn.text]}>Select End Time</Text>
                        <DateTimePicker
                            value={endTime}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event: any, selectedTime?: Date) => {
                                if (Platform.OS === 'android') {
                                    setShowEndTimePicker(false);
                                    if (event.type === 'set' && selectedTime) {
                                        setEndTime(selectedTime);
                                    }
                                } else if (Platform.OS === 'ios' && selectedTime) {
                                    setEndTime(selectedTime);
                                }
                            }}
                        />
                        {Platform.OS === 'ios' && (
                            <View style={styles.datePickerButtons}>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: colors.border }]}
                                    onPress={() => setShowEndTimePicker(false)}
                                >
                                    <Text style={[styles.datePickerButtonText, dyn.text]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: '#F27121' }]}
                                    onPress={() => setShowEndTimePicker(false)}
                                >
                                    <Text style={styles.datePickerButtonText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        )}

      </ScrollView>

      <CustomAlert
        visible={visible}
        type={config.type}
        title={config.title}
        message={config.message}
        hint={config.hint}
        buttonText={config.buttonText}
        onClose={hideAlert}
        backgroundColor={colors.card}
        textColor={colors.text}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  content: { padding: 20 },
  timeCard: { backgroundColor: '#252525', borderRadius: 15, padding: 25, alignItems: 'center', marginBottom: 30, borderTopWidth: 4, borderTopColor: '#F27121' },
  cardLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
  timeDisplay: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  bigTime: { color: '#FFF', fontSize: 48, fontWeight: 'bold', marginHorizontal: 10, lineHeight: 50 },
  unit: { color: '#F27121', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  divider: { width: '100%', height: 1, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  label: { color: '#888', fontSize: 10, fontWeight: 'bold' },
  value: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { marginBottom: 8, fontSize: 12 },
  fakeInput: { padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputText: { fontSize: 16 },
  textInput: { padding: 15, borderRadius: 10, fontSize: 16 },
  submitBtn: { backgroundColor: '#F27121', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  historyItem: { padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyDate: { fontWeight: 'bold', marginBottom: 2 },
  historyReason: { fontSize: 12 },
  historyHours: { fontWeight: 'bold', fontSize: 16 },
  historyStatus: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    minWidth: 300,
    maxWidth: '90%',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  datePickerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});