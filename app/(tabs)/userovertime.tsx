import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export default function UserOvertime() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [date, setDate] = useState('Feb 04, 2026');
  const [startTime, setStartTime] = useState('17:00'); 
  const [endTime, setEndTime] = useState('20:00');   
  const [reason, setReason] = useState('');

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
        {/* Added dyn.card to override the black background */}
        <View style={[styles.timeCard, dyn.card]}> 
            <Text style={styles.cardLabel}>TOTAL HOURS</Text>
            <View style={styles.timeDisplay}>
                <MaterialCommunityIcons name="clock-time-eight-outline" size={40} color="#F27121" />
                {/* Added dyn.text to override hardcoded #FFF */}
                <Text style={[styles.bigTime, dyn.text]}>3.0</Text> 
                <Text style={styles.unit}>HRS</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
                {/* Added dyn.text to override hardcoded #FFF for values */}
                <View><Text style={styles.label}>START</Text><Text style={[styles.value, dyn.text]}>{startTime}</Text></View>
                <Ionicons name="arrow-forward" size={20} color={colors.subText} />
                <View><Text style={styles.label}>END</Text><Text style={[styles.value, dyn.text]}>{endTime}</Text></View>
            </View>
        </View>

        <Text style={[styles.sectionTitle, dyn.text]}>REQUEST DETAILS</Text>
        
        <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, dyn.sub]}>Date</Text>
            <TouchableOpacity style={[styles.fakeInput, dyn.input]}>
                <Text style={[styles.inputText, dyn.text]}>{date}</Text>
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

        <TouchableOpacity style={styles.submitBtn} onPress={() => Alert.alert("Success", "Filed!")}>
            <Text style={styles.submitText}>SUBMIT REQUEST</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, dyn.text]}>RECENT REQUESTS</Text>
        {[
          { date: 'Jan 28, 2026', hours: '2.5 hrs', status: 'Approved', reason: 'System Maintenance' },
          { date: 'Jan 20, 2026', hours: '4.0 hrs', status: 'Pending', reason: 'Inventory Count' },
        ].map((item, i) => (
            <View key={i} style={[styles.historyItem, dyn.card]}>
                <View>
                    <Text style={[styles.historyDate, dyn.text]}>{item.date}</Text>
                    <Text style={[styles.historyReason, dyn.sub]}>{item.reason}</Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                    <Text style={[styles.historyHours, dyn.text]}>{item.hours}</Text>
                    <Text style={[styles.historyStatus, { color: item.status === 'Approved' ? '#27AE60' : '#F39C12' }]}>
                        {item.status}
                    </Text>
                </View>
            </View>
        ))}

      </ScrollView>
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
  divider: { width: '100%', height: 1, backgroundColor: '#444', marginBottom: 20 },
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
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  historyItem: { padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyDate: { fontWeight: 'bold', marginBottom: 2 },
  historyReason: { fontSize: 12 },
  historyHours: { fontWeight: 'bold', fontSize: 16 },
  historyStatus: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
});