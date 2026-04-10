import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, StatusBar, Modal, TextInput, Alert, ActivityIndicator, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';

// Native Date Formatter Helpers
const formatDateStr = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const formatDisplayDate = (date: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  return timeStr;
};

// Removed getWeekDays

const parseTimeStr = (timeStr: string, baseDate: Date) => {
  const d = new Date(baseDate);
  if (timeStr) {
    const parts = timeStr.split(':');
    d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  }
  return d;
};

export default function TimesheetScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStamp, setSelectedDateStamp] = useState(formatDateStr(new Date()));
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('Employee');

  const [projects, setProjects] = useState<any[]>([
    { id: 1, name: 'Internal Meeting' },
    { id: 2, name: 'Client Website TDT' },
    { id: 3, name: 'Mobile App UI/UX' },
    { id: 4, name: 'Server Maintenance' },
    { id: 5, name: 'Documentation Phase' }
  ]);
  const [activities, setActivities] = useState<any[]>([]);
  const [timesheetStatus, setTimesheetStatus] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);

  // Add Activity Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;
  
  // Form State
  const [formActivityId, setFormActivityId] = useState(null);
  const [formProjectId, setFormProjectId] = useState(null);
  const [formRemark, setFormRemark] = useState('');
  const [formStartTime, setFormStartTime] = useState<Date | null>(null);
  const [formEndTime, setFormEndTime] = useState<Date | null>(null);
  
  const [showPicker, setShowPicker] = useState<null | 'start' | 'end'>(null);
  const [showMainDatePicker, setShowMainDatePicker] = useState(false);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData(selectedDateStamp);
    }
  }, [userId, selectedDateStamp]);

  const loadUser = async () => {
    try {
      const storedId = await AsyncStorage.getItem('userId');
      const userStr = await AsyncStorage.getItem('user');
      if (storedId) setUserId(storedId);
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.username) setUsername(u.username.split('@')[0]);
      }
    } catch (e) {
      console.log('Failed to load user', e);
    }
  };

  const fetchData = async (dateStr: string) => {
    setIsLoading(true);
    try {
      const url = `${getBackendUrl()}/get-timesheet-data.php?user_id=${userId}&date=${dateStr}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setProjects(json.projects);
        setActivities(json.activities);
        if (json.timesheet) {
          setTimesheetStatus(json.timesheet.status);
        } else {
          setTimesheetStatus('pending');
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onMainDateChange = (event: any, selectedDate: Date | undefined) => {
    if (Platform.OS === 'android') setShowMainDatePicker(false);
    if (selectedDate) {
      setCurrentDate(selectedDate);
      setSelectedDateStamp(formatDateStr(selectedDate));
    }
    if (Platform.OS === 'ios' && event.type === 'set') {
      setShowMainDatePicker(false);
    }
  };

  const openAddModal = (activity: any = null) => {
    if (activity) {
      setFormActivityId(activity.id);
      setFormProjectId(activity.project_id);
      setFormRemark(activity.remark);
      
      const bDate = new Date(selectedDateStamp);
      setFormStartTime(activity.start_time ? parseTimeStr(activity.start_time, bDate) : null);
      setFormEndTime(activity.end_time ? parseTimeStr(activity.end_time, bDate) : null);
    } else {
      setFormActivityId(null);
      setFormProjectId(null); // Force user to manually select a project
      setFormRemark('');
      setFormStartTime(null);
      setFormEndTime(null);
    }
    
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 500,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  const { visible, config, showAlert, hideAlert } = useCustomAlert();

  const handleSaveActivity = async () => {
    if (!formProjectId) {
      showAlert({ type: 'warning', title: 'Required', message: 'Please select a project' });
      return;
    }
    if (!formRemark.trim()) {
      showAlert({ type: 'warning', title: 'Required', message: 'Please enter a remark or description of your work' });
      return;
    }

    if (formStartTime && formEndTime && formEndTime <= formStartTime) {
      showAlert({ type: 'warning', title: 'Invalid Time', message: 'End time must be after start time' });
      return;
    }

    setIsSaving(true);
    try {
      const st = formStartTime ? `${String(formStartTime.getHours()).padStart(2, '0')}:${String(formStartTime.getMinutes()).padStart(2, '0')}:00` : null;
      const et = formEndTime ? `${String(formEndTime.getHours()).padStart(2, '0')}:${String(formEndTime.getMinutes()).padStart(2, '0')}:00` : null;

      const body = {
        user_id: userId,
        date: selectedDateStamp,
        activity_id: formActivityId,
        project_id: formProjectId,
        start_time: st,
        end_time: et,
        remark: formRemark
      };

      const res = await fetch(`${getBackendUrl()}/save-timesheet-activity.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      
      if (json.success) {
        closeModal();
        fetchData(selectedDateStamp);
        showAlert({ type: 'success', title: 'Activity Saved', message: json.message || 'The activity has been added to your timeline!' });
      } else {
        showAlert({ type: 'error', title: 'Save Failed', message: json.message || 'Check your internet connection' });
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Connection error or invalid response');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitTimesheet = async () => {
    if (activities.length === 0) {
      showAlert({ type: 'info', title: 'Notice', message: 'No activities to submit for this date.' });
      return;
    }
    if (timesheetStatus !== 'pending') {
      showAlert({ type: 'info', title: 'Notice', message: `Timesheet is already ${timesheetStatus}` });
      return;
    }

    showAlert({
      type: 'info',
      title: 'Submit Timesheet',
      message: `Are you sure you want to submit the timesheet for ${selectedDateStamp}?`,
      onConfirm: submitToBackend,
      buttonText: 'Yes, Submit',
      cancelText: 'Cancel'
    });
  };

  const submitToBackend = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${getBackendUrl()}/submit-timesheets.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          dates: [selectedDateStamp] // batch of 1 for now, or could show a multi-select screen
        })
      });
      const json = await res.json();
      if (json.success) {
        setTimesheetStatus('submitted');
        showAlert({ type: 'success', title: 'Timesheet Submitted', message: 'Your work records have been successfully submitted for approval!' });
      } else {
        showAlert({ type: 'error', title: 'Error', message: json.message || 'Submission failed' });
      }
    } catch (e) {
      showAlert({ type: 'error', title: 'Error', message: 'Connection error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProjectName = (id: any) => {
    const p = projects.find((x: any) => String(x.id) === String(id));
    return p ? p.name : 'Select a Project...';
  };

  const onTimeChange = (event: any, selectedDate: Date | undefined) => {
    if (Platform.OS === 'android') setShowPicker(null);
    if (selectedDate) {
      if (showPicker === 'start') setFormStartTime(selectedDate);
      if (showPicker === 'end') setFormEndTime(selectedDate);
    }
    if (Platform.OS === 'ios' && event.type === 'set') {
       setShowPicker(null);
    }
  };

  // Removed weekDays setup

  const dyn = {
    bg: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    text: { color: colors.text },
    sub: { color: colors.subText },
    border: { borderColor: colors.border },
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Timesheet</Text>
        <TouchableOpacity style={styles.historyBtn}>
          <Ionicons name="time-outline" size={16} color={colors.text} />
          <Text style={[styles.historyText, dyn.text]}>History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileArea}>
        <Text style={[styles.profileName, dyn.text]}>{username}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.subText} />
      </View>

      {/* Calendar Strip (Replaced with Date Picker) */}
      <View style={styles.calendarArea}>
        <View style={styles.monthHeader}>
          <Text style={[styles.inputLabel, dyn.sub, { marginBottom: 0 }]}>Selected Date</Text>
        </View>

        <TouchableOpacity 
          style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 1 }, dyn.border, dyn.card]}
          onPress={() => setShowMainDatePicker(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#38bdf820', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar" size={20} color="#38bdf8" />
            </View>
            <View>
              <Text style={[dyn.text, { fontSize: 16, fontWeight: '600' }]}>{formatDisplayDate(currentDate)}</Text>
              <Text style={[dyn.sub, { fontSize: 12, marginTop: 2 }]}>{formatDateStr(currentDate) === formatDateStr(new Date()) ? 'Today' : 'Custom Date'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-down" size={20} color={colors.subText} />
        </TouchableOpacity>
        <View style={{ marginTop: 16 }}>
          <Text style={[dyn.sub, { fontSize: 13, fontWeight: '500' }]}>
            Timesheet Status: <Text style={{ color: timesheetStatus === 'submitted' ? '#F59E0B' : timesheetStatus === 'approved' ? '#10B981' : colors.text, textTransform: 'capitalize' }}>{timesheetStatus}</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.divider, dyn.border]} />

      {/* Activities List */}
      <ScrollView style={styles.activitiesArea} contentContainerStyle={styles.activitiesContent}>
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#FF8A00" />
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Image source={{uri: 'https://cdn-icons-png.flaticon.com/512/7486/7486776.png'}} style={{width: 120, height: 120, opacity: 0.8, marginBottom: 16}} />
            <Text style={[styles.emptyStateTitle, dyn.text]}>Let's Start Activity!</Text>
            <Text style={[styles.emptyStateSub, dyn.sub]}>Click below to log your work.</Text>
          </View>
        ) : (
          activities.map((act: any, idx) => (
            <View key={idx} style={[styles.activityCard, dyn.card, { shadowColor: isDark ? '#000' : '#888' }]}>
              <View style={styles.actHeader}>
                <View style={styles.actTimeWrap}>
                  <Ionicons name="time-outline" size={16} color="#FF8A00" />
                  <Text style={[styles.actTime, dyn.text]}>
                    {formatTime(act.start_time)} - {act.end_time ? formatTime(act.end_time) : 'Now'}
                  </Text>
                </View>
                {timesheetStatus === 'pending' && (
                  <TouchableOpacity onPress={() => openAddModal(act)} style={styles.editBtn}>
                    <Ionicons name="pencil-outline" size={16} color={colors.subText} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.actTitle, dyn.text]}>{act.remark || 'No remark provided'}</Text>
              <View style={styles.actProjectWrap}>
                <View style={styles.actProjectDot} />
                <Text style={[styles.actProject, dyn.sub]}>{getProjectName(act.project_id)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomBar, dyn.border, dyn.bg]}>
         <TouchableOpacity 
            style={[styles.btnAction, styles.btnOutline]} 
            onPress={handleSubmitTimesheet}
            disabled={isSubmitting || timesheetStatus !== 'pending'}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FF8A00" />
            ) : (
              <Text style={[styles.btnOutlineText, { opacity: timesheetStatus !== 'pending' ? 0.5 : 1 }]}>
                {timesheetStatus !== 'pending' ? 'Submitted' : 'Submit Timesheet'}
              </Text>
            )}
         </TouchableOpacity>

         <TouchableOpacity 
            style={[styles.btnAction, styles.btnSolid]} 
            onPress={() => openAddModal()}
            disabled={timesheetStatus !== 'pending'}
          >
            <Text style={styles.btnSolidText}>Add Activity</Text>
         </TouchableOpacity>
      </View>

      {/* Add Activity Modal */}
      <Modal visible={isModalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <Animated.View style={[styles.modalContent, dyn.bg, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.mDragHandle} />
            <Text style={[styles.mTitle, dyn.text]}>{formActivityId ? 'Edit Activity' : 'Add Activity'}</Text>
            <Text style={[styles.mSubtitle, dyn.text]}>{formatDisplayDate(new Date(selectedDateStamp))}</Text>
            
            <View style={[styles.mNoticeBox]}>
              <Text style={styles.mNoticeText}>You can just tap "Save" and we will automatically note the start time for you.</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Times */}
              <View style={styles.timeRow}>
                <View style={styles.timeFieldWrap}>
                  <Text style={[styles.inputLabel, dyn.sub]}>Start Time</Text>
                  <TouchableOpacity style={[styles.timeInput, dyn.card, dyn.border]} onPress={() => setShowPicker('start')}>
                    <Text style={[dyn.text, !formStartTime && dyn.sub]}>{formStartTime ? formatTime(`${formStartTime.getHours()}:${formStartTime.getMinutes()}`) : '--:--'}</Text>
                    <Ionicons name="time-outline" size={18} color={colors.subText} />
                  </TouchableOpacity>
                </View>

                <View style={styles.timeFieldWrap}>
                  <Text style={[styles.inputLabel, dyn.sub]}>End Time</Text>
                  <TouchableOpacity style={[styles.timeInput, dyn.card, dyn.border]} onPress={() => setShowPicker('end')}>
                    <Text style={[dyn.text, !formEndTime && dyn.sub]}>{formEndTime ? formatTime(`${formEndTime.getHours()}:${formEndTime.getMinutes()}`) : '--:--'}</Text>
                    <Ionicons name="time-outline" size={18} color={colors.subText} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remark */}
              <Text style={[styles.inputLabel, dyn.sub]}>Remark</Text>
              <TextInput
                style={[styles.inputArea, dyn.card, dyn.border, dyn.text]}
                placeholder="E.g. Meeting Online..."
                placeholderTextColor={colors.subText + '80'}
                value={formRemark}
                onChangeText={setFormRemark}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, dyn.sub]}>Project</Text>
              <TouchableOpacity 
                style={[styles.projectSelect, dyn.card, dyn.border, !formProjectId && { borderColor: '#FF8A00' }]} 
                onPress={() => setShowProjectSelect(!showProjectSelect)}
              >
                  <Text style={[dyn.text, !formProjectId && { color: '#FF8A00' }]}>{getProjectName(formProjectId)}</Text>
                <Ionicons name="chevron-down" size={18} color={!formProjectId ? '#FF8A00' : colors.subText} />
              </TouchableOpacity>
              
              {/* The inline project list was moved to a standalone modal for better visibility */}

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveActivity} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>

          </Animated.View>
        </View>

        {showPicker && (
          <DateTimePicker
            value={(showPicker === 'start' ? formStartTime : formEndTime) || new Date()}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={onTimeChange}
          />
        )}
      </Modal>

      {showMainDatePicker && (
          <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={onMainDateChange}
        />
      )}

      {/* Project Selection Modal */}
      <Modal visible={showProjectSelect} transparent animationType="fade" onRequestClose={() => setShowProjectSelect(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowProjectSelect(false)} />
          <View style={[dyn.bg, { margin: 24, borderRadius: 16, padding: 20, maxHeight: '60%', width: '85%', alignSelf: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 }]}>
            <Text style={[dyn.text, { fontSize: 18, fontWeight: '700', marginBottom: 16 }]}>Select a Project</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {projects.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={[dyn.sub, { textAlign: 'center' }]}>No projects found. Please ensure they are set up in the database.</Text>
                </View>
              ) : (
                projects.map((p: any) => (
                  <TouchableOpacity 
                    key={p.id} 
                    style={{ paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
                    onPress={() => { setFormProjectId(p.id); setShowProjectSelect(false); }}
                  >
                    <Text style={[dyn.text, { fontSize: 16 }, formProjectId === p.id && {color: '#FF8A00', fontWeight: 'bold'}]}>{p.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity 
              style={{ marginTop: 16, padding: 12, alignItems: 'center', backgroundColor: isDark ? '#333' : '#F3F4F6', borderRadius: 8 }}
              onPress={() => setShowProjectSelect(false)}
            >
              <Text style={dyn.text}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CustomAlert 
        visible={visible} 
        {...config} 
        onClose={hideAlert} 
        onConfirm={config.onClose || config.onConfirm}
        onCancel={config.onCancel}
      />
    </SafeAreaView>
  );
}

// @ts-ignore
import { Image } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  historyText: { fontSize: 13, fontWeight: '600' },
  profileArea: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: { fontSize: 18, fontWeight: '700' },
  calendarArea: { paddingHorizontal: 20, paddingBottom: 16 },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthText: { fontSize: 14, fontWeight: '600' },
  monthArrows: { flexDirection: 'row', gap: 16 },
  arrowBtn: { padding: 4 },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayBox: {
    width: 44,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBoxSelected: {
    backgroundColor: '#38bdf8',
  },
  textWhite: { color: '#FFF' },
  dayName: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dayNumber: { fontSize: 15, fontWeight: '700' },
  divider: {
    height: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  activitiesArea: { flex: 1 },
  activitiesContent: { padding: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyStateSub: { fontSize: 14 },
  activityCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  actHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  actTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actTime: { fontSize: 14, fontWeight: '600' },
  editBtn: { padding: 4 },
  actTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12, lineHeight: 22 },
  actProjectWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actProjectDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  actProject: { fontSize: 12, fontWeight: '500' },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  btnAction: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#FF8A00',
    backgroundColor: 'transparent',
  },
  btnOutlineText: { color: '#FF8A00', fontWeight: '700', fontSize: 15 },
  btnSolid: { backgroundColor: '#FF8A00' },
  btnSolidText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  mDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  mTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  mSubtitle: { fontSize: 14, fontWeight: '500', opacity: 0.7, marginBottom: 20 },
  mNoticeBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  mNoticeText: { color: '#dc2626', fontSize: 12, fontWeight: '500', lineHeight: 18 },
  
  timeRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  timeFieldWrap: { flex: 1 },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    marginBottom: 20,
    fontSize: 15,
  },
  projectSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  projectList: {
    marginTop: -16,
    marginBottom: 24,
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 150,
  },
  projectListItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalSaveBtn: {
    backgroundColor: '#FF8A00',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});
