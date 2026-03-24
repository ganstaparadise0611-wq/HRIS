import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

interface Correction {
  id: number;
  user_id: number;
  date: string;
  shift: string;
  reason: string;
  before_start_time: string | null;
  before_end_time: string | null;
  after_start_time: string;
  after_end_time: string;
  status: string;
  created_at: string;
}

export default function UserAttendanceCorrection() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const backendUrl = getBackendUrl();
  
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formShift, setFormShift] = useState('SHIFTSPV');
  const [formReason, setFormReason] = useState('');
  const [bStart, setBStart] = useState('');
  const [bEnd, setBEnd] = useState('');
  const [aStart, setAStart] = useState('');
  const [aEnd, setAEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input: { backgroundColor: isDark ? '#2C2C2C' : '#F5F5F5', color: colors.text }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCorrections();
    }, [])
  );

  const fetchCorrections = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const res = await fetch(`${backendUrl}/get-attendance-corrections.php?user_id=${userId}`);
      const data = await res.json();
      
      if (data.success && data.corrections) {
        setCorrections(data.corrections);
      }
    } catch (err) {
      console.warn('Failed to load corrections:', err);
    } finally {
      setLoading(false);
    }
  };

  const openNewRequest = () => {
    setEditingId(null);
    const today = new Date().toISOString().split('T')[0];
    setFormDate(today);
    setFormShift('SHIFTSPV');
    setFormReason('');
    setBStart('');
    setBEnd('');
    setAStart('08:00');
    setAEnd('17:00');
    setShowForm(true);
  };

  const openEditRequest = (item: Correction) => {
    setEditingId(item.id);
    setFormDate(item.date);
    setFormShift(item.shift || 'SHIFTSPV');
    setFormReason(item.reason);
    setBStart(item.before_start_time ? item.before_start_time.substring(0,5) : '');
    setBEnd(item.before_end_time ? item.before_end_time.substring(0,5) : '');
    setAStart(item.after_start_time.substring(0,5));
    setAEnd(item.after_end_time.substring(0,5));
    setShowForm(true);
  };

  const saveForm = async () => {
    if (!formDate || !formReason || !aStart || !aEnd) {
      alert("Please fill all required fields (Date, Reason, After time)");
      return;
    }

    try {
      setSubmitting(true);
      const userId = await AsyncStorage.getItem('userId');
      const payload = {
        id: editingId,
        user_id: userId,
        date: formDate,
        shift: formShift,
        reason: formReason,
        before_start_time: bStart || null,
        before_end_time: bEnd || null,
        after_start_time: aStart,
        after_end_time: aEnd
      };

      const action = editingId ? 'update' : 'create';
      const res = await fetch(`${backendUrl}/submit-attendance-correction.php?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setShowForm(false);
        fetchCorrections();
      } else {
        alert(data.message || 'Error occurred');
      }
    } catch (e) {
      alert('Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRequest = async () => {
    if (!editingId) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${backendUrl}/submit-attendance-correction.php?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId })
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        fetchCorrections();
      } else {
         alert(data.message || 'Error occurred');
      }
    } catch(e) {} finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return '#2ecc71';
    if (status === 'rejected') return '#e74c3c';
    return '#f39c12';
  };

  const renderItem = ({ item }: { item: Correction }) => {
    const d = new Date(item.date).toLocaleDateString();
    return (
      <TouchableOpacity style={[styles.card, dyn.card]} onPress={() => openEditRequest(item)}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardDate, dyn.text]}>{d} - {item.shift}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.cardReason, dyn.sub]} numberOfLines={1}>Reason: {item.reason}</Text>
        <View style={styles.timesContainer}>
          <View style={styles.timeBlock}>
             <Text style={styles.timeLabel}>Before</Text>
             <Text style={[styles.timeVal, dyn.text]}>
               {item.before_start_time ? item.before_start_time.substring(0,5) : '--:--'} - {item.before_end_time ? item.before_end_time.substring(0,5) : '--:--'}
             </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.subText} style={{marginTop:15}}/>
          <View style={styles.timeBlock}>
             <Text style={styles.timeLabel}>After</Text>
             <Text style={[styles.timeVal, dyn.text]}>
               {item.after_start_time.substring(0,5)} - {item.after_end_time.substring(0,5)}
             </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      {/* HEADER */}
      <View style={[styles.header, dyn.border]}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Ionicons name="arrow-back" size={24} color={colors.text} />
         </TouchableOpacity>
         <Text style={[styles.headerTitle, dyn.text]}>Attendance Correction</Text>
         <TouchableOpacity onPress={openNewRequest} style={styles.newButton}>
           <Text style={styles.newButtonText}>+ New</Text>
         </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#F27121" />
        </View>
      ) : corrections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color="#ccc" />
          <Text style={[styles.emptyText, dyn.sub]}>No correction requests.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={openNewRequest}>
             <Text style={styles.emptyButtonText}>Create New Request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={corrections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FORM MODAL */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, dyn.bg]}>
           <View style={[styles.modalHeader, dyn.border]}>
             <Text style={[styles.modalTitle, dyn.text]}>{editingId ? 'Edit Correction' : 'New Correction'}</Text>
             <TouchableOpacity onPress={() => setShowForm(false)}>
               <Ionicons name="close" size={28} color={colors.text} />
             </TouchableOpacity>
           </View>
           
           <ScrollView contentContainerStyle={styles.formContent}>
              <Text style={[styles.formLabel, dyn.text]}>Date (YYYY-MM-DD)</Text>
              <TextInput style={[styles.input, dyn.input]} value={formDate} onChangeText={setFormDate} placeholder="e.g. 2026-03-24" placeholderTextColor={colors.subText} />

              <Text style={[styles.formLabel, dyn.text]}>Shift</Text>
              <TextInput style={[styles.input, dyn.input]} value={formShift} onChangeText={setFormShift} placeholder="SHIFTSPV" placeholderTextColor={colors.subText} />

              <Text style={[styles.formLabel, dyn.text]}>Reason</Text>
              <TextInput style={[styles.input, styles.textArea, dyn.input]} value={formReason} onChangeText={setFormReason} placeholder="Explain why you are correcting attendance..." placeholderTextColor={colors.subText} multiline />

              <View style={styles.timesSection}>
                <Text style={styles.sectionHeader}>Before Correction</Text>
                <View style={styles.timeRow}>
                   <View style={styles.timeInputWrapper}>
                     <Text style={[styles.formLabel, dyn.text]}>Start Time</Text>
                     <TextInput style={[styles.input, dyn.input]} value={bStart} onChangeText={setBStart} placeholder="08:00" placeholderTextColor={colors.subText} />
                   </View>
                   <View style={styles.timeInputWrapper}>
                     <Text style={[styles.formLabel, dyn.text]}>End Time</Text>
                     <TextInput style={[styles.input, dyn.input]} value={bEnd} onChangeText={setBEnd} placeholder="17:00" placeholderTextColor={colors.subText} />
                   </View>
                </View>
              </View>

              <View style={styles.timesSection}>
                <Text style={styles.sectionHeader}>After Correction</Text>
                <View style={styles.timeRow}>
                   <View style={styles.timeInputWrapper}>
                     <Text style={[styles.formLabel, dyn.text]}>Start Time</Text>
                     <TextInput style={[styles.input, dyn.input]} value={aStart} onChangeText={setAStart} placeholder="08:00" placeholderTextColor={colors.subText} />
                   </View>
                   <View style={styles.timeInputWrapper}>
                     <Text style={[styles.formLabel, dyn.text]}>End Time</Text>
                     <TextInput style={[styles.input, dyn.input]} value={aEnd} onChangeText={setAEnd} placeholder="17:00" placeholderTextColor={colors.subText} />
                   </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                 <TouchableOpacity style={[styles.submitBtn, submitting && {opacity:0.7}]} onPress={saveForm} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>{editingId ? 'Update' : 'Submit for Approval'}</Text>}
                 </TouchableOpacity>

                 {editingId && (
                   <TouchableOpacity style={[styles.deleteBtn, submitting && {opacity:0.7}]} onPress={deleteRequest} disabled={submitting}>
                      {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
                   </TouchableOpacity>
                 )}
              </View>
           </ScrollView>
        </SafeAreaView>
      </Modal>

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
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  newButton: { backgroundColor: '#F27121', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  newButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  
  listContent: { padding: 20 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 15, fontSize: 16, marginBottom: 20 },
  emptyButton: { backgroundColor: '#F27121', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  emptyButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  card: { padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardDate: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  cardReason: { fontSize: 14, marginBottom: 15 },
  
  timesContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(242, 113, 33, 0.05)', padding: 10, borderRadius: 8 },
  timeBlock: { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 11, color: '#F27121', fontWeight: 'bold', marginBottom: 4 },
  timeVal: { fontSize: 14, fontWeight: '600' },

  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  formContent: { padding: 20, paddingBottom: 50 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 15 },
  input: { borderRadius: 10, padding: 15, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  timesSection: { marginTop: 20, backgroundColor: 'rgba(0,0,0,0.02)', padding: 15, borderRadius: 12 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#F27121', marginBottom: 5 },
  timeRow: { flexDirection: 'row', gap: 15 },
  timeInputWrapper: { flex: 1 },

  actionButtons: { marginTop: 30, gap: 15 },
  submitBtn: { backgroundColor: '#F27121', padding: 18, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { backgroundColor: '#e74c3c', padding: 18, borderRadius: 12, alignItems: 'center' },
  deleteBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
