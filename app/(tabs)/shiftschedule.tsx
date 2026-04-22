import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { 
  ActivityIndicator,
  Image, 
  Platform, 
  SafeAreaView, 
  ScrollView, 
  StatusBar, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View 
} from 'react-native';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

export default function ShiftScheduleScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const { visible, config, showAlert, hideAlert } = useCustomAlert();

  // State
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('apply');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [employee, setEmployee] = useState('Loading...');
  const [position, setPosition] = useState('Employee');
  const [employeeId, setEmployeeId] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date()); 
  const [endDate, setEndDate] = useState(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)); 
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
      fetchHistory();
    }, [])
  );

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/shift_requests?user_id=eq.${userId}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.warn('Failed to load history');
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setEmployee('Guest');
        return;
      }

      // 1. Load Employee Data
      const empUrl = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${userId}&select=*`;
      const empRes = await fetch(empUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      const empData = await empRes.json();
      if (empData && empData.length > 0) {
        setEmployee(empData[0].name);
        setPosition(empData[0].role || 'Employee');
        setEmployeeId(`EMP-${empData[0].emp_id || '0000'}`);
      }

      // 2. Load Profile Picture from accounts
      const accUrl = `${SUPABASE_URL}/rest/v1/accounts?log_id=eq.${userId}&select=profile_picture`;
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
    } catch (err) {
      console.warn('Failed to load user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const dyn = {
    bg: { backgroundColor: isDark ? colors.background : '#F8F9FA' },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
    border: { borderColor: isDark ? '#334155' : '#E2E8F0' },
    accent: '#F27121', 
    inputBg: isDark ? '#0F172A' : '#F1F5F9',
    softOrange: isDark ? 'rgba(242, 113, 33, 0.15)' : '#FFF0E6',
  };

  const handleNext = () => setStep(1);
  const handleBack = () => {
    if (step === 1) setStep(0);
    else router.back();
  };

  // Dynamically generate schedule based on selected dates (Start and End only)
  const getScheduleData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startObj = {
      day: start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      hours: '8 Hours',
      shift: 'Morning Shift',
      time: '08:00 - 17:00',
      original: '08:00 - 17:00'
    };

    const endObj = {
      day: end.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      hours: '8 Hours',
      shift: 'Morning Shift',
      time: '08:00 - 17:00',
      original: '08:00 - 17:00'
    };

    // If start and end are the same day, just show one
    if (start.toDateString() === end.toDateString()) {
      return [startObj];
    }
    
    return [startObj, endObj];
  };

  const scheduleData = getScheduleData();

  const renderSelectionStep = () => (
    <View style={styles.content}>
      {/* Profile Preview Card */}
      <View style={[styles.profilePreview, dyn.card, dyn.border]}>
         <View style={styles.avatarContainer}>
          {profilePicture ? (
            <Image 
              source={{ uri: profilePicture }} 
              style={styles.previewAvatar} 
            />
          ) : (
            <View style={[styles.previewAvatar, { backgroundColor: dyn.softOrange, justifyContent: 'center', alignItems: 'center' }]}>
               <Ionicons name="person" size={30} color={dyn.accent} />
            </View>
          )}
         </View>
         <View style={styles.previewInfo}>
            <Text style={[styles.previewName, dyn.text]}>{employee}</Text>
            <Text style={[styles.previewSub, dyn.sub]}>{position}</Text>
            <View style={styles.idBadge}>
              <Text style={styles.idText}>{employeeId}</Text>
            </View>
         </View>
         <View style={styles.basePlanSection}>
            <Text style={styles.basePlanLabel}>Assigned Shift</Text>
            <Text style={[styles.basePlanVal, dyn.text]}>{scheduleData[0].original}</Text>
         </View>
      </View>

      <View style={[styles.cardContainer, dyn.card]}>
        <Text style={[styles.sectionTitle, dyn.text]}>Schedule Range</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, dyn.sub]}>Employee</Text>
          <TouchableOpacity style={[styles.input, { backgroundColor: dyn.inputBg }]}>
            <View style={styles.inputLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: dyn.softOrange }]}>
                <Ionicons name="person" size={16} color={dyn.accent} />
              </View>
              <Text style={[styles.inputText, dyn.text]}>{employee}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={dyn.sub.color} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, dyn.sub]}>Start Date</Text>
          <TouchableOpacity 
            style={[styles.input, { backgroundColor: dyn.inputBg }]}
            onPress={() => setShowStartPicker(true)}
          >
            <View style={styles.inputLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: dyn.softOrange }]}>
                <Ionicons name="calendar" size={16} color={dyn.accent} />
              </View>
              <Text style={[styles.inputText, dyn.text]}>
                {startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, dyn.sub]}>End Date</Text>
          <TouchableOpacity 
            style={[styles.input, { backgroundColor: dyn.inputBg }]}
            onPress={() => setShowEndPicker(true)}
          >
            <View style={styles.inputLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: dyn.softOrange }]}>
                <Ionicons name="calendar" size={16} color={dyn.accent} />
              </View>
              <Text style={[styles.inputText, dyn.text]}>
                {endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: dyn.accent }]} onPress={handleNext}>
        <Text style={styles.primaryButtonText}>View Schedule</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );

  const renderScheduleStep = () => (
    <View style={styles.content}>
      {/* Enhanced Summary Card with Profile and Schedule Comparison */}
      <View style={[styles.summaryCard, dyn.card, dyn.border]}>
        
        {/* Header Row */}
        <View style={[styles.summaryTopRow, dyn.border]}>
          <View style={styles.summaryHeaderEmpCol}>
            <Text style={styles.summaryEmployeeLabel}>Employee Name</Text>
          </View>
          <View style={styles.summaryDateHeaders}>
            {scheduleData.map((item, idx) => (
              <View key={idx} style={[styles.summaryDateHeader, idx !== 0 && styles.colBorderLeft]}>
                <Text style={styles.summDay}>{item.day}</Text>
                <Text style={styles.summHours}>{item.hours}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Data Row */}
        <View style={styles.summaryDataRow}>
          <View style={styles.summaryEmpInfo}>
            {profilePicture ? (
              <Image 
                source={{ uri: profilePicture }} 
                style={styles.avatar} 
              />
            ) : (
               <View style={[styles.avatar, { backgroundColor: dyn.softOrange, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={20} color={dyn.accent} />
               </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryName, dyn.text]} numberOfLines={1}>{employee}</Text>
              <Text style={[styles.summaryTotalHours, dyn.sub]}>40 Hours</Text>
              <View style={styles.originalTag}>
                <Text style={styles.originalTagText}>Orig: {scheduleData[0].original}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryCells}>
            {scheduleData.map((item, idx) => (
              <View key={idx} style={[styles.summaryCell, styles.colBorderLeft]}>
                <View style={[styles.shiftBadge, { backgroundColor: dyn.softOrange }]}>
                  <Text style={[styles.summShift, { color: dyn.accent }]}>{item.shift}</Text>
                </View>
                <Text style={[styles.summTime, dyn.text]}>{item.time}</Text>
                {item.time !== item.original && (
                   <View style={styles.changeDot} />
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity 
        style={[styles.primaryButton, { backgroundColor: dyn.accent }]} 
        onPress={handleSubmit} 
        disabled={submitting}
      >
        {submitting ? (
           <ActivityIndicator color="#FFF" />
        ) : (
           <Text style={styles.primaryButtonText}>Confirm & Submit</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <View style={[styles.tabContainer, dyn.card, dyn.border]}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'apply' && { borderBottomColor: dyn.accent, borderBottomWidth: 2 }]} 
        onPress={() => setActiveTab('apply')}
      >
        <Text style={[styles.tabText, activeTab === 'apply' ? { color: dyn.accent, fontWeight: 'bold' } : dyn.sub]}>Apply</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'history' && { borderBottomColor: dyn.accent, borderBottomWidth: 2 }]} 
        onPress={() => setActiveTab('history')}
      >
        <Text style={[styles.tabText, activeTab === 'history' ? { color: dyn.accent, fontWeight: 'bold' } : dyn.sub]}>History</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHistory = () => (
    <ScrollView style={styles.content}>
      {loadingHistory ? (
        <ActivityIndicator size="large" color={dyn.accent} style={{ marginTop: 50 }} />
      ) : history.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 50, color: dyn.sub.color }}>No shift schedule history found.</Text>
      ) : (
        history.map((item, id) => (
          <View key={id} style={[dyn.card, dyn.border, { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 15 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[dyn.text, { fontWeight: 'bold' }]}>Requested Range</Text>
              <View style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }, { backgroundColor: item.status === 'Approved' ? '#E8F5E9' : item.status === 'Rejected' ? '#FFEBEE' : '#FFF3E0' }]}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: item.status === 'Approved' ? '#4CAF50' : item.status === 'Rejected' ? '#F44336' : '#FF9800' }}>{item.status || 'Pending'}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: dyn.inputBg, padding: 12, borderRadius: 8 }}>
               <Text style={[dyn.text, { fontSize: 14 }]}>Start: {item.start_date || 'N/A'}</Text>
               <Text style={[dyn.text, { fontSize: 14, marginTop: 4 }]}>End: {item.end_date || 'N/A'}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        showAlert({ type: 'error', title: 'Error', message: 'User log ID not found.' });
        setSubmitting(false);
        return;
      }
      
      const payload = {
        user_id: userId,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'Pending'
      };

      const submitRes = await fetch(`${SUPABASE_URL}/rest/v1/shift_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (!submitRes.ok) {
        console.error('Submission Response Error', await submitRes.text());
        throw new Error('Submission failed');
      }

      await fetchHistory();
      
      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Shift schedule submitted successfully. Pending Admin approval.',
        onClose: () => {
           setStep(0);
           setActiveTab('history');
        }
      });
    } catch (e) {
      showAlert({ type: 'error', title: 'System Error', message: 'Failed to securely submit shift schedule. Please check your connection.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Shift Schedule</Text>
        {step === 1 ? (
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={24} color={dyn.text.color} />
          </TouchableOpacity>
        ) : <View style={{ width: 34 }} />}
      </View>

      {step === 0 && renderTabs()}
      {step === 0 && activeTab === 'apply' && renderSelectionStep()}
      {step === 0 && activeTab === 'history' && renderHistory()}
      {step === 1 && renderScheduleStep()}

      <CustomAlert visible={visible} title={config.title} message={config.message} type={config.type} onClose={hideAlert}/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    height: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  shareButton: { padding: 5 },
  
  tabContainer: {
    flexDirection: 'row', height: 45, borderBottomWidth: 1
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center'
  },
  tabText: {
    fontSize: 15
  },

  content: { flex: 1, padding: 20 },
  cardContainer: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 16,
  },
  inputLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputText: { fontSize: 15, fontWeight: '500' },
  
  profilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  previewAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16 },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  previewSub: { fontSize: 13, marginBottom: 8 },
  idBadge: { 
    backgroundColor: 'rgba(242, 113, 33, 0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  idText: { color: '#F27121', fontSize: 10, fontWeight: '700' },

  primaryButton: { 
    flexDirection: 'row',
    height: 56, 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10,
    shadowColor: '#F27121',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  
  summaryCard: { 
    borderRadius: 24, 
    borderWidth: 1,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05, 
    shadowRadius: 15,
    elevation: 4,
    overflow: 'hidden',
  },

  summaryTopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)'
  },
  summaryHeaderEmpCol: {
    width: '42%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryEmployeeLabel: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#F27121' 
  },
  summaryDateHeaders: { 
    flex: 1, 
    flexDirection: 'row', 
  },
  summaryDateHeader: { 
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16
  },
  colBorderLeft: {
    borderLeftWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  summDay: { fontSize: 13, fontWeight: '700', color: '#F27121' },
  summHours: { fontSize: 11, color: '#888', marginTop: 4 },

  summaryDataRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: 'rgba(242, 113, 33, 0.02)',
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 8
  },
  summaryEmpInfo: { 
    width: '42%', 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingLeft: 12
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 14, borderWidth: 2, borderColor: '#FFF' },
  summaryName: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  summaryTotalHours: { fontSize: 12, color: '#888' },
  originalTag: {
    marginTop: 6,
    backgroundColor: 'rgba(242, 113, 33, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  originalTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F27121',
  },
  
  summaryCells: { 
    flex: 1, 
    flexDirection: 'row', 
    justifyContent: 'space-around' 
  },
  summaryCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  shiftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 6,
  },
  summShift: { fontSize: 10, fontWeight: '900' },
  summTime: { fontSize: 13, fontWeight: '700' },
  changeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F27121',
    marginTop: 2,
  },
  basePlanSection: {
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center'
  },
  basePlanLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 2
  },
  basePlanVal: {
    fontSize: 10,
    fontWeight: '700'
  },
});
