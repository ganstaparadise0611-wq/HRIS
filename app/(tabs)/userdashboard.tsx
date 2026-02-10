import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './ThemeContext';

export default function UserDashboard() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  const currentDate = new Date().toDateString();
  const [clockInTime, setClockInTime] = useState<string | null>(null); 

  useFocusEffect(
    useCallback(() => {
      const loadStatus = async () => {
        try {
            const savedTime = await AsyncStorage.getItem('userClockInTime');
            setClockInTime(savedTime); 
        } catch (e) {
            console.log("Error loading time");
        }
      };
      loadStatus();
    }, [])
  );

  // DYNAMIC STYLES
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    iconBg: { backgroundColor: isDark ? '#2C3E50' : '#E0E0E0' },
    border: { borderColor: colors.border }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, dyn.text]}>Hi, IT Intern</Text>
            <Text style={[styles.subGreeting, dyn.sub]}>Lets be productive today.</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle-outline" size={40} color="#F27121" />
          </TouchableOpacity>
        </View>

        {/* ATTENDANCE CARD - NOW DYNAMIC */}
        <View style={[styles.attendanceCard, dyn.card]}>
          <View style={styles.attendanceHeader}>
            <Text style={[styles.cardTitle, dyn.sub]}>TODAYS ATTENDANCE</Text>
            <Text style={[styles.dateText, dyn.sub]}>{currentDate}</Text>
          </View>
          
          <View style={styles.timerContainer}>
            <Text style={[styles.timerText, dyn.text]}>{clockInTime ? clockInTime : "-- : --"}</Text>
            <Text style={styles.shiftText}>Shift: Regular (8:00 - 17:00)</Text>
          </View>

          <TouchableOpacity 
            style={[styles.clockInButton, { backgroundColor: clockInTime ? '#27AE60' : '#F27121' }]} 
            onPress={() => router.push('/userattendance')} 
          >
            <MaterialCommunityIcons name={clockInTime ? "eye" : "face-recognition"} size={24} color="#FFF" />
            <Text style={styles.clockInText}>
                {clockInTime ? "VIEW STATUS" : "CLOCK IN"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QUICK ACCESS GRID */}
        <Text style={[styles.sectionTitle, dyn.text]}>Quick Access</Text>
        <View style={styles.gridContainer}>
          {[
            { label: 'Activity', icon: 'camera-outline', route: '/useractivity', lib: Ionicons },
            { label: 'Chat', icon: 'chatbubble-ellipses-outline', route: '/userchat', lib: Ionicons },
            { label: 'Payslip', icon: 'file-invoice-dollar', route: '/userpayslip', lib: FontAwesome5 },
            { label: 'Overtime', icon: 'clock-fast', route: '/userovertime', lib: MaterialCommunityIcons },
            { label: 'Leave', icon: 'calendar-remove', route: '/userleave', lib: MaterialCommunityIcons },
            { label: 'More', icon: 'grid-outline', route: '/usermenu', lib: Ionicons },
          ].map((item, index) => (
             <TouchableOpacity key={index} style={[styles.gridItem, dyn.card]} onPress={() => item.route && router.push(item.route as any)}>
                <View style={[styles.iconCircle, dyn.iconBg]}>
                    <item.lib name={item.icon as any} size={24} color={isDark ? "#FFF" : "#333"} />
                </View>
                <Text style={[styles.gridLabel, dyn.sub]}>{item.label}</Text>
             </TouchableOpacity>
          ))}
        </View>

        {/* FEEDS */}
        <Text style={[styles.sectionTitle, dyn.text]}>Company Feeds</Text>
        <View style={[styles.feedCard, dyn.card]}>
            <View style={styles.feedHeader}>
                <Ionicons name="megaphone-outline" size={20} color="#F27121" />
                <Text style={styles.feedTitle}>Announcement</Text>
            </View>
            <Text style={[styles.feedContent, dyn.sub]}>Welcome to TDT Powersteel! Please update your profile picture.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  greeting: { fontSize: 22, fontWeight: 'bold' },
  subGreeting: { fontSize: 14 },
  profileButton: { padding: 5 },
  
  attendanceCard: { borderRadius: 15, padding: 20, marginBottom: 30, borderLeftWidth: 5, borderLeftColor: '#F27121', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  cardTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  dateText: { fontSize: 12 },
  timerContainer: { alignItems: 'center', marginBottom: 20 },
  timerText: { fontSize: 36, fontWeight: 'bold', letterSpacing: 2 },
  shiftText: { color: '#F27121', fontSize: 14, marginTop: 5 },
  clockInButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 10 },
  clockInText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridItem: { width: '31%', borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridLabel: { fontSize: 12, fontWeight: '500' },
  
  feedCard: { padding: 15, borderRadius: 12, marginBottom: 30, elevation: 2 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  feedTitle: { color: '#F27121', fontWeight: 'bold', marginLeft: 8 },
  feedContent: { lineHeight: 20 },
});