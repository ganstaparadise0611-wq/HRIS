import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export default function UserLeave() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('apply');
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [reason, setReason] = useState('');

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input: { backgroundColor: isDark ? '#252525' : '#F0F0F0', color: colors.text, borderColor: colors.border },
    chip: { backgroundColor: isDark ? '#333' : '#E0E0E0' }
  };

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

                <TouchableOpacity style={styles.submitButton} onPress={() => Alert.alert("Success", "Request Sent")}>
                    <Text style={styles.submitText}>SUBMIT APPLICATION</Text>
                    <Ionicons name="paper-plane-outline" size={20} color="#FFF" style={{marginLeft: 10}} />
                </TouchableOpacity>
            </View>
        ) : (
            <View>
                <Text style={[styles.sectionLabel, dyn.sub]}>RECENT REQUESTS</Text>
                {[
                    { type: 'Vacation Leave', date: 'Jan 15, 2026', status: 'Approved', color: '#27AE60' },
                    { type: 'Sick Leave', date: 'Dec 10, 2025', status: 'Rejected', color: '#C0392B' },
                ].map((item, i) => (
                    <View key={i} style={[styles.historyCard, dyn.card]}>
                        <View style={[styles.statusLine, { backgroundColor: item.color }]} />
                        <View style={styles.historyContent}>
                            <View style={{flex: 1}}>
                                <Text style={[styles.historyType, dyn.text]}>{item.type}</Text>
                                <Text style={[styles.historyDate, dyn.sub]}>{item.date}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: item.color + '20' }]}>
                                <Text style={[styles.badgeText, { color: item.color }]}>{item.status}</Text>
                            </View>
                        </View>
                    </View>
                ))}
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