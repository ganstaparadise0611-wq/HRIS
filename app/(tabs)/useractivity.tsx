import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext'; // <--- IMPORT HOOK

export default function UserActivity() {
  const router = useRouter();
  const { colors, theme } = useTheme(); // <--- GET COLORS
  const isDark = theme === 'dark';
  const [task, setTask] = useState('');

  // DYNAMIC STYLES
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    input: { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', color: colors.text, borderColor: colors.border },
    border: { borderColor: colors.border },
    iconColor: isDark ? "#FFF" : "#333"
  };

  const activities = [
    { id: 1, time: '09:30 AM', title: 'Site Inspection', location: 'Warehouse B', status: 'Synced' },
    { id: 2, time: '11:15 AM', title: 'Client Meeting', location: 'Makati Office', status: 'Synced' },
  ];

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Activity Record</Text>
        <TouchableOpacity>
           <Ionicons name="filter" size={24} color="#F27121" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* NEW ENTRY */}
        <Text style={[styles.sectionTitle, dyn.sub]}>New Entry</Text>
        <View style={[styles.formCard, dyn.card]}>
            <TouchableOpacity style={[styles.photoUpload, dyn.input]}>
                <MaterialCommunityIcons name="camera-plus" size={30} color={colors.subText} />
                <Text style={[styles.photoText, dyn.sub]}>Add Photo Evidence</Text>
            </TouchableOpacity>

            <Text style={[styles.label, dyn.sub]}>Task Description</Text>
            <TextInput 
                style={[styles.input, dyn.input]} 
                placeholder="What are you working on?" 
                placeholderTextColor={colors.subText}
                value={task}
                onChangeText={setTask}
            />

            <TouchableOpacity style={styles.submitButton} onPress={() => alert('Activity Saved!')}>
                <Text style={styles.submitText}>SUBMIT RECORD</Text>
            </TouchableOpacity>
        </View>

        {/* HISTORY */}
        <Text style={[styles.sectionTitle, dyn.sub]}>Todays History</Text>
        
        {activities.map((item) => (
            <View key={item.id} style={styles.activityItem}>
                <View style={styles.timelineContainer}>
                    <View style={styles.timelineDot} />
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                </View>

                <View style={[styles.activityContent, dyn.card]}>
                    <View style={styles.activityHeader}>
                        <Text style={styles.activityTime}>{item.time}</Text>
                        <View style={styles.statusBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#2ecc71" />
                            <Text style={styles.statusText}>{item.status}</Text>
                        </View>
                    </View>
                    <Text style={[styles.activityTitle, dyn.text]}>{item.title}</Text>
                    <View style={styles.locationRow}>
                        <Ionicons name="location-sharp" size={12} color={colors.subText} />
                        <Text style={[styles.activityLocation, dyn.sub]}>{item.location}</Text>
                    </View>
                </View>
            </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 5 },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  formCard: { borderRadius: 12, padding: 20, marginBottom: 30, elevation: 2 },
  photoUpload: { height: 100, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  photoText: { marginTop: 5, fontSize: 12 },
  label: { marginBottom: 8, fontWeight: '600' },
  input: { padding: 15, borderRadius: 8, borderWidth: 1, marginBottom: 20 },
  submitButton: { backgroundColor: '#F27121', padding: 15, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  activityItem: { flexDirection: 'row', marginBottom: 20 },
  timelineContainer: { alignItems: 'center', marginRight: 15, width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F27121', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: -5 },
  activityContent: { flex: 1, borderRadius: 10, padding: 15, elevation: 1 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  activityTime: { color: '#F27121', fontWeight: 'bold', fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusText: { color: '#2ecc71', fontSize: 10, marginLeft: 4 },
  activityTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  activityLocation: { fontSize: 12, marginLeft: 4 },
});