import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

interface AnnouncementPost {
  post_id: number;
  emp_id: number;
  caption: string;
  image_url?: string | null;
  kind: string;
  created_at: string;
  video_url?: string | null;
  media_type?: string | null;
  employees?: { name?: string | null } | null;
}

export default function UserDashboard() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  const currentDate = new Date().toDateString();
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('User');
  const [announcements, setAnnouncements] = useState<AnnouncementPost[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadStatus = async () => {
        try {
            const savedTime = await AsyncStorage.getItem('userClockInTime');
            setClockInTime(savedTime);
            
            // Load user name from employees table
            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
              try {
                const response = await fetch(
                  `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${userId}&select=name`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      apikey: SUPABASE_ANON_KEY,
                      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                  }
                );
                const data = await response.json();
                if (data && data.length > 0 && data[0].name) {
                  setUserName(data[0].name);
                } else {
                  // Fallback to username from AsyncStorage
                  const username = await AsyncStorage.getItem('username');
                  if (username) {
                    setUserName(username);
                  }
                }
              } catch (e) {
                console.log('Error loading user name:', e);
                // Fallback to username from AsyncStorage
                const username = await AsyncStorage.getItem('username');
                if (username) {
                  setUserName(username);
                }
              }
            }
        } catch (e) {
            console.log("Error loading time");
        }
      };

      const loadAnnouncements = async () => {
        try {
          setAnnouncementsLoading(true);
          const base = `${SUPABASE_URL}/rest/v1/feeds_posts`;
          const select = 'post_id,emp_id,caption,image_url,kind,created_at,video_url,media_type,employees(name)';
          const query = `${base}?select=${encodeURIComponent(select)}&kind=eq.announcement&order=created_at.desc`;
          const res = await fetch(query, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (res.ok) {
            const data = (await res.json()) as AnnouncementPost[];
            setAnnouncements(data || []);
          }
        } catch (e) {
          setAnnouncements([]);
        } finally {
          setAnnouncementsLoading(false);
        }
      };

      const loadAttendanceHistory = async () => {
        try {
          setAttendanceLoading(true);
          const userId = await AsyncStorage.getItem('userId');
          if (!userId) return;
          const res = await fetch(`${getBackendUrl()}/get-attendance-history.php?user_id=${userId}`);
          const data = await res.json();
          if (data.ok && data.history) {
            setAttendanceHistory(data.history.slice(0, 3));
          }
        } catch (e) {} finally {
          setAttendanceLoading(false);
        }
      };

      loadStatus();
      loadAnnouncements();
      loadAttendanceHistory();
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
            <Text style={[styles.greeting, dyn.text]}>Hi, {userName}</Text>
            <Text style={[styles.subGreeting, dyn.sub]}>Lets be productive today.</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => router.push('/userprofile')}
            >
              <Ionicons name="person-circle-outline" size={40} color="#F27121" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => router.push('/(tabs)/usernotifications' as any)}
            >
              <Ionicons name="notifications-outline" size={26} color={colors.text} />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => router.push('/usermenu')}
            >
              <Ionicons name="settings-outline" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
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
            { label: 'Tasks & Feedback', icon: 'checkmark-done-outline', route: '/usertasks', lib: Ionicons },
          ].map((item, index) => (
             <TouchableOpacity key={index} style={[styles.gridItem, dyn.card]} onPress={() => item.route && router.push(item.route as any)}>
                <View style={[styles.iconCircle, dyn.iconBg]}>
                    <item.lib name={item.icon as any} size={24} color={isDark ? "#FFF" : "#333"} />
                </View>
                <Text style={[styles.gridLabel, dyn.sub]}>{item.label}</Text>
             </TouchableOpacity>
          ))}
        </View>

         {/* RECENT ATTENDANCE */}
         <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, dyn.text]}>Recent Attendance</Text>
           <TouchableOpacity onPress={() => router.push('/(tabs)/attendancehistory' as any)}>
             <Text style={[styles.viewAllText, { color: '#F27121' }]}>View all</Text>
           </TouchableOpacity>
         </View>
         
         {attendanceLoading ? (
            <ActivityIndicator size="small" color="#F27121" style={{marginBottom: 20}} />
         ) : attendanceHistory.length === 0 ? (
            <Text style={[dyn.sub, {marginBottom: 20}]}>No recent attendance.</Text>
         ) : (
            <View style={styles.historyContainer}>
              {attendanceHistory.map(item => {
                const clockIn = item.timein ? item.timein.substring(0,5) : '--:--';
                const clockOut = item.timeout ? item.timeout.substring(0,5) : '--:--';
                const d = new Date(item.date);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <View key={item.att_id} style={[styles.historyRow, dyn.card]}>
                     <View style={styles.historyDateCol}>
                       <Text style={[styles.historyDateText, dyn.text]}>{dateStr}</Text>
                     </View>
                     <View style={styles.historyTimeCol}>
                       <Text style={[styles.historyLabel, dyn.sub]}>IN</Text>
                       <Text style={[styles.historyValue, dyn.text]}>{clockIn}</Text>
                     </View>
                     <View style={styles.historyTimeCol}>
                       <Text style={[styles.historyLabel, dyn.sub]}>OUT</Text>
                       <Text style={[styles.historyValue, dyn.text]}>{clockOut}</Text>
                     </View>
                  </View>
                )
              })}
            </View>
         )}

        {/* COMPANY FEEDS — announcements from feeds (kind=announcement) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, dyn.text]}>Company Feeds</Text>
          <TouchableOpacity onPress={() => router.push('/feeds')}>
            <Text style={[styles.viewAllText, { color: '#F27121' }]}>View all</Text>
          </TouchableOpacity>
        </View>
        {announcementsLoading ? (
          <View style={[styles.feedCard, dyn.card, styles.announcementLoading]}>
            <ActivityIndicator size="small" color="#F27121" />
            <Text style={[styles.feedContent, dyn.sub]}>Loading announcements...</Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={[styles.feedCard, dyn.card]}>
            <View style={styles.feedHeader}>
              <Ionicons name="megaphone-outline" size={20} color="#F27121" />
              <Text style={styles.feedTitle}>Announcement</Text>
            </View>
            <Text style={[styles.feedContent, dyn.sub]}>No announcements yet. Check back later or view Feeds for posts.</Text>
          </View>
        ) : (
          announcements.map((ann) => (
            <View key={ann.post_id} style={[styles.feedCard, dyn.card]}>
              <View style={styles.feedHeader}>
                <Ionicons name="megaphone-outline" size={20} color="#F27121" />
                <Text style={styles.feedTitle}>Announcement</Text>
                <Text style={[styles.feedMeta, dyn.sub]}>
                  {ann.employees?.name || 'Company'} • {ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}
                </Text>
              </View>
              <Text style={[styles.feedContent, dyn.text]}>{ann.caption}</Text>
              {ann.image_url && (
                <View style={styles.announcementImageWrapper}>
                  <Image
                    source={{
                      uri: (() => {
                        const raw = ann.image_url || '';
                        if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('file://')) return raw;
                        if (raw.startsWith('data:')) return raw;
                        return `data:image/jpeg;base64,${raw}`;
                      })(),
                    }}
                    style={styles.announcementImage}
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>
          ))
        )}

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileButton: { padding: 5 },
  notificationButton: { padding: 5, position: 'relative' },
  notificationBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#F27121', width: 8, height: 8, borderRadius: 4 },
  settingsButton: { padding: 5 },
  
  attendanceCard: { borderRadius: 15, padding: 20, marginBottom: 30, borderLeftWidth: 5, borderLeftColor: '#F27121', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  attendanceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  cardTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  dateText: { fontSize: 12 },
  timerContainer: { alignItems: 'center', marginBottom: 20 },
  timerText: { fontSize: 36, fontWeight: 'bold', letterSpacing: 2 },
  shiftText: { color: '#F27121', fontSize: 14, marginTop: 5 },
  clockInButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 10 },
  clockInText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  viewAllText: { fontSize: 14, fontWeight: '600' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridItem: { width: '30%', borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridLabel: { fontSize: 12, fontWeight: '500' },
  
  historyContainer: { marginBottom: 20 },
  historyRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1 },
  historyDateCol: { flex: 1.5 },
  historyDateText: { fontSize: 14, fontWeight: 'bold' },
  historyTimeCol: { flex: 1, alignItems: 'flex-start' },
  historyLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  historyValue: { fontSize: 14, fontWeight: '600' },

  feedCard: { padding: 15, borderRadius: 12, marginBottom: 12, elevation: 2 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, gap: 6 },
  feedTitle: { color: '#F27121', fontWeight: 'bold', marginLeft: 8 },
  feedMeta: { fontSize: 12, marginLeft: 'auto' },
  feedContent: { lineHeight: 20 },
  announcementLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  announcementImageWrapper: { marginTop: 10, borderRadius: 10, overflow: 'hidden' },
  announcementImage: { width: '100%', height: 140 },
});