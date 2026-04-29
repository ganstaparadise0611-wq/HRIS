import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UserAvatar from '../../components/UserAvatar';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';
import { getUnsyncedAttendanceRecords, getUnsyncedActivityRecords, syncAll } from '../../constants/offline-storage';

import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, interpolate } from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');



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
  const { colors, theme, sidebarVisible, setSidebarVisible } = useTheme();
  const isDark = theme === 'dark';
  
  const currentDate = new Date().toDateString();
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');
  const [userId, setUserId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementPost[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadStatus = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            setUserId(userId);
            
            if (userId) {
              const baseUrl = getBackendUrl();
              try {
                const res = await fetch(`${baseUrl}/check-attendance-status.php?user_id=${userId}`, {
                  headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                const data = await res.json();
                if (data.ok && data.clocked_in) {
                  const [h, m] = data.timein.split(':');
                  const hour = parseInt(h, 10);
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const hour12 = hour % 12 || 12;
                  const timeStr = `${hour12.toString().padStart(2, '0')}:${m} ${ampm}`;
                  setClockInTime(timeStr);
                  await AsyncStorage.setItem('userClockInTime', timeStr);
                } else {
                  setClockInTime(null);
                  await AsyncStorage.removeItem('userClockInTime');
                }
              } catch (e) {
                console.log("Failed to load status from backend, checking local storage...");
                const savedTime = await AsyncStorage.getItem('userClockInTime');
                setClockInTime(savedTime);
              }

              try {
                const response = await fetch(
                  `${baseUrl}/get-employee-profile.php?user_id=${userId}`,
                  { headers: { 'ngrok-skip-browser-warning': 'true' } }
                );
                const data = await response.json();
                if (data?.ok && data.employee?.name) {
                  setUserName(data.employee.name);
                } else {
                  const username = await AsyncStorage.getItem('username');
                  if (username) setUserName(username);
                }
              } catch (e) {
                console.log('Error loading user name:', e);
                const username = await AsyncStorage.getItem('username');
                if (username) setUserName(username);
              }
            }
        } catch (e) {
            console.log("Error loading time");
        }
      };

      const loadAnnouncements = async () => {
        try {
          setAnnouncementsLoading(true);
          const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../../constants/backend-config');
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
          const baseUrl = getBackendUrl();
          const res = await fetch(`${baseUrl}/get-attendance-history.php?user_id=${userId}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' },
          });
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

      // Auto-sync any offline records in background
      const autoSync = async () => {
        try {
          const unsyncedAtt = await getUnsyncedAttendanceRecords();
          const unsyncedAct = await getUnsyncedActivityRecords();
          if (unsyncedAtt.length > 0 || unsyncedAct.length > 0) {
            console.log(`[AutoSync] Found ${unsyncedAtt.length} attendance + ${unsyncedAct.length} activity records to sync`);
            const result = await syncAll();
            console.log('[AutoSync] Result:', JSON.stringify(result));
          }
        } catch (e) {
          console.log('[AutoSync] Background sync failed (will retry later):', e);
        }
      };
      autoSync();
    }, [])
  );

  // DYNAMIC STYLES
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    iconBg: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' },
    border: { borderColor: colors.border }
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={[styles.mainWrapper, dyn.bg]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setSidebarVisible(true)}
                style={styles.menuButton}
                activeOpacity={0.7}
              >
                <Ionicons name="menu-outline" size={28} color={colors.text} />
              </TouchableOpacity>
              <View>
                <Text style={[styles.greeting, dyn.text]}>Hi, {userName.split(' ')[0]}</Text>
                <Text style={[styles.subGreeting, dyn.sub]}>Lets be productive today.</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => router.push('/(tabs)/usernotifications' as any)}
              >
                <Ionicons name="notifications-outline" size={26} color={colors.text} />
                <View style={styles.notificationBadge} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => router.push('/userprofile')}
              >
                <UserAvatar
                  userId={userId}
                  displayName={userName}
                  size={44}
                  backgroundColor="#F27121"
                />
              </TouchableOpacity>
            </View>
          </View>

          <Animated.View style={animatedStyle}>
            {/* ATTENDANCE CARD - TARSI STYLE */}
            <View style={[styles.attendanceCard, dyn.card]}>
              <View style={styles.attendanceContent}>
                <View style={styles.attendanceLeft}>
                   <Text style={[styles.cardTitle, dyn.sub]}>TODAY</Text>
                   <Text style={[styles.timerText, dyn.text]}>{clockInTime ? clockInTime : "-- : --"}</Text>
                   <Text style={[styles.shiftText, dyn.sub]}>8:00 AM - 5:00 PM</Text>
                </View>
                <View style={styles.attendanceDivider} />
                <View style={styles.attendanceRight}>
                   <Text style={[styles.cardTitle, dyn.sub]}>STATUS</Text>
                   <View style={[styles.statusBadge, { backgroundColor: clockInTime ? 'rgba(39, 174, 96, 0.1)' : 'rgba(242, 113, 33, 0.1)' }]}>
                      <Text style={[styles.statusText, { color: clockInTime ? '#27AE60' : '#F27121' }]}>
                        {clockInTime ? 'In Office' : 'Not In'}
                      </Text>
                   </View>
                </View>
              </View>
              
              <TouchableOpacity 
                style={[styles.clockInButton, { backgroundColor: '#F27121' }]} 
                onPress={() => router.push('/userattendance')} 
              >
                <Text style={styles.clockInText}>
                    {clockInTime ? "View Status" : "Clock In Now"}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* QUICK ACCESS GRID */}
            <View style={styles.gridContainer}>
              {[
                { label: 'Activity', icon: 'camera-outline', route: '/useractivity', lib: Ionicons },
                { label: 'Chat', icon: 'chatbubble-outline', route: '/userchat', lib: Ionicons },
                { label: 'Tasks', icon: 'checkbox-outline', route: '/usertasks', lib: Ionicons },
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
               <Text style={[styles.sectionTitle, dyn.text]}>Recent History</Text>
               <TouchableOpacity onPress={() => router.push('/(tabs)/attendancehistory' as any)}>
                 <Ionicons name="ellipsis-horizontal" size={20} color={colors.subText} />
               </TouchableOpacity>
             </View>
             
             {attendanceLoading ? (
                <ActivityIndicator size="small" color="#F27121" style={{marginBottom: 20}} />
             ) : (
                <View style={styles.historyContainer}>
                  {attendanceHistory.length === 0 ? (
                    <Text style={[dyn.sub, {marginBottom: 20}]}>No records found.</Text>
                  ) : (
                    attendanceHistory.map(item => {
                      const formatTime = (timeStr: string | null) => {
                        if (!timeStr) return '--:--';
                        const parts = timeStr.split(':');
                        const h = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
                      };
                      return (
                        <View key={item.att_id} style={[styles.historyRow, dyn.card]}>
                           <View style={[styles.historyIcon, { backgroundColor: 'rgba(39, 174, 96, 0.1)' }]}>
                             <Ionicons name="time-outline" size={20} color="#27AE60" />
                           </View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                             <Text style={[styles.historyDateText, dyn.text]}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                             <Text style={[styles.historyLabel, dyn.sub]}>{formatTime(item.timein)} • {item.timeout ? formatTime(item.timeout) : 'Active'}</Text>
                           </View>
                           <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                        </View>
                      )
                    })
                  )}
                </View>
             )}

            {/* COMPANY FEEDS */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, dyn.text]}>Announcements</Text>
            </View>
            {announcementsLoading ? (
              <ActivityIndicator size="small" color="#F27121" />
            ) : announcements.length === 0 ? (
              <View style={[styles.feedCard, dyn.card, { borderRadius: 28 }]}>
                <Text style={[styles.feedContent, dyn.sub]}>No new announcements.</Text>
              </View>
            ) : (
              announcements.map((ann) => (
                <View key={ann.post_id} style={[styles.feedCard, dyn.card]}>
                  <View style={styles.feedHeader}>
                    <UserAvatar displayName={ann.employees?.name || 'C'} size={32} backgroundColor="#F27121" />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.feedTitle, dyn.text]}>{ann.employees?.name || 'Company'}</Text>
                      <Text style={[styles.feedMeta, dyn.sub]}>{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</Text>
                    </View>
                  </View>
                  <Text style={[styles.feedContent, dyn.text]}>{ann.caption}</Text>
                  {ann.image_url && (
                    <Image
                      source={{ uri: ann.image_url.startsWith('http') ? ann.image_url : `data:image/jpeg;base64,${ann.image_url}` }}
                      style={styles.announcementImage}
                      resizeMode="cover"
                    />
                  )}
                </View>
              ))
            )}
          </Animated.View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </View>

  );
}

const styles = StyleSheet.create({

  container: { flex: 1 },
  mainWrapper: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  menuButton: { padding: 6, borderRadius: 20 },
  greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subGreeting: { fontSize: 15, marginTop: 2, opacity: 0.7 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileButton: { marginLeft: 4 },
  notificationButton: { 
    padding: 10, 
    borderRadius: 20, 
    backgroundColor: 'rgba(0,0,0,0.03)',
    position: 'relative' 
  },
  notificationBadge: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    backgroundColor: '#F27121', 
    width: 8, 
    height: 8, 
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFF'
  },
  
  attendanceCard: { 
    borderRadius: 28, 
    padding: 24, 
    marginBottom: 30, 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 20, 
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  attendanceContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  attendanceLeft: { flex: 1 },
  attendanceDivider: { width: 1, height: '80%', backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 20 },
  attendanceRight: { flex: 0.8 },
  
  cardTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8, opacity: 0.6 },
  timerText: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  shiftText: { fontSize: 13, opacity: 0.5, marginTop: 4 },
  
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '700' },
  
  clockInButton: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 20,
    gap: 10
  },
  clockInText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  
  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  gridItem: { 
    width: '31%', 
    borderRadius: 24, 
    padding: 20, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2
  },
  iconCircle: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridLabel: { fontSize: 13, fontWeight: '700' },
  
  historyContainer: { marginBottom: 30 },
  historyRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 24, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1
  },
  historyIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  historyDateText: { fontSize: 15, fontWeight: '700' },
  historyLabel: { fontSize: 13, opacity: 0.6, marginTop: 2 },

  feedCard: { padding: 24, borderRadius: 28, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  feedTitle: { fontWeight: '800', fontSize: 16 },
  feedMeta: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  feedContent: { lineHeight: 22, fontSize: 15, opacity: 0.8 },
  announcementImage: { width: '100%', height: 200, borderRadius: 20, marginTop: 16 },
});