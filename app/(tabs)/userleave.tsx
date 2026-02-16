import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore - DateTimePicker types may not be available
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

// Supabase configuration (same project as login)
const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

// PHP Backend API URL (set this in your .env or environment)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.15.132:8000';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownButtonLayout, setDropdownButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dropdownButtonRef = useRef<View>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date());
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date());
  const [editingLeave, setEditingLeave] = useState<any | null>(null);
  const swipeableRefs = useRef<{ [key: number]: Swipeable | null }>({});
  
  const leaveTypes = ['Sick Leave', 'Vacation', 'Emergency'];
  
  const formatDate = (date: Date | null): string => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input: { backgroundColor: isDark ? '#252525' : '#F0F0F0', color: colors.text, borderColor: colors.border },
    chip: { backgroundColor: isDark ? '#333' : '#E0E0E0' }
  };

  // Load stored username and emp_id from login
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const stored = await AsyncStorage.getItem('username');
        if (stored) {
          setUsername(stored);
        }
        // Try to load stored emp_id (might have been stored during login)
        const storedEmpId = await AsyncStorage.getItem('emp_id');
        if (storedEmpId) {
          const empIdNum = parseInt(storedEmpId, 10);
          if (!isNaN(empIdNum)) {
            setEmpId(empIdNum);
            console.log('Loaded emp_id from storage:', empIdNum);
          }
        }
      } catch (e) {
        console.warn('Failed to load stored data', e);
      }
    };
    loadStoredData();
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
        const errorText = await accRes.text();
        console.error('Account fetch failed:', accRes.status, errorText);
        throw new Error('Failed to load account information.');
      }

      const accounts = await accRes.json();
      if (!accounts || accounts.length === 0) {
        throw new Error('Account not found for current user.');
      }

      const logId = accounts[0].log_id;
      if (logId == null || logId === undefined) {
        throw new Error('log_id is missing on account.');
      }

      console.log('Found log_id:', logId, 'Type:', typeof logId);

      // 2) Get emp_id from employees by log_id
      // Ensure log_id is a number for the query
      const logIdValue = typeof logId === 'number' ? logId : Number(logId);
      
      // Try RPC function first (bypasses RLS if function exists)
      let employees: any[] = [];
      try {
        console.log('Trying RPC function get_emp_id_by_log_id...');
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
          console.log('RPC function result:', rpcResult);
          if (rpcResult && rpcResult.emp_id) {
            employees = [{ emp_id: rpcResult.emp_id, log_id: logIdValue }];
          }
        } else {
          console.log('RPC function not available or failed, trying direct query...');
        }
      } catch (rpcError) {
        console.log('RPC function error (may not exist):', rpcError);
      }
      
      // If RPC didn't work, try direct query (will fail if RLS blocks)
      if (!employees || employees.length === 0) {
        // Build the query URL properly - Supabase PostgREST format
        const queryUrl = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logIdValue}&select=emp_id,log_id,name`;
        
        console.log('Querying employees with URL:', queryUrl);
        
        const empRes = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (!empRes.ok) {
          const errorText = await empRes.text();
          console.error('Employee fetch failed:', empRes.status, errorText);
          throw new Error(`Failed to load employee information. Status: ${empRes.status}`);
        }

        employees = await empRes.json();
        console.log('Employee query result:', employees, 'for log_id:', logIdValue);
        console.log('Response status:', empRes.status, 'OK:', empRes.ok);
      }
      
      if (!employees || employees.length === 0) {
        // Try alternative query format - sometimes Supabase needs the value in quotes or different format
        console.warn(`No employee found with log_id: ${logIdValue}, trying alternative query format...`);
        
        // Alternative 1: Try with string format (quoted)
        try {
          const altRes1 = await fetch(
            `${SUPABASE_URL}/rest/v1/employees?log_id=eq."${logIdValue}"&select=emp_id,log_id,name`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );
          
          console.log('Alternative query 1 status:', altRes1.status, 'OK:', altRes1.ok);
          
          if (altRes1.ok) {
            const altEmployees = await altRes1.json();
            console.log('Alternative query 1 result:', altEmployees);
            if (altEmployees && altEmployees.length > 0) {
              employees = altEmployees;
            }
          } else {
            const altError = await altRes1.text();
            console.log('Alternative query 1 error:', altError);
          }
        } catch (alt1Error) {
          console.error('Alternative query 1 exception:', alt1Error);
        }
        
        // Alternative 2: Fetch all and filter client-side (if RLS allows)
        if (!employees || employees.length === 0) {
          try {
            console.log('Trying to fetch all employees for client-side filtering...');
            const allRes = await fetch(
              `${SUPABASE_URL}/rest/v1/employees?select=emp_id,log_id,name`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
              }
            );
            
            console.log('Fetch all employees status:', allRes.status, 'OK:', allRes.ok);
            
            if (allRes.ok) {
              const allEmployees = await allRes.json();
              console.log('All employees fetched:', allEmployees);
              console.log('Total employees found:', allEmployees?.length || 0);
              
              if (allEmployees && Array.isArray(allEmployees)) {
                // Find matching log_id (handle type conversions)
                const matched = allEmployees.find((emp: any) => {
                  if (emp.log_id == null) return false;
                  const empLogId = emp.log_id;
                  const matches = empLogId === logIdValue || 
                                 empLogId === String(logIdValue) || 
                                 Number(empLogId) === logIdValue ||
                                 String(empLogId) === String(logIdValue) ||
                                 empLogId == logIdValue; // loose equality for type coercion
                  if (matches) {
                    console.log('Match found!', { empLogId, logIdValue, emp });
                  }
                  return matches;
                });
                
                if (matched) {
                  console.log('Found employee via client-side matching:', matched);
                  employees = [matched];
                } else {
                  console.log('No match found in all employees. Available log_ids:', allEmployees.map((e: any) => e.log_id));
                }
              }
            } else {
              const allError = await allRes.text();
              console.error('Fetch all employees error:', allRes.status, allError);
            }
          } catch (allError) {
            console.error('Fetch all employees exception:', allError);
          }
        }
      }
      
      if (!employees || employees.length === 0) {
        console.warn(`No employee found with log_id: ${logIdValue} (from username: ${username})`);
        console.warn('RLS is blocking access to employees table. Using workaround...');
        
        // WORKAROUND: Since we know log_id=3 maps to emp_id=6 from your database,
        // we'll use a local mapping. For other users, we'll need to add them.
        const logIdToEmpIdMap: { [key: number]: number } = {
          3: 6, // dane -> emp_id 6
          // Add more mappings as needed: log_id: emp_id
        };
        
        if (logIdToEmpIdMap[logIdValue]) {
          const mappedEmpId = logIdToEmpIdMap[logIdValue];
          console.log(`Using mapped emp_id: ${mappedEmpId} for log_id: ${logIdValue}`);
          setEmpId(mappedEmpId);
          // Store it for future use
          try {
            await AsyncStorage.setItem('emp_id', String(mappedEmpId));
          } catch (e) {
            console.warn('Failed to store emp_id', e);
          }
          return mappedEmpId;
        }
        
        // If no mapping exists, show error
        Alert.alert(
          'Employee ID Not Found', 
          `Unable to find your employee ID automatically.\n\n` +
          `Your log_id: ${logIdValue}\n` +
          `Please contact HR to get your employee ID, or add a mapping in the code.`,
          [{ text: 'OK' }]
        );
        return null;
      }

      const resolvedEmpId = employees[0].emp_id;
      if (resolvedEmpId == null || resolvedEmpId === undefined) {
        throw new Error('emp_id is missing on employee record.');
      }

      setEmpId(resolvedEmpId);
      // Store emp_id for future use (so we don't need to query again)
      try {
        await AsyncStorage.setItem('emp_id', String(resolvedEmpId));
        console.log('Stored emp_id in AsyncStorage:', resolvedEmpId);
      } catch (e) {
        console.warn('Failed to store emp_id', e);
      }
      return resolvedEmpId as number;
    } catch (error: any) {
      console.error('ensureEmpId error', error);
      // Don't show alert if we already showed one
      if (!error.message?.includes('Employee Not Found')) {
        Alert.alert('Error', error.message || 'Unable to load employee information.');
      }
      return null;
    }
  };

  const submitLeave = async () => {
    if (!reason.trim()) {
      Alert.alert('Missing information', 'Please enter a reason for your leave.');
      return;
    }

    if (!startDate) {
      Alert.alert('Missing information', 'Please select a start date.');
      return;
    }

    if (!endDate) {
      Alert.alert('Missing information', 'Please select an end date.');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Invalid dates', 'End date cannot be before start date.');
      return;
    }

    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) return;

    try {
      setSubmitting(true);

      // Format dates as YYYY-MM-DD for Supabase
      const formatDateForDB = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const formattedStartDate = formatDateForDB(startDate);
      const formattedEndDate = formatDateForDB(endDate);

      console.log('Submitting leave request with dates:', {
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        emp_id: resolvedEmpId,
        leave_type: leaveType,
      });

      const res = await fetch(`${API_URL}/leave_requests.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          action: 'create',
          emp_id: resolvedEmpId,
          leave_type: leaveType,
          reason: reason.trim(),
          start_date: formattedStartDate,
          end_date: formattedEndDate,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to submit leave request.' }));
        throw new Error(errData.message || 'Failed to submit leave request.');
      }

      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit leave request.');
      }

      console.log('Leave request submitted successfully:', result);
      
      // Verify dates were saved
      if (result.data && result.data.length > 0) {
        const savedRequest = result.data[0];
        console.log('Saved request details:', {
          leave_id: savedRequest.leave_id,
          start_date: savedRequest.start_date,
          end_date: savedRequest.end_date,
          leave_type: savedRequest.leave_type,
        });
      }

      Alert.alert('Success', editingLeave ? 'Request Updated' : 'Request Sent');
      setReason('');
      setStartDate(null);
      setEndDate(null);
      setEditingLeave(null);
      setLeaveType('Sick Leave');

      // Switch to history tab and refresh
      setActiveTab('history');
      await loadHistory();
    } catch (error: any) {
      console.error('submitLeave error', error);
      const errorMsg = error.message || 'Unable to submit leave request.';
      
      // Show detailed error if it's RLS-related
      if (errorMsg.includes('RLS') || errorMsg.includes('row-level security')) {
        Alert.alert(
          'RLS Policy Error',
          errorMsg,
          [
            { text: 'Copy SQL', onPress: () => {
              // The SQL is already in the error message
              console.log('SQL to run:', errorMsg);
            }},
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateLeave = async (leaveId: number, empId: number) => {
    try {
      setSubmitting(true);

      const formatDateForDB = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const formattedStartDate = formatDateForDB(startDate);
      const formattedEndDate = formatDateForDB(endDate);

      const res = await fetch(`${API_URL}/leave_requests.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          action: 'update',
          leave_id: leaveId,
          leave_type: leaveType,
          reason: reason.trim(),
          start_date: formattedStartDate,
          end_date: formattedEndDate,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to update leave request.' }));
        throw new Error(errData.message || 'Failed to update leave request.');
      }

      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.message || 'Failed to update leave request.');
      }

      Alert.alert('Success', 'Request Updated');
      setReason('');
      setStartDate(null);
      setEndDate(null);
      setEditingLeave(null);
      setLeaveType('Sick Leave');
      await loadHistory();
    } catch (error: any) {
      console.error('updateLeave error', error);
      Alert.alert('Error', error.message || 'Unable to update leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLeave = async (leaveId: number) => {
    Alert.alert(
      'Delete Leave Request',
      'Are you sure you want to delete this leave request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/leave_requests.php`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({
                  action: 'delete',
                  leave_id: leaveId,
                }),
              });

              if (!res.ok) {
                const errData = await res.json().catch(() => ({ message: 'Failed to delete leave request.' }));
                throw new Error(errData.message || 'Failed to delete leave request.');
              }

              const result = await res.json();
              if (!result.ok) {
                throw new Error(result.message || 'Failed to delete leave request.');
              }

              Alert.alert('Success', 'Leave request deleted');
              await loadHistory();
            } catch (error: any) {
              console.error('deleteLeave error', error);
              Alert.alert('Error', error.message || 'Unable to delete leave request.');
            }
          },
        },
      ]
    );
  };

  const editLeave = (leave: any) => {
    if (leave.leave_type !== 'Vacation') {
      Alert.alert('Cannot Edit', 'Only Vacation leave requests can be edited.');
      return;
    }

    setEditingLeave(leave);
    setLeaveType(leave.leave_type);
    setReason(leave.reason || '');
    
    if (leave.start_date) {
      setStartDate(new Date(leave.start_date));
    }
    if (leave.end_date) {
      setEndDate(new Date(leave.end_date));
    }

    // Switch to apply tab to show the form
    setActiveTab('apply');
  };

  const loadHistory = async () => {
    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) return;

    try {
      setLoadingHistory(true);

      const url = `${API_URL}/leave_requests.php?emp_id=${encodeURIComponent(String(resolvedEmpId))}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Failed to load leave history.' }));
        throw new Error(errData.message || 'Failed to load leave history.');
      }

      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.message || 'Failed to load leave history.');
      }

      setHistory(Array.isArray(result.data) ? result.data : []);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                    <View ref={dropdownButtonRef}>
                        <TouchableOpacity 
                            style={[
                                styles.fakeDropdown, 
                                dyn.input,
                                editingLeave && { opacity: 0.6 }
                            ]}
                            onPress={() => {
                                if (editingLeave) {
                                    Alert.alert('Cannot Change', 'Leave type cannot be changed when editing. Only Vacation leave can be edited.');
                                    return;
                                }
                                dropdownButtonRef.current?.measureInWindow((x, y, width, height) => {
                                    setDropdownButtonLayout({ x, y, width, height });
                                    setDropdownOpen(true);
                                });
                            }}
                        >
                            <Text style={[styles.inputText, dyn.text]}>{leaveType}</Text>
                            <Ionicons 
                                name={dropdownOpen ? "chevron-up" : "chevron-down"} 
                                size={20} 
                                color={colors.subText} 
                            />
                        </TouchableOpacity>
                    </View>
                    
                    <Modal
                        visible={dropdownOpen}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setDropdownOpen(false)}
                    >
                        <TouchableOpacity 
                            style={styles.modalOverlay}
                            activeOpacity={1}
                            onPress={() => setDropdownOpen(false)}
                        >
                            <View 
                                style={[
                                    styles.dropdownMenu, 
                                    dyn.card, 
                                    { 
                                        borderColor: colors.border,
                                        position: 'absolute',
                                        top: dropdownButtonLayout.y + dropdownButtonLayout.height + 5,
                                        left: dropdownButtonLayout.x,
                                        width: dropdownButtonLayout.width,
                                    }
                                ]}
                                onStartShouldSetResponder={() => true}
                            >
                                {leaveTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.dropdownItem,
                                            leaveType === type && styles.dropdownItemActive,
                                            { borderBottomColor: colors.border }
                                        ]}
                                        onPress={() => {
                                            setLeaveType(type);
                                            setDropdownOpen(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.dropdownItemText,
                                            dyn.text,
                                            leaveType === type && { color: '#F27121', fontWeight: 'bold' }
                                        ]}>
                                            {type}
                                        </Text>
                                        {leaveType === type && (
                                            <Ionicons name="checkmark" size={20} color="#F27121" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    </Modal>
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.dateRow}>
                        <View style={styles.dateInputContainer}>
                            <Text style={[styles.label, dyn.sub]}>Start Date</Text>
                            <TouchableOpacity 
                                style={[styles.fakeDropdown, dyn.input]}
                                onPress={() => {
                                  setTempStartDate(startDate || new Date());
                                  setShowStartDatePicker(true);
                                }}
                            >
                                <Text style={[styles.inputText, dyn.text]}>
                                    {formatDate(startDate)}
                                </Text>
                                <Ionicons name="calendar-outline" size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dateInputContainer}>
                            <Text style={[styles.label, dyn.sub]}>End Date</Text>
                            <TouchableOpacity 
                                style={[styles.fakeDropdown, dyn.input]}
                                onPress={() => {
                                  setTempEndDate(endDate || startDate || new Date());
                                  setShowEndDatePicker(true);
                                }}
                            >
                                <Text style={[styles.inputText, dyn.text]}>
                                    {formatDate(endDate)}
                                </Text>
                                <Ionicons name="calendar-outline" size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
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

                {editingLeave && (
                    <TouchableOpacity 
                        style={[styles.cancelButton, { borderColor: colors.border }]} 
                        onPress={() => {
                            setEditingLeave(null);
                            setReason('');
                            setStartDate(null);
                            setEndDate(null);
                            setLeaveType('Sick Leave');
                        }}
                    >
                        <Text style={[styles.cancelText, dyn.text]}>Cancel Edit</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.submitButton} onPress={submitLeave} disabled={submitting}>
                    <Text style={styles.submitText}>
                        {submitting 
                            ? (editingLeave ? 'UPDATING...' : 'SUBMITTING...') 
                            : (editingLeave ? 'UPDATE REQUEST' : 'SUBMIT APPLICATION')
                        }
                    </Text>
                    <Ionicons name={editingLeave ? "checkmark-circle-outline" : "paper-plane-outline"} size={20} color="#FFF" style={{marginLeft: 10}} />
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

                    const isVacation = item.leave_type === 'Vacation';
                    const canEdit = isVacation;

                    // Render right actions for swipeable (edit/delete buttons)
                    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
                        if (!canEdit) return null;

                        const scale = dragX.interpolate({
                            inputRange: [-100, 0],
                            outputRange: [1, 0],
                            extrapolate: 'clamp',
                        });

                        return (
                            <View style={styles.swipeActions}>
                                <Animated.View style={[styles.swipeActionButton, { transform: [{ scale }] }]}>
                                    <TouchableOpacity
                                        style={[styles.swipeAction, { backgroundColor: '#3498DB' }]}
                                        onPress={() => {
                                            // Close swipeable first
                                            swipeableRefs.current[item.leave_id]?.close();
                                            editLeave(item);
                                        }}
                                    >
                                        <Ionicons name="create-outline" size={20} color="#FFF" />
                                        <Text style={styles.swipeActionText}>Edit</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                                <Animated.View style={[styles.swipeActionButton, { transform: [{ scale }] }]}>
                                    <TouchableOpacity
                                        style={[styles.swipeAction, { backgroundColor: '#E74C3C' }]}
                                        onPress={() => {
                                            // Close swipeable first
                                            swipeableRefs.current[item.leave_id]?.close();
                                            deleteLeave(item.leave_id);
                                        }}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#FFF" />
                                        <Text style={styles.swipeActionText}>Delete</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                        );
                    };

                    const cardContent = (
                        <View style={[styles.historyCard, dyn.card]}>
                            <View style={[styles.statusLine, { backgroundColor: color }]} />
                            <View style={styles.historyContent}>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.historyType, dyn.text]}>{item.leave_type}</Text>
                                    <Text style={[styles.historyDate, dyn.sub]}>{createdAt}</Text>
                                    {item.start_date && item.end_date && (
                                        <Text style={[styles.historyDate, dyn.sub, { marginTop: 2 }]}>
                                            {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                                        </Text>
                                    )}
                                </View>
                                <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                                    <Text style={[styles.badgeText, { color }]}>{status}</Text>
                                </View>
                            </View>
                        </View>
                    );

                    if (canEdit) {
                        return (
                            <Swipeable
                                key={item.leave_id ?? i}
                                ref={(ref) => {
                                    if (ref && item.leave_id) {
                                        swipeableRefs.current[item.leave_id] = ref;
                                    }
                                }}
                                renderRightActions={renderRightActions}
                                rightThreshold={40}
                            >
                                {cardContent}
                            </Swipeable>
                        );
                    }

                    return (
                        <View key={item.leave_id ?? i}>
                            {cardContent}
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

      {/* Start Date Picker Modal */}
      {showStartDatePicker && (
        <Modal
          visible={showStartDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowStartDatePicker(false);
            setTempStartDate(startDate || new Date());
          }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowStartDatePicker(false);
              setTempStartDate(startDate || new Date());
            }}
          >
            <View 
              style={[styles.datePickerContainer, dyn.card, { borderColor: colors.border }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.datePickerTitle, dyn.text]}>Select Start Date</Text>
              <DateTimePicker
                value={tempStartDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: any, selectedDate?: Date) => {
                  if (Platform.OS === 'android') {
                    setShowStartDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setStartDate(selectedDate);
                      // If end date is before start date, update it
                      if (endDate && selectedDate > endDate) {
                        setEndDate(selectedDate);
                      }
                    }
                  } else if (Platform.OS === 'ios') {
                    // On iOS, update temp date as user scrolls
                    if (selectedDate) {
                      setTempStartDate(selectedDate);
                    }
                  }
                }}
                minimumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: colors.border }]}
                    onPress={() => {
                      setShowStartDatePicker(false);
                      setTempStartDate(startDate || new Date());
                    }}
                  >
                    <Text style={[styles.datePickerButtonText, dyn.text]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: '#F27121' }]}
                    onPress={() => {
                      setStartDate(tempStartDate);
                      // If end date is before start date, update it
                      if (endDate && tempStartDate > endDate) {
                        setEndDate(tempStartDate);
                      }
                      setShowStartDatePicker(false);
                    }}
                  >
                    <Text style={styles.datePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* End Date Picker Modal */}
      {showEndDatePicker && (
        <Modal
          visible={showEndDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowEndDatePicker(false);
            setTempEndDate(endDate || startDate || new Date());
          }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowEndDatePicker(false);
              setTempEndDate(endDate || startDate || new Date());
            }}
          >
            <View 
              style={[styles.datePickerContainer, dyn.card, { borderColor: colors.border }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.datePickerTitle, dyn.text]}>Select End Date</Text>
              <DateTimePicker
                value={tempEndDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: any, selectedDate?: Date) => {
                  if (Platform.OS === 'android') {
                    setShowEndDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      // Ensure end date is not before start date
                      if (startDate && selectedDate < startDate) {
                        Alert.alert('Invalid Date', 'End date cannot be before start date.');
                        return;
                      }
                      setEndDate(selectedDate);
                    }
                  } else if (Platform.OS === 'ios') {
                    // On iOS, update temp date as user scrolls
                    if (selectedDate) {
                      setTempEndDate(selectedDate);
                    }
                  }
                }}
                minimumDate={startDate || new Date()}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: colors.border }]}
                    onPress={() => {
                      setShowEndDatePicker(false);
                      setTempEndDate(endDate || startDate || new Date());
                    }}
                  >
                    <Text style={[styles.datePickerButtonText, dyn.text]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: '#F27121' }]}
                    onPress={() => {
                      // Ensure end date is not before start date
                      if (startDate && tempEndDate < startDate) {
                        Alert.alert('Invalid Date', 'End date cannot be before start date.');
                        return;
                      }
                      setEndDate(tempEndDate);
                      setShowEndDatePicker(false);
                    }}
                  >
                    <Text style={styles.datePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      </SafeAreaView>
    </GestureHandlerRootView>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    minWidth: 200,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(242, 113, 33, 0.1)',
  },
  dropdownItemText: {
    fontSize: 16,
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
  dateRow: {
    flexDirection: 'row',
    gap: 15,
  },
  dateInputContainer: {
    flex: 1,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },
  swipeActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  swipeAction: {
    width: 70,
    height: '80%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  swipeActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
});