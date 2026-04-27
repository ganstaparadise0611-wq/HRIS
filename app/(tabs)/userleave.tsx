import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore - DateTimePicker types may not be available
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import UserAvatar from '../../components/UserAvatar';
import { getBackendUrl, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../constants/backend-config';
import { recheckNetwork } from '../../constants/network-detector';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming, Easing, interpolate } from 'react-native-reanimated';

export default function UserLeave() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('apply');
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [reason, setReason] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [empId, setEmpId] = useState<number | null>(null);
  const [empName, setEmpName] = useState<string>('');
  const [empDept, setEmpDept] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
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
  
  // New states for missing features
  const [isFullDay, setIsFullDay] = useState(true);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<any[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  
  const leaveTypes = ['Sick Leave', 'Vacation', 'Emergency', 'Annual Leave', 'Marriage of Employee'];
  
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

  // Entrance animations
  const fadeAnim = useSharedValue(0);
  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [20, 0]) }]
  }));

  // Load stored username and emp_id from login
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const stored = await AsyncStorage.getItem('username');
        if (stored) {
          setUsername(stored);
        }
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
        }
        const storedEmpId = await AsyncStorage.getItem('emp_id');
        if (storedEmpId) {
          const empIdNum = parseInt(storedEmpId, 10);
          if (!isNaN(empIdNum)) {
            setEmpId(empIdNum);
          }
        }
      } catch (_e) {
        // Ignore storage errors
      }
    };
    loadStoredData();
  }, []);

  useEffect(() => {
    recheckNetwork().catch(() => {});
  }, []);

  // Load employee profile data and leave balance
  useEffect(() => {
    if (userId || empId) {
      loadEmployeeProfile();
      loadLeaveBalance();
      loadDraftForm();
    }
  }, [userId, empId]);

  // Load employee profile (name, department, avatar)
  const loadEmployeeProfile = async () => {
    try {
      const logId = userId;
      if (!logId) return;

      const url = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logId}&select=name,dept_id`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      const data = await response.json();
      if (data && data.length > 0) {
        setEmpName(data[0].name || '');
        
        // Fetch department name if dept_id exists
        if (data[0].dept_id) {
          const deptRes = await fetch(
            `${SUPABASE_URL}/rest/v1/departments?dept_id=eq.${data[0].dept_id}&select=name`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );
          const deptData = await deptRes.json();
          if (deptData && deptData.length > 0) {
            setEmpDept(deptData[0].name || '');
          }
        }
      }

      // Load profile picture
      const accUrl = `${SUPABASE_URL}/rest/v1/accounts?log_id=eq.${logId}&select=profile_picture`;
      const accRes = await fetch(accUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      const accData = await accRes.json();
      if (accData && accData.length > 0 && accData[0].profile_picture) {
        setProfilePicture(accData[0].profile_picture);
      }
    } catch (error) {
      console.error('Error loading employee profile:', error);
    }
  };

  // Load leave balance for employee
  const loadLeaveBalance = async () => {
    try {
      const empIdToUse = empId;
      if (!empIdToUse) return;

      setLoadingBalance(true);

      // Fetch leave balance from backend
      const url = `${getBackendUrl()}/get-leave-balance.php?emp_id=${empIdToUse}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data) {
          setLeaveBalance(Array.isArray(data.data) ? data.data : []);
        }
      }
    } catch (error) {
      console.error('Error loading leave balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Save draft form to AsyncStorage
  const saveDraft = async () => {
    try {
      const draft = {
        leaveType,
        reason,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        isFullDay,
        attachments: attachments.map(a => ({ name: a.name })),
      };
      await AsyncStorage.setItem('leaveDraft', JSON.stringify(draft));
      showAlert({ type: 'success', title: 'Saved', message: 'Your leave request has been saved as draft.' });
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save draft.' });
    }
  };

  // Load draft form from AsyncStorage
  const loadDraftForm = async () => {
    try {
      const draftData = await AsyncStorage.getItem('leaveDraft');
      if (draftData) {
        const draft = JSON.parse(draftData);
        setLeaveType(draft.leaveType || 'Sick Leave');
        setReason(draft.reason || '');
        if (draft.startDate) setStartDate(new Date(draft.startDate));
        if (draft.endDate) setEndDate(new Date(draft.endDate));
        setIsFullDay(draft.isFullDay !== false);
      }
    } catch (error) {
      // Silently fail
    }
  };

  // Clear draft
  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem('leaveDraft');
    } catch (error) {
      // Silently fail
    }
  };

  // Pick and add attachment
  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setAttachments([...attachments, {
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          uri: file.uri,
        }]);
      }
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to pick file.' });
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Helper to ensure we have emp_id for the logged-in user
  const ensureEmpId = async (): Promise<number | null> => {
    if (empId !== null) return empId;
    if (!username) {
      showAlert({ type: 'error', title: 'Not logged in', message: 'Username not found. Please log in again.' });
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
      if (logId == null || logId === undefined) {
        throw new Error('log_id is missing on account.');
      }

      const logIdValue = typeof logId === 'number' ? logId : Number(logId);
      
      let employees: any[] = [];
      try {
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
          if (rpcResult && rpcResult.emp_id) {
            employees = [{ emp_id: rpcResult.emp_id, log_id: logIdValue }];
          }
        }
      } catch (_rpcError) {
        // RPC may not exist
      }
      
      if (!employees || employees.length === 0) {
        const queryUrl = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logIdValue}&select=emp_id,log_id,name`;
        
        const empRes = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (!empRes.ok) {
          throw new Error(`Failed to load employee information. Status: ${empRes.status}`);
        }

        employees = await empRes.json();
      }
      
      if (!employees || employees.length === 0) {
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
          
          if (altRes1.ok) {
            const altEmployees = await altRes1.json();
            if (altEmployees && altEmployees.length > 0) {
              employees = altEmployees;
            }
          }
        } catch (_alt1Error) {
          // Ignore
        }
        
        if (!employees || employees.length === 0) {
          try {
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
            
            if (allRes.ok) {
              const allEmployees = await allRes.json();
              
              if (allEmployees && Array.isArray(allEmployees)) {
                const matched = allEmployees.find((emp: any) => {
                  if (emp.log_id == null) return false;
                  const empLogId = emp.log_id;
                  return empLogId === logIdValue || 
                         empLogId === String(logIdValue) || 
                         Number(empLogId) === logIdValue ||
                         String(empLogId) === String(logIdValue) ||
                         empLogId == logIdValue;
                });
                
                if (matched) {
                  employees = [matched];
                }
              }
            }
          } catch (_allError) {
            // Ignore
          }
        }
      }
      
      if (!employees || employees.length === 0) {
        const logIdToEmpIdMap: { [key: number]: number } = {
          3: 6,
        };
        
        if (logIdToEmpIdMap[logIdValue]) {
          const mappedEmpId = logIdToEmpIdMap[logIdValue];
          setEmpId(mappedEmpId);
          try {
            await AsyncStorage.setItem('emp_id', String(mappedEmpId));
          } catch (_e) {
            // Ignore
          }
          return mappedEmpId;
        }
        
        showAlert({
          type: 'warning',
          title: 'Employee ID Not Found',
          message: `Unable to find your employee ID automatically.\n\nYour log_id: ${logIdValue}\nPlease contact HR to get your employee ID, or add a mapping in the code.`,
          buttonText: 'OK'
        });
        return null;
      }

      const resolvedEmpId = employees[0].emp_id;
      if (resolvedEmpId == null || resolvedEmpId === undefined) {
        throw new Error('emp_id is missing on employee record.');
      }

      setEmpId(resolvedEmpId);
      try {
        await AsyncStorage.setItem('emp_id', String(resolvedEmpId));
      } catch (_e) {
        // Ignore
      }
      return resolvedEmpId as number;
    } catch (error: any) {
      if (!error.message?.includes('Employee Not Found')) {
        showAlert({ type: 'error', title: 'Error', message: error.message || 'Unable to load employee information.' });
      }
      return null;
    }
  };

  const submitLeave = async (asDraft: boolean = false) => {
    if (!reason.trim()) {
      showAlert({ type: 'error', title: 'Missing information', message: 'Please enter a reason for your leave.' });
      return;
    }

    if (!startDate) {
      showAlert({ type: 'error', title: 'Missing information', message: 'Please select a start date.' });
      return;
    }

    if (!endDate) {
      showAlert({ type: 'error', title: 'Missing information', message: 'Please select an end date.' });
      return;
    }

    if (endDate < startDate) {
      showAlert({ type: 'error', title: 'Invalid dates', message: 'End date cannot be before start date.' });
      return;
    }

    if (asDraft) {
      // Save as draft
      await saveDraft();
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

      const res = await fetch(`${getBackendUrl()}/leave_requests.php`, {
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
          is_full_day: isFullDay,
          has_attachment: attachments.length > 0,
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
      
      let leaveId = null;
      if (result.data && result.data.length > 0) {
        leaveId = result.data[0].leave_id;
      }

      // Upload attachments if there are any and we got a leave_id
      if (attachments.length > 0 && leaveId) {
        for (const attachment of attachments) {
          try {
            const formData = new FormData();
            formData.append('leave_id', String(leaveId));
            formData.append('file', {
              uri: attachment.uri,
              name: attachment.name,
              type: attachment.mimeType,
            } as any);

            const uploadRes = await fetch(`${getBackendUrl()}/leave-attachments.php`, {
              method: 'POST',
              headers: {
                'ngrok-skip-browser-warning': 'true',
              },
              body: formData,
            });

            if (!uploadRes.ok) {
              console.warn(`Failed to upload attachment: ${attachment.name}`);
            }
          } catch (uploadErr) {
            console.warn(`Error uploading attachment ${attachment.name}:`, uploadErr);
          }
        }
      }

      showAlert({ type: 'success', title: 'Success', message: editingLeave ? 'Request Updated' : 'Request Sent' });
      setReason('');
      setStartDate(null);
      setEndDate(null);
      setEditingLeave(null);
      setLeaveType('Sick Leave');
      setAttachments([]);
      setIsFullDay(true);
      await clearDraft();

      // Switch to history tab and refresh
      setActiveTab('history');
      await loadHistory();
    } catch (error: any) {
      const errorMsg = error.message || 'Unable to submit leave request.';
      
      if (errorMsg.includes('RLS') || errorMsg.includes('row-level security')) {
        showAlert({
          type: 'error',
          title: 'RLS Policy Error',
          message: errorMsg,
          buttonText: 'OK',
        });
      } else {
        showAlert({ type: 'error', title: 'Error', message: errorMsg });
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

      const res = await fetch(`${getBackendUrl()}/leave_requests.php`, {
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

      showAlert({ type: 'success', title: 'Success', message: 'Request Updated' });
      setReason('');
      setStartDate(null);
      setEndDate(null);
      setEditingLeave(null);
      setLeaveType('Sick Leave');
      await loadHistory();
    } catch (_error) {
      showAlert({ type: 'error', title: 'Error', message: 'Unable to update leave request.' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLeave = async (leaveId: number) => {
    showAlert({
      type: 'warning',
      title: 'Delete Leave Request',
      message: 'Are you sure you want to delete this leave request?',
      buttonText: 'Delete',
      onClose: async () => {
        try {
          const res = await fetch(`${getBackendUrl()}/leave_requests.php`, {
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

          showAlert({ type: 'success', title: 'Success', message: 'Leave request deleted' });
          await loadHistory();
        } catch (_error) {
          showAlert({ type: 'error', title: 'Error', message: 'Unable to delete leave request.' });
        }
      }
    });
  };

  const editLeave = (leave: any) => {
    if (leave.leave_type !== 'Vacation') {
      showAlert({ type: 'warning', title: 'Cannot Edit', message: 'Only Vacation leave requests can be edited.' });
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
    if (resolvedEmpId === null) {
      setHistory([]);
      return;
    }

    try {
      setLoadingHistory(true);

      const url = `${getBackendUrl()}/leave_requests.php?emp_id=${encodeURIComponent(String(resolvedEmpId))}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!res.ok) {
        setHistory([]);
        return;
      }

      const result = await res.json();
      if (result && result.ok === true) {
        setHistory(Array.isArray(result.data) ? result.data : []);
      } else {
        setHistory([]);
      }
    } catch (_error) {
      setHistory([]);
      showAlert({ type: 'error', title: 'Error', message: 'Unable to load leave history.' });
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
        <Reanimated.View style={animatedStyle}>
        {activeTab === 'apply' ? (
            <View>
                {/* REQUESTED FOR SECTION */}
                <View style={[styles.card, dyn.card]}>
                  <Text style={[styles.sectionLabel, dyn.sub]}>REQUESTED FOR</Text>
                  <View style={styles.requestedForContainer}>
                    <UserAvatar
                      userId={userId}
                      displayName={empName}
                      size={60}
                    />
                    <View style={styles.empInfoContainer}>
                      <Text style={[styles.empName, dyn.text]}>{empName || 'Loading...'}</Text>
                      <Text style={[styles.empDept, dyn.sub]}>{empDept || 'Department'}</Text>
                    </View>
                  </View>
                </View>

                {/* LEAVE BALANCE / VALIDITY SECTION */}
                {leaveBalance.length > 0 && (
                  <View style={[styles.card, dyn.card]}>
                    <Text style={[styles.sectionLabel, dyn.sub]}>LEAVE BALANCE</Text>
                    {leaveBalance.map((item: any, idx: number) => (
                      <View key={idx} style={styles.balanceItem}>
                        <View style={styles.balanceInfo}>
                          <Text style={[styles.balanceType, dyn.text]}>{item.leave_type}</Text>
                          <View style={styles.balanceBar}>
                            <View
                              style={[
                                styles.balanceBarFill,
                                {
                                  width: `${Math.min(
                                    (((item.total || 0) - (item.used || 0)) / (item.total || 1)) * 100,
                                    100
                                  )}%`,
                                  backgroundColor: item.leave_type === 'Annual Leave' ? '#F27121' : '#3498DB',
                                },
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.balanceRemaining, dyn.text]}>
                          {(item.total || 0) - (item.used || 0)} / {item.total || 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

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
                                    showAlert({ type: 'warning', title: 'Cannot Change', message: 'Leave type cannot be changed when editing. Only Vacation leave can be edited.' });
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

                {/* FULL DAY / HALF DAY TOGGLE */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, dyn.sub]}>Leave Duration</Text>
                  <View style={styles.dayToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.dayToggleButton,
                        isFullDay && [styles.dayToggleButtonActive, { backgroundColor: '#F27121' }],
                      ]}
                      onPress={() => setIsFullDay(true)}
                    >
                      <Ionicons name="calendar" size={20} color={isFullDay ? '#FFF' : colors.subText} />
                      <Text style={[styles.dayToggleText, isFullDay && { color: '#FFF', fontWeight: 'bold' }]}>
                        Full Day
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dayToggleButton,
                        !isFullDay && [styles.dayToggleButtonActive, { backgroundColor: '#F27121' }],
                      ]}
                      onPress={() => setIsFullDay(false)}
                    >
                      <Ionicons name="time" size={20} color={!isFullDay ? '#FFF' : colors.subText} />
                      <Text style={[styles.dayToggleText, !isFullDay && { color: '#FFF', fontWeight: 'bold' }]}>
                        Half Day
                      </Text>
                    </TouchableOpacity>
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

                {/* ATTACHMENT SECTION */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, dyn.sub]}>Attachments</Text>
                  <TouchableOpacity 
                    style={[styles.attachmentButton, dyn.input]}
                    onPress={pickAttachment}
                  >
                    <MaterialCommunityIcons name="upload" size={20} color="#F27121" />
                    <Text style={[styles.attachmentButtonText, { color: '#F27121' }]}>
                      {attachments.length === 0 ? 'UPLOAD FILES' : `${attachments.length} FILE(S)`}
                    </Text>
                  </TouchableOpacity>
                  {attachments.length > 0 && (
                    <View style={styles.attachmentsList}>
                      {attachments.map((file, index) => (
                        <View key={index} style={[styles.attachmentItem, dyn.card]}>
                          <View style={styles.attachmentItemContent}>
                            <MaterialCommunityIcons name="file-document" size={20} color="#F27121" />
                            <View style={styles.attachmentItemInfo}>
                              <Text style={[styles.attachmentItemName, dyn.text]} numberOfLines={1}>
                                {file.name}
                              </Text>
                              <Text style={[styles.attachmentItemSize, dyn.sub]}>
                                {(file.size / 1024).toFixed(1)} KB
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity 
                            onPress={() => removeAttachment(index)}
                            style={styles.attachmentItemRemove}
                          >
                            <Ionicons name="close-circle" size={20} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
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

                {/* DRAFT AND SUBMIT BUTTONS */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.draftButton, { borderColor: colors.border }]} 
                    onPress={() => submitLeave(true)}
                    disabled={submitting}
                  >
                    <Ionicons name="save-outline" size={20} color="#F27121" />
                    <Text style={styles.draftButtonText}>SAVE AS DRAFT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.submitButton, submitting && { opacity: 0.6 }]} 
                    onPress={() => submitLeave(false)} 
                    disabled={submitting}
                  >
                    <Text style={styles.submitText}>
                        {submitting 
                            ? (editingLeave ? 'UPDATING...' : 'SUBMITTING...') 
                            : (editingLeave ? 'UPDATE REQUEST' : 'SUBMIT')
                        }
                    </Text>
                    <Ionicons name={editingLeave ? "checkmark-circle-outline" : "paper-plane-outline"} size={20} color="#FFF" style={{marginLeft: 10}} />
                  </TouchableOpacity>
                </View>
            </View>
        ) : (
            <View>
                <Text style={[styles.sectionLabel, dyn.sub]}>RECENT REQUESTS</Text>
                {loadingHistory ? (
                    <View style={styles.loadingContainer}>
                        <Text style={[styles.historyDate, dyn.sub]}>Loading your leave history...</Text>
                    </View>
                ) : history.map((item, i) => {
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

        </Reanimated.View>
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
                        showAlert({ type: 'error', title: 'Invalid Date', message: 'End date cannot be before start date.' });
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
                        showAlert({ type: 'error', title: 'Invalid Date', message: 'End date cannot be before start date.' });
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

      {/* Custom Alert Modal */}
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
  card: { borderRadius: 28, padding: 24, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15 },
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
  submitButton: { backgroundColor: '#F27121', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 20, flex: 1, gap: 8 },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  historyCard: { borderRadius: 28, marginBottom: 16, overflow: 'hidden', flexDirection: 'row', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } },
  statusLine: { width: 5, height: '100%' },
  historyContent: { flex: 1, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyType: { fontSize: 16, fontWeight: '700', marginBottom: 5 },
  historyDate: { fontSize: 13, opacity: 0.6 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    minWidth: 200,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
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
    borderWidth: 1.5,
    padding: 18,
    borderRadius: 20,
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
  // New styles for missing features
  requestedForContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  empInfoContainer: {
    flex: 1,
  },
  empName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  empDept: {
    fontSize: 13,
  },
  dayToggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dayToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'transparent',
    gap: 8,
  },
  dayToggleButtonActive: {
    borderColor: '#F27121',
  },
  dayToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  balanceInfo: {
    marginBottom: 8,
  },
  balanceType: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  balanceBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  balanceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  balanceRemaining: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  attachmentButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  attachmentsList: {
    marginTop: 12,
    gap: 10,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  attachmentItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  attachmentItemInfo: {
    flex: 1,
  },
  attachmentItemName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  attachmentItemSize: {
    fontSize: 11,
  },
  attachmentItemRemove: {
    padding: 8,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  draftButton: {
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  draftButtonText: {
    color: '#F27121',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});