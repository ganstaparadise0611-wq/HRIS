import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// @ts-ignore - DateTimePicker types may not be available
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../constants/backend-config';
import { recheckNetwork } from '../../constants/network-detector';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming, Easing, interpolate } from 'react-native-reanimated';

export default function UserOvertime() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';
  
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [overtimeType, setOvertimeType] = useState('Regular OT');
  const [leaveType, setLeaveType] = useState('Compensatory Day Off');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [empId, setEmpId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showOvertimeTypeDropdown, setShowOvertimeTypeDropdown] = useState(false);
  const [showLeaveTypeDropdown, setShowLeaveTypeDropdown] = useState(false);
  const [dropdownButtonLayout, setDropdownButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const overtimeTypeRef = useRef<View>(null);
  const leaveTypeRef = useRef<View>(null);
  
  const overtimeTypes = ['Regular OT', 'Extra Leave', 'Emergency'];
  const leaveTypes = ['Compensatory Day Off', 'Leave Encashment', 'Weekend Off'];

  // Build backend URL for a PHP endpoint
  const buildPhpUrl = (path: string, opts?: { usePublic?: boolean }) => {
    const baseUrl = getBackendUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const prefix = opts?.usePublic ? '/public' : '';
    return `${baseUrl}${prefix}${cleanPath}`;
  };

  // Fetch helper that retries with "/public" prefix if the server returns 404
  const fetchPhpWithPublicFallback = async (
    path: string,
    init: RequestInit
  ): Promise<Response> => {
    const headers = {
      ...init.headers,
      'ngrok-skip-browser-warning': 'true',
    };
    const modifiedInit = { ...init, headers };
    
    const url1 = buildPhpUrl(path, { usePublic: false });
    const res1 = await fetch(url1, modifiedInit);
    if (res1.status !== 404) return res1;

    const url2 = buildPhpUrl(path, { usePublic: true });
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
      } catch (_e) {
        // Ignore storage errors
      } finally {
        await loadDraftForm();
        await loadHistory();
      }
    };
    loadStoredDataAndHistory();
  }, []);

  useEffect(() => {
    recheckNetwork().catch(() => {});
  }, []);

  const ensureEmpId = async (): Promise<number | null> => {
    if (empId !== null) {
      return empId;
    }
    let effectiveUsername = username;
    if (!effectiveUsername) {
      effectiveUsername = await AsyncStorage.getItem('username');
      if (effectiveUsername) {
        setUsername(effectiveUsername);
      }
    }
    if (!effectiveUsername) {
      showAlert({ type: 'error', title: 'Not logged in', message: 'Username not found. Please log in again.' });
      return null;
    }

    try {
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
            employees = [{ emp_id: rpcResult.emp_id }];
          }
        }
      } catch (_rpcError) {
        // RPC may not exist; try direct query
      }
      
      if (!employees || employees.length === 0) {
        const queryUrl = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logIdValue}&select=emp_id`;
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
        }
      }
      
      if (!employees || employees.length === 0) {
        const logIdToEmpIdMap: { [key: number]: number } = {
          3: 6,
        };
        
        if (logIdToEmpIdMap[logIdValue]) {
          const mappedEmpId = logIdToEmpIdMap[logIdValue];
          setEmpId(mappedEmpId);
          await AsyncStorage.setItem('emp_id', String(mappedEmpId));
          return mappedEmpId;
        }
        
        showAlert({ type: 'error', title: 'Employee ID Not Found', message: 'Unable to find your employee ID. Please contact HR.' });
        return null;
      }

      const resolvedEmpId = employees[0].emp_id;
      setEmpId(resolvedEmpId);
      await AsyncStorage.setItem('emp_id', String(resolvedEmpId));
      return resolvedEmpId as number;
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Error', message: error.message || 'Unable to load employee information.' });
      return null;
    }
  };

  // Calculate total hours
  const calculateHours = (): number => {
    const start = new Date(startDate);
    start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    
    const end = new Date(endDate);
    end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    
    // Handle case where end time is before start time (if user forgets to change date)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, Math.round(diffHours * 10) / 10); // Round to 1 decimal place
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
  const submitOvertime = async (asDraft: boolean = false) => {
    if (!reason.trim()) {
      showAlert({ type: 'error', title: 'Missing information', message: 'Please enter a reason for your overtime.' });
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

      const payload = {
        action: 'create',
        emp_id: resolvedEmpId,
        date: formatDateForDB(startDate),
        end_date: formatDateForDB(endDate),
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
        reason: reason.trim(),
        remarks: remarks.trim(),
        overtime_type: overtimeType,
        leave_type: overtimeType === 'Extra Leave' ? leaveType : null,
      };

      const res = await fetchPhpWithPublicFallback('/overtime_requests.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const rawErr = await res.text().catch(() => '');
        let errData: any = {};
        try {
          errData = JSON.parse(rawErr || '{}');
        } catch {
          errData = {};
        }
        throw new Error(errData.message || 'Failed to submit overtime request.');
      }

      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.message || 'Failed to submit overtime request.');
      }

      let overtimeId = null;
      if (result.data && result.data.length > 0) {
        overtimeId = result.data[0].ovt_id;
      }

      // Upload attachments if there are any and we got an overtime_id
      if (attachments.length > 0 && overtimeId) {
        for (const attachment of attachments) {
          try {
            const formData = new FormData();
            formData.append('ovt_id', String(overtimeId));
            formData.append('file', {
              uri: attachment.uri,
              name: attachment.name,
              type: attachment.mimeType,
            } as any);

            await fetchPhpWithPublicFallback('/overtime-attachments.php', {
              method: 'POST',
              body: formData,
            });
          } catch (uploadErr) {
            console.warn(`Error uploading attachment ${attachment.name}:`, uploadErr);
          }
        }
      }

      showAlert({ type: 'success', title: 'Success', message: 'Overtime request submitted successfully!' });
      setReason('');
      setRemarks('');
      setStartDate(new Date());
      setEndDate(new Date());
      setStartTime(new Date(new Date().setHours(17, 0, 0, 0)));
      setEndTime(new Date(new Date().setHours(20, 0, 0, 0)));
      setOvertimeType('Regular OT');
      setLeaveType('Compensatory Day Off');
      setAttachments([]);
      await clearDraft();
      await loadHistory();
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Error', message: error.message || 'Unable to submit overtime request.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Load overtime history
  const loadHistory = async () => {
    const resolvedEmpId = await ensureEmpId();
    if (resolvedEmpId === null) {
      setHistory([]);
      return;
    }

    try {
      setLoadingHistory(true);

      const res = await fetchPhpWithPublicFallback(`/overtime_requests.php?emp_id=${encodeURIComponent(String(resolvedEmpId))}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
      if (history.length > 0) {
        showAlert({ type: 'error', title: 'Error', message: 'Unable to load overtime history.' });
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  // Save draft to AsyncStorage
  const saveDraft = async () => {
    try {
      const draft = {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        startTime: startTime?.toISOString() || null,
        endTime: endTime?.toISOString() || null,
        reason,
        remarks,
        overtimeType,
        leaveType,
        attachments: attachments.map(a => ({ name: a.name })),
      };
      await AsyncStorage.setItem('overtimeDraft', JSON.stringify(draft));
      showAlert({ type: 'success', title: 'Saved', message: 'Your overtime request has been saved as draft.' });
    } catch (error) {
      showAlert({ type: 'error', title: 'Error', message: 'Failed to save draft.' });
    }
  };

  // Load draft from AsyncStorage
  const loadDraftForm = async () => {
    try {
      const draftData = await AsyncStorage.getItem('overtimeDraft');
      if (draftData) {
        const draft = JSON.parse(draftData);
        if (draft.startDate) setStartDate(new Date(draft.startDate));
        if (draft.endDate) setEndDate(new Date(draft.endDate));
        if (draft.startTime) setStartTime(new Date(draft.startTime));
        if (draft.endTime) setEndTime(new Date(draft.endTime));
        if (draft.reason) setReason(draft.reason);
        if (draft.remarks) setRemarks(draft.remarks);
        if (draft.overtimeType) setOvertimeType(draft.overtimeType);
        if (draft.leaveType) setLeaveType(draft.leaveType);
      }
    } catch (error) {
      // Silently fail
    }
  };

  // Clear draft
  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem('overtimeDraft');
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

  const totalHours = calculateHours();

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    input: { backgroundColor: isDark ? '#252525' : '#F0F0F0', color: colors.text },
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
        <Reanimated.View style={animatedStyle}>
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
            <Text style={[styles.inputLabel, dyn.sub]}>Start Date</Text>
            <TouchableOpacity style={[styles.fakeInput, dyn.input]} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.inputText, dyn.text]}>{formatDate(startDate)}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.subText} />
            </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>End Date</Text>
            <TouchableOpacity style={[styles.fakeInput, dyn.input]} onPress={() => setShowEndDatePicker(true)}>
                <Text style={[styles.inputText, dyn.text]}>{formatDate(endDate)}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.subText} />
            </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>Overtime Type</Text>
            <View ref={overtimeTypeRef}>
                <TouchableOpacity 
                    style={[styles.fakeInput, dyn.input]}
                    onPress={() => {
                        overtimeTypeRef.current?.measureInWindow((x, y, width, height) => {
                            setDropdownButtonLayout({ x, y, width, height });
                            setShowOvertimeTypeDropdown(true);
                        });
                    }}
                >
                    <Text style={[styles.inputText, dyn.text]}>{overtimeType}</Text>
                    <Ionicons name={showOvertimeTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.subText} />
                </TouchableOpacity>
            </View>
            <Modal
                visible={showOvertimeTypeDropdown}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOvertimeTypeDropdown(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOvertimeTypeDropdown(false)}
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
                        {overtimeTypes.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                    setOvertimeType(type);
                                    setShowOvertimeTypeDropdown(false);
                                }}
                            >
                                <Text style={[styles.dropdownItemText, dyn.text, overtimeType === type && { color: '#F27121', fontWeight: 'bold' }]}>
                                    {type}
                                </Text>
                                {overtimeType === type && <Ionicons name="checkmark" size={20} color="#F27121" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>

        {overtimeType === 'Extra Leave' && (
            <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, dyn.sub]}>Leave Type</Text>
                <View ref={leaveTypeRef}>
                    <TouchableOpacity 
                        style={[styles.fakeInput, dyn.input]}
                        onPress={() => {
                            leaveTypeRef.current?.measureInWindow((x, y, width, height) => {
                                setDropdownButtonLayout({ x, y, width, height });
                                setShowLeaveTypeDropdown(true);
                            });
                        }}
                    >
                        <Text style={[styles.inputText, dyn.text]}>{leaveType}</Text>
                        <Ionicons name={showLeaveTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.subText} />
                    </TouchableOpacity>
                </View>
                <Modal
                    visible={showLeaveTypeDropdown}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowLeaveTypeDropdown(false)}
                >
                    <TouchableOpacity 
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowLeaveTypeDropdown(false)}
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
                                    style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                                    onPress={() => {
                                        setLeaveType(type);
                                        setShowLeaveTypeDropdown(false);
                                    }}
                                >
                                    <Text style={[styles.dropdownItemText, dyn.text, leaveType === type && { color: '#F27121', fontWeight: 'bold' }]}>
                                        {type}
                                    </Text>
                                    {leaveType === type && <Ionicons name="checkmark" size={20} color="#F27121" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableOpacity>
                </Modal>
            </View>
        )}

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

        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>Remarks</Text>
            <TextInput 
                style={[styles.textInput, dyn.input, { height: 80, textAlignVertical: 'top' }]} 
                placeholder="Additional remarks or comments..." 
                placeholderTextColor={colors.subText}
                multiline
                value={remarks}
                onChangeText={setRemarks}
            />
        </View>

        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>Attachments</Text>
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

        <View style={styles.buttonRow}>
            <TouchableOpacity 
                style={[styles.draftButton, { borderColor: colors.border }]} 
                onPress={() => submitOvertime(true)}
                disabled={submitting}
            >
                <Ionicons name="save-outline" size={20} color="#F27121" />
                <Text style={styles.draftButtonText}>SAVE AS DRAFT</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
                onPress={() => submitOvertime(false)}
                disabled={submitting}
            >
                <Text style={styles.submitText}>
                    {submitting ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
                </Text>
            </TouchableOpacity>
        </View>

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
                        <Text style={[styles.datePickerTitle, dyn.text]}>Select Start Date</Text>
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event: any, date?: Date) => {
                                if (Platform.OS === 'android') {
                                    setShowDatePicker(false);
                                    if (event.type === 'set' && date) {
                                        setStartDate(date);
                                        if (endDate < date) {
                                            setEndDate(date);
                                        }
                                    }
                                } else if (Platform.OS === 'ios' && date) {
                                    setStartDate(date);
                                    if (endDate < date) {
                                        setEndDate(date);
                                    }
                                }
                            }}
                            themeVariant={isDark ? "dark" : "light"}
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

        {/* End Date Picker Modal */}
        {showEndDatePicker && (
            <Modal
                visible={showEndDatePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowEndDatePicker(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowEndDatePicker(false)}
                >
                    <View 
                        style={[styles.datePickerContainer, dyn.card, { borderColor: colors.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={[styles.datePickerTitle, dyn.text]}>Select End Date</Text>
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event: any, date?: Date) => {
                                if (Platform.OS === 'android') {
                                    setShowEndDatePicker(false);
                                    if (event.type === 'set' && date) {
                                        if (date < startDate) {
                                            showAlert({ type: 'error', title: 'Invalid Date', message: 'End date cannot be before start date.'});
                                        } else {
                                            setEndDate(date);
                                        }
                                    }
                                } else if (Platform.OS === 'ios' && date) {
                                    if (date < startDate) {
                                        showAlert({ type: 'error', title: 'Invalid Date', message: 'End date cannot be before start date.'});
                                    } else {
                                        setEndDate(date);
                                    }
                                }
                            }}
                            themeVariant={isDark ? "dark" : "light"}
                            minimumDate={startDate}
                        />
                        {Platform.OS === 'ios' && (
                            <View style={styles.datePickerButtons}>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: colors.border }]}
                                    onPress={() => setShowEndDatePicker(false)}
                                >
                                    <Text style={[styles.datePickerButtonText, dyn.text]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.datePickerButton, { backgroundColor: '#F27121' }]}
                                    onPress={() => setShowEndDatePicker(false)}
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

        </Reanimated.View>
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
  timeCard: { backgroundColor: '#252525', borderRadius: 28, padding: 25, alignItems: 'center', marginBottom: 30, borderTopWidth: 4, borderTopColor: '#F27121' },
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
  textInput: { padding: 15, borderRadius: 16, fontSize: 16 },
  submitBtn: { backgroundColor: '#F27121', padding: 15, borderRadius: 20, alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  historyItem: { padding: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15 },
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
  dropdownItemText: {
    fontSize: 16,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 30,
  },
    draftButton: {
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
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