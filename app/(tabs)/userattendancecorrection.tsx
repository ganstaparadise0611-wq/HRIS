import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../constants/backend-config';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';

export default function UserAttendanceCorrection() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const backendUrl = getBackendUrl();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  
  // Profile State
  const [employee, setEmployee] = useState('Loading...');
  const [position, setPosition] = useState('Employee');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  // Workflow State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('apply');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Step 1 State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  
  // Step 2 & 3 State
  const [details, setDetails] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<any>(null);
  
  // Step 3 Form State
  const [formShift, setFormShift] = useState('SHIFTSPV [08:00 - 17:00]');
  const [formReason, setFormReason] = useState('');
  const [aStart, setAStart] = useState('08:00 AM');
  const [aEnd, setAEnd] = useState('05:00 PM');
  const [showTimePickerS, setShowTimePickerS] = useState(false);
  const [showTimePickerE, setShowTimePickerE] = useState(false);

  const dyn = {
    bg: { backgroundColor: isDark ? colors.background : '#F8F9FA' },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
    border: { borderColor: isDark ? '#334155' : '#E2E8F0' },
    accent: '#F27121',
    surface: isDark ? '#0F172A' : '#F1F5F9'
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      
      const res = await fetch(`${backendUrl}/get-attendance-corrections.php?user_id=${userId}`);
      const data = await res.json();
      
      if (data.success && data.corrections) {
        setHistory(data.corrections);
      }
    } catch (err) {
      console.warn('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      fetchHistory();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setEmployee('Guest');
        return;
      }
      const empUrl = `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${userId}&select=*`;
      const empRes = await fetch(empUrl, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const empData = await empRes.json();
      if (empData?.length > 0) {
        setEmployee(empData[0].name);
        setPosition(empData[0].role || 'Employee');
      }
      const accUrl = `${SUPABASE_URL}/rest/v1/accounts?log_id=eq.${userId}&select=profile_picture`;
      const accRes = await fetch(accUrl, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const accData = await accRes.json();
      if (accData?.length > 0) setProfilePicture(accData[0].profile_picture);
    } catch (err) {
      console.warn('Profile load failed');
    }
  };

  const handleNext = async () => {
    if (endDate < startDate) {
      showAlert({ type: 'warning', title: 'Invalid Date', message: 'End date cannot be before Start date.' });
      return;
    }

    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      let attHistory: any[] = [];
      
      if (userId) {
        const res = await fetch(`${backendUrl}/get-attendance-history.php?user_id=${userId}`);
        const data = await res.json();
        if (data.ok && data.history) {
          attHistory = data.history;
        }
      }

      const dList = [];
      let curr = new Date(startDate);
      while (curr <= endDate) {
         const dateString = curr.toISOString().split('T')[0];
         dList.push({
            id: curr.getTime(),
            date: new Date(curr),
            beforeStart: '08:00',
            beforeEnd: '06:00', 
            afterStart: '08:00:00',
            afterEnd: '18:00:00',
            shift: 'SHIFTSPV',
            reason: '',
            changed: false
         });
         curr.setDate(curr.getDate() + 1);
      }
      setDetails(dList);
      setStep(2);
    } catch (e) {
      showAlert({ type: 'error', title: 'Network Error', message: 'Failed to fetch attendance history.' });
    } finally {
      setLoading(false);
    }
  };

  const convertTo24Hour = (timeStr: string) => {
    if (!timeStr) return "00:00:00";
    const normalized = timeStr.replace(/[\u202F\s]/g, ' ').trim().toUpperCase();
    if (!normalized.includes('AM') && !normalized.includes('PM')) {
      const parts = normalized.split(':');
      if (parts.length === 2) return `${normalized}:00`;
      return normalized;
    }
    const [time, modifier] = normalized.split(' ');
    let [hours, minutes] = time.split(':');
    let h = parseInt(hours, 10);
    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${minutes}:00`;
  };

  const openEdit = (item: any) => {
    setActiveItem(item);
    setFormReason(item.reason || '');
    
    // Parse time back to 12H AM/PM format
    const to12H = (t24: string) => {
      const [h, m] = t24.split(':');
      let hr = parseInt(h, 10);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;
      return `${hr.toString().padStart(2,'0')}:${m} ${ampm}`;
    };
    
    setAStart(to12H(item.afterStart));
    setAEnd(to12H(item.afterEnd));
    setStep(3);
  };

  const handleUpdate = () => {
    if (!formReason.trim()) {
      showAlert({ type: 'warning', title: 'Required', message: 'Reason is required.' });
      return;
    }
    const s24 = convertTo24Hour(aStart);
    const e24 = convertTo24Hour(aEnd);
    if (e24 <= s24) {
      showAlert({ type: 'error', title: 'Invalid Times', message: 'End time must be after start time.'});
      return;
    }

    const updated = details.map(d => {
      if (d.id === activeItem.id) {
        return { ...d, reason: formReason, afterStart: s24, afterEnd: e24, changed: true };
      }
      return d;
    });
    setDetails(updated);
    setStep(2);
  };

  const handleDeleteItem = (id: number) => {
    import('react-native').then(({ Alert }) => {
      Alert.alert(
        "Remove Record",
        "Are you sure you want to remove this specific day from your attendance correction request?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Remove", 
            style: "destructive",
            onPress: () => {
               setDetails(prev => prev.filter(d => d.id !== id));
               if (step === 3) setStep(2);
            }
          }
        ]
      );
    });
  };

  const submitAll = async () => {
    const edited = details.filter(d => d.changed);
    if (edited.length === 0) {
      showAlert({ type: 'warning', title: 'No changes', message: 'You have not edited any attendance records yet.'});
      return;
    }

    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      let finalAttachmentUrl = null;
      if (attachmentUri) {
         try {
           const formData = new FormData();
           formData.append('file', {
              uri: attachmentUri,
              name: attachmentName || 'document.pdf',
              type: 'application/octet-stream'
           } as any);
           formData.append('type', 'file');
           
           const uploadRes = await fetch(`${backendUrl}/upload-chat-media.php`, {
              method: 'POST',
              body: formData,
              headers: { 'ngrok-skip-browser-warning': 'true' }
           });
           const uploadData = await uploadRes.json();
           if (uploadData.ok) {
              finalAttachmentUrl = uploadData.media_url;
           }
         } catch (err) {
           console.log("Failed to upload attachment", err);
         }
      }

      for (let item of edited) {
        const payload = {
          user_id: userId,
          date: item.date.toISOString().split('T')[0],
          shift: item.shift,
          reason: item.reason,
          before_start_time: item.beforeStart === '--:--' ? null : (item.beforeStart + ':00'),
          before_end_time: item.beforeEnd === '--:--' ? null : (item.beforeEnd + ':00'),
          after_start_time: item.afterStart,
          after_end_time: item.afterEnd,
          attachment: finalAttachmentUrl
        };

        await fetch(`${backendUrl}/submit-attendance-correction.php?action=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify(payload)
        });
      }

      await fetchHistory();

      showAlert({ 
        type: 'success', 
        title: 'Success', 
        message: 'Attendance corrections submitted successfully. Pending Admin approval.', 
        onClose: () => {
          setStep(4);
        } 
      });
    } catch (e) {
      showAlert({ type: 'error', title: 'Network Error', message: 'Failed to submit.'});
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachmentUri(result.assets[0].uri);
        setAttachmentName(result.assets[0].name);
      }
    } catch (err) {
      console.log('Error picking document', err);
    }
  };

  // ------------------------------------------------------------------------------------------------
  // RENDER STEP 1
  // ------------------------------------------------------------------------------------------------
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.sectionTitle, dyn.sub]}>Request For</Text>
      <View style={[styles.inputBox, dyn.card, dyn.border]}>
        <Text style={[styles.inputText, dyn.text]} numberOfLines={1}>{employee}</Text>
        <Ionicons name="person-outline" size={20} color={dyn.sub.color} />
      </View>

      <View style={styles.separatorRow}>
        <Text style={[styles.separatorText, dyn.sub]}>DATE RANGE</Text>
        <View style={styles.separatorLine} />
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
           <Text style={[styles.label, dyn.sub]}>Start</Text>
           <TouchableOpacity style={[styles.inputBox, dyn.card, dyn.border]} onPress={() => setShowStartPicker(true)}>
              <Text style={[styles.inputText, dyn.text]}>{formatDate(startDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color={dyn.sub.color} />
           </TouchableOpacity>
        </View>
        <View style={styles.dashCenter}><Text style={dyn.sub}>—</Text></View>
        <View style={styles.dateCol}>
           <Text style={[styles.label, dyn.sub]}>End</Text>
           <TouchableOpacity style={[styles.inputBox, dyn.card, dyn.border]} onPress={() => setShowEndPicker(true)}>
              <Text style={[styles.inputText, dyn.text]}>{formatDate(endDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color={dyn.sub.color} />
           </TouchableOpacity>
        </View>
      </View>

      {showStartPicker && (
         <DateTimePicker
           value={startDate}
           mode="date"
           display="default"
           onChange={(event, date) => {
             setShowStartPicker(false);
             if (date) { setStartDate(date); if (endDate < date) setEndDate(date); }
           }}
         />
      )}
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

      <Text style={[styles.label, dyn.sub, {marginTop: 20}]}>Attachment</Text>
      <TouchableOpacity style={[styles.attachmentBox, { borderColor: dyn.border.borderColor }]} onPress={handleSelectFile}>
         {attachmentName ? (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10}}>
                <Ionicons name="document-text" size={20} color={dyn.accent} />
                <Text style={[styles.attachmentText, { color: dyn.accent }]} numberOfLines={1} ellipsizeMode="middle">
                  {attachmentName}
                </Text>
            </View>
         ) : (
            <>
               <Ionicons name="add" size={20} color={dyn.accent} />
               <Text style={[styles.attachmentText, { color: dyn.accent }]}>Select File</Text>
            </>
         )}
      </TouchableOpacity>
      <Text style={[styles.attachmentHint, dyn.sub]}>File Supported: doc,docx,pdf,xls,xlsx</Text>

      <View style={styles.flexSpacer} />
      <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: dyn.accent }]} onPress={handleNext}>
         <Text style={styles.btnPrimaryText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  // ------------------------------------------------------------------------------------------------
  // RENDER STEP 2
  // ------------------------------------------------------------------------------------------------
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.label, dyn.sub]}>Request For</Text>
      <View style={styles.reqCard}>
         {profilePicture ? (
           <Image source={{uri: profilePicture}} style={styles.avatar} />
         ) : (
           <View style={[styles.avatar, {backgroundColor: dyn.surface, justifyContent: 'center', alignItems:'center'}]}>
             <Ionicons name="person" size={30} color={dyn.accent}/>
           </View>
         )}
         <View style={{flex: 1}}>
           <Text style={[styles.reqName, dyn.text]}>{employee}</Text>
           <Text style={[styles.reqRole, dyn.sub]}>{position}</Text>
         </View>
      </View>

      <View style={styles.dateRow2}>
         <View style={styles.dateInfoCol}>
            <Text style={[styles.label, dyn.sub]}>Start Date</Text>
            <Text style={[styles.dateBig, dyn.text]}>{formatDate(startDate)}</Text>
         </View>
         <View style={styles.dateInfoCol}>
            <Text style={[styles.label, dyn.sub]}>End Date</Text>
            <Text style={[styles.dateBig, dyn.text]}>{formatDate(endDate)}</Text>
         </View>
      </View>

      <View style={styles.separatorRow}>
        <Text style={[styles.separatorText, dyn.sub]}>DETAIL</Text>
        <View style={styles.separatorLine} />
        <TouchableOpacity onPress={() => setStep(4)} style={{ marginLeft: 10 }}>
           <Text style={{ color: dyn.accent, fontSize: 13, fontWeight: 'bold' }}>View History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{flex: 1}}>
         {details.map((item) => (
            <View key={item.id} style={[styles.detailItem, dyn.card, dyn.border]}>
               <View style={styles.diLeft}>
                  <Text style={[styles.diDate, dyn.text]}>{formatDate(item.date)}</Text>
                  <View style={styles.timesCol}>
                     <Text style={[styles.diTimes, dyn.sub]}>
                        {item.changed 
                           ? `${item.afterStart.substring(0,5)} | ${item.afterEnd.substring(0,5)}` 
                           : `${item.beforeStart} | ${item.beforeEnd}`}
                     </Text>
                  </View>
               </View>

               <View style={styles.diCenter}>
                  <Text style={[styles.diShift, dyn.text]}>{item.shift}</Text>
                  <Text style={[styles.diChange, item.changed ? {color: dyn.accent, fontWeight: '600'} : dyn.sub]}>
                     {item.changed ? 'Corrected' : 'No Change'}
                  </Text>
               </View>

               <View style={styles.diActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.diBtn}>
                     <Ionicons name="create-outline" size={22} color={dyn.sub.color}/>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.diBtn}>
                     <Ionicons name="trash-outline" size={22} color="#E74C3C"/>
                  </TouchableOpacity>
               </View>
            </View>
         ))}
      </ScrollView>

      <View style={styles.bottomButtonsRow}>
         <TouchableOpacity style={[styles.btnSecondary, dyn.card, dyn.border]} onPress={() => setStep(1)}>
            <Text style={[styles.btnSecondaryText, { color: dyn.accent }]}>Draft</Text>
         </TouchableOpacity>
         <TouchableOpacity style={[styles.btnPrimarySplit, { backgroundColor: dyn.accent }]} onPress={submitAll} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Submit</Text>}
         </TouchableOpacity>
      </View>
    </View>
  );

  // ------------------------------------------------------------------------------------------------
  // RENDER STEP 3
  // ------------------------------------------------------------------------------------------------
  const renderStep3 = () => {
    const actDate = activeItem ? formatDate(activeItem.date) : '';
    return (
      <View style={[styles.stepContainer, { paddingHorizontal: 0, paddingTop: 0 }]}>
        <View style={[styles.header3, { backgroundColor: dyn.accent }]}>
           <TouchableOpacity onPress={() => setStep(2)} style={styles.headBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
           </TouchableOpacity>
           <Text style={styles.headerTitle3}>Attendance Correction</Text>
        </View>

        <ScrollView contentContainerStyle={styles.step3Content}>
           <Text style={styles.s3Label}>Date</Text>
           <Text style={[styles.s3Val, dyn.sub]}>{actDate} - {actDate}</Text>
           <View style={styles.s3Sep} />

           <Text style={styles.s3Label}>Shift</Text>
           <View style={styles.s3ValRow}>
              <Text style={[styles.s3Val, dyn.sub]}>{formShift}</Text>
              <Ionicons name="caret-down" size={16} color={dyn.sub.color} />
           </View>
           <View style={styles.s3Sep} />

           <Text style={styles.s3LabelReason}>Reason</Text>
           <TextInput
             style={[styles.s3Input, dyn.text]}
             placeholder="State reason here"
             placeholderTextColor={dyn.sub.color}
             value={formReason}
             onChangeText={setFormReason}
             multiline
           />
           <View style={styles.s3Sep} />

           <Text style={styles.s3SectionTitle}>Before</Text>
           <View style={styles.s3TimesRow}>
              <View style={styles.s3TimeCol}>
                 <Text style={styles.s3SubLabel}>Start Time</Text>
                 <Text style={[styles.s3TimeVal, dyn.sub]}>{activeItem?.beforeStart} | {actDate}</Text>
                 <View style={styles.s3Sep} />
              </View>
              <View style={styles.s3TimeCol}>
                 <Text style={styles.s3SubLabel}>End Time</Text>
                 <Text style={[styles.s3TimeVal, dyn.sub]}>{activeItem?.beforeEnd} | {actDate}</Text>
                 <View style={styles.s3Sep} />
              </View>
           </View>

           <Text style={[styles.s3SectionTitle, { marginTop: 20 }]}>After</Text>
           <View style={styles.s3TimesRow}>
              <View style={styles.s3TimeCol}>
                 <Text style={styles.s3SubLabel}>Start Time</Text>
                 <TouchableOpacity style={styles.s3TimePickBox} onPress={() => setShowTimePickerS(true)}>
                    <Text style={[styles.s3TimeVal, dyn.sub]}>{aStart} | {actDate}</Text>
                    <Ionicons name="time-outline" size={24} color={dyn.sub.color} />
                 </TouchableOpacity>
                 <View style={styles.s3Sep} />
              </View>
              
              <View style={styles.s3TimeCol}>
                 <Text style={styles.s3SubLabel}>End Time</Text>
                 <TouchableOpacity style={styles.s3TimePickBox} onPress={() => setShowTimePickerE(true)}>
                    <Text style={[styles.s3TimeVal, dyn.sub]}>{aEnd} | {actDate}</Text>
                    <Ionicons name="time-outline" size={24} color={dyn.sub.color} />
                 </TouchableOpacity>
                 <View style={styles.s3Sep} />
              </View>
           </View>

           {showTimePickerS && (
              <DateTimePicker
                value={new Date()} mode="time" is24Hour={false} display="default"
                onChange={(e, d) => {
                  setShowTimePickerS(false);
                  if (d) setAStart(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
                }}
              />
           )}
           {showTimePickerE && (
              <DateTimePicker
                value={new Date()} mode="time" is24Hour={false} display="default"
                onChange={(e, d) => {
                  setShowTimePickerE(false);
                  if (d) setAEnd(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
                }}
              />
           )}
        </ScrollView>

        <View style={styles.s3ActionRow}>
           <TouchableOpacity style={[styles.s3Btn, { backgroundColor: dyn.accent, borderBottomLeftRadius: 16 }]} onPress={handleUpdate}>
              <Text style={styles.s3BtnText}>Update</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.s3Btn, { backgroundColor: '#F25C54', borderBottomRightRadius: 16 }]} onPress={() => handleDeleteItem(activeItem.id)}>
              <Text style={styles.s3BtnText}>Delete</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHistory = () => (
    <ScrollView style={styles.stepContainer}>
      {loadingHistory ? (
        <ActivityIndicator size="large" color={dyn.accent} style={{ marginTop: 50 }} />
      ) : history.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 50, color: dyn.sub.color }}>No attendance correction history found.</Text>
      ) : (
        history.map(item => (
          <View key={item.id} style={[styles.detailItem, dyn.card, dyn.border, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[styles.diDate, dyn.text, { marginBottom: 0 }]}>{formatDate(new Date(item.date))}</Text>
              <View style={[styles.hStatus, { backgroundColor: item.status === 'Approved' ? '#E8F5E9' : item.status === 'Rejected' ? '#FFEBEE' : '#FFF3E0' }]}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: item.status === 'Approved' ? '#4CAF50' : item.status === 'Rejected' ? '#F44336' : '#FF9800' }}>{item.status}</Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: dyn.surface, padding: 10, borderRadius: 8 }}>
               <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: dyn.sub.color, marginBottom: 4 }}>Before</Text>
                  <Text style={[dyn.text, { fontWeight: '500' }]}>{item.before_start_time?.substring(0,5) || '--:--'} - {item.before_end_time?.substring(0,5) || '--:--'}</Text>
               </View>
               <View style={{ justifyContent: 'center', marginHorizontal: 10 }}>
                  <Ionicons name="arrow-forward" size={16} color={dyn.sub.color} />
               </View>
               <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: dyn.sub.color, marginBottom: 4 }}>After</Text>
                  <Text style={[dyn.text, { fontWeight: '500' }]}>{item.after_start_time?.substring(0,5) || '--:--'} - {item.after_end_time?.substring(0,5) || '--:--'}</Text>
               </View>
            </View>
            <View style={{ marginTop: 10 }}>
               <Text style={{ fontSize: 12, color: dyn.sub.color }}>Reason:</Text>
               <Text style={[dyn.text, { marginTop: 2, fontSize: 14 }]}>{item.reason}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {step !== 3 && (
        <View style={styles.header}>
           <TouchableOpacity onPress={() => step === 4 ? setStep(2) : step === 2 ? setStep(1) : router.back()} style={styles.headBtn}>
              <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
           </TouchableOpacity>
           <Text style={[styles.headerTitle, dyn.text]}>
             {step === 1 ? 'Attendance Correction Form' : step === 4 ? 'Correction History' : 'Attendance Correction'}
           </Text>
           <View style={{width: 30}} />
        </View>
      )}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderHistory()}

      <CustomAlert visible={visible} title={config.title} message={config.message} type={config.type} onClose={hideAlert}/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 15, height: 60
  },
  headBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  stepContainer: { flex: 1, padding: 20 },
  
  tabContainer: {
    flexDirection: 'row', height: 45, borderBottomWidth: 1
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center'
  },
  tabText: {
    fontSize: 15
  },
  hStatus: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12
  },
  
  // Step 1
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 10 },
  inputBox: { 
    height: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  inputText: { fontSize: 15 },
  separatorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 25, marginBottom: 15 },
  separatorText: { fontSize: 12, fontWeight: '700', marginRight: 10 },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateCol: { flex: 1 },
  dashCenter: { paddingHorizontal: 10, paddingTop: 25 },
  label: { fontSize: 13, marginBottom: 8, fontWeight: '600' },
  
  attachmentBox: { 
    height: 56, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  attachmentText: { fontSize: 15, fontWeight: '600' },
  attachmentHint: { fontSize: 12, marginTop: 8 },
  
  flexSpacer: { flex: 1 },
  btnPrimary: { height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Step 2
  reqCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, marginTop: 5 },
  avatar: { width: 65, height: 65, borderRadius: 32.5, marginRight: 15 },
  reqName: { fontSize: 18, fontWeight: 'bold' },
  reqRole: { fontSize: 14.5, marginTop: 4 },
  dateRow2: { flexDirection: 'row', justifyContent: 'space-between' },
  dateInfoCol: { flex: 1 },
  dateBig: { fontSize: 18, fontWeight: 'bold' },
  
  detailItem: { 
    flexDirection: 'row', borderRadius: 8, borderWidth: 1, padding: 15, marginBottom: 15, alignItems: 'center'
  },
  diLeft: { flex: 2 },
  diDate: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  timesCol: { flexDirection: 'row' },
  diTimes: { fontSize: 13 },
  diCenter: { flex: 3 },
  diShift: { fontSize: 13, marginBottom: 4 },
  diChange: { fontSize: 13 },
  diActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  diBtn: { padding: 5 },

  bottomButtonsRow: { flexDirection: 'row', gap: 15, marginTop: 10 },
  btnSecondary: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { fontSize: 16, fontWeight: 'bold' },
  btnPrimarySplit: { flex: 1, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Step 3
  header3: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 60, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3 },
  headerTitle3: { fontSize: 18, fontWeight: '700', color: '#FFF', marginLeft: 10 },
  step3Content: { padding: 25 },
  s3Label: { fontSize: 13, fontWeight: 'bold', color: '#7f8c8d' },
  s3Val: { fontSize: 15, marginTop: 4, color: '#34495e', fontWeight: '500' },
  s3Sep: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  s3ValRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  s3LabelReason: { fontSize: 13, fontWeight: 'bold', color: '#7f8c8d' },
  s3Input: { fontSize: 15, marginVertical: 10, minHeight: 40, textAlignVertical: 'top', color: '#34495e' },
  
  s3SectionTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 15, color: '#2C3E50' },
  s3TimesRow: { flexDirection: 'row', gap: 20 },
  s3TimeCol: { flex: 1 },
  s3SubLabel: { fontSize: 12, color: '#95A5A6', marginBottom: 4, fontWeight: '600' },
  s3TimeVal: { fontSize: 16, color: '#34495e' },
  s3TimePickBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  s3ActionRow: { 
    flexDirection: 'row', 
    marginHorizontal: 25, 
    marginBottom: 25, 
    borderRadius: 30, 
    overflow: 'hidden',
    height: 54
  },
  s3Btn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  s3BtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
