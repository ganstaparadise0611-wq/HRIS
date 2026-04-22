// ModernSidebar.tsx – Premium Facebook‑style animated sidebar
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Animated as RNAnimated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserAvatar from './UserAvatar';
import { useTheme } from '../app/(tabs)/ThemeContext';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getBackendUrl } from '../constants/backend-config';
import { CompanyInnerContent, POLICIES, PolicyModal } from '../app/(tabs)/company';
import CustomAlert from './CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ─── Section headings ────────────────────────────────────────────────────────
const SECTION_LABEL_WORKSPACE = 'MAIN WORKSPACE';
const SECTION_LABEL_ACCOUNT   = 'ACCOUNT';

// Settings items
const SETTINGS = [
  { label: 'My Profile',     icon: 'person-outline',           route: '/userprofile' },
  { label: 'Notifications',  icon: 'notifications-outline',    route: '/(tabs)/usernotifications' },
  { label: 'Security',       icon: 'lock-closed-outline',      route: '/usermenu' },
  { label: 'Help & Support', icon: 'help-circle-outline',      route: '/help' },
];

// Feature grid
const FEATURES = [
  { label: 'Payslip',     icon: 'file-tray-full-outline', route: '/userpayslip',                      lib: Ionicons },
  { label: 'Overtime',    icon: 'clock-fast',             route: '/userovertime',                     lib: MaterialCommunityIcons },
  { label: 'Leave',       icon: 'calendar-outline',       route: '/userleave',                        lib: Ionicons },
  { label: 'On Duty',     icon: 'airplane-outline',       route: '/useronduty',                       lib: Ionicons },
  { label: 'Att. List',   icon: 'list-outline',           route: '/(tabs)/attendancehistory',         lib: Ionicons },
  { label: 'Correction',  icon: 'time-outline',           route: '/(tabs)/userattendancecorrection',  lib: Ionicons },
  { label: 'Shift Sched', icon: 'moon-outline',           route: '/(tabs)/shiftschedule',             lib: Ionicons },
  { label: 'Timesheet',   icon: 'journal-outline',        route: '/(tabs)/usertimesheet',             lib: Ionicons },
];

const COMPANY_FEATURES = [
  // Keeping as fallback if needed, but not rendered directly in the loop anymore
];

// Tools & Others grid
const TOOLS_FEATURES = [
  { label: 'Activity',    icon: 'camera-outline',         route: '/(tabs)/useractivity',              lib: Ionicons },
  { label: 'Chat',        icon: 'chatbubble-ellipses-outline', route: '/(tabs)/userchat',             lib: Ionicons },
  { label: 'Tasks',       icon: 'checkmark-done-outline', route: '/(tabs)/usertasks',                 lib: Ionicons },
  { label: 'Feeds',       icon: 'albums-outline',         route: '/(tabs)/feeds',                     lib: Ionicons },
  { label: 'Scanner',     icon: 'qr-code-outline',        route: '/(tabs)/userattendance',            lib: Ionicons },
  { label: 'Settings',    icon: 'settings-outline',       route: '/(tabs)/usermenu',                  lib: Ionicons },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.85;
const ACCENT = '#F27121';

// ─── Pulsing dot component ───────────────────────────────────────────────────
function PulsingDot() {
  const pulse = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={dotStyles.wrapper}>
      <RNAnimated.View style={[dotStyles.ring, { transform: [{ scale: pulse }] }]} />
      <View style={dotStyles.core} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  wrapper: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  ring:    { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(39,174,96,0.35)' },
  core:    { width: 8,  height: 8,  borderRadius: 4, backgroundColor: '#27AE60' },
});

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ label, color }: { label: string; color: string }) {
  return (
    <View style={shStyles.row}>
      <View style={[shStyles.line, { backgroundColor: color }]} />
      <Text style={[shStyles.text, { color }]}>{label}</Text>
      <View style={[shStyles.line, { backgroundColor: color, flex: 1 }]} />
    </View>
  );
}

const shStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginHorizontal: 8 },
  line: { height: 1, width: 16, opacity: 0.4 },
});

// ─── Quick stat card ─────────────────────────────────────────────────────────
function StatCard({ icon, label, value, cardBg, textColor, subColor }:
  { icon: string; label: string; value: string; cardBg: string; textColor: string; subColor: string }) {
  return (
    <View style={[statStyles.card, { backgroundColor: cardBg }]}>
      <Ionicons name={icon as any} size={16} color={ACCENT} style={{ marginBottom: 4 }} />
      <Text style={[statStyles.value, { color: textColor }]}>{value}</Text>
      <Text style={[statStyles.label, { color: subColor }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card:  { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', marginHorizontal: 4 },
  value: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 10, marginTop: 2, fontWeight: '500' },
});

// ─── Embedded Company Component ──────────────────────────────────────────────
function SidebarCompanyComponent({ colors, isDark }: { colors: any; isDark: boolean }) {
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(30)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      RNAnimated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const openPolicy = (policy: any) => {
    setSelectedPolicy(policy);
    setModalVisible(true);
  };

  const closePolicy = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedPolicy(null), 300);
  };

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
  };

  return (
    <View style={{ marginTop: 8 }}>
      <CompanyInnerContent 
          fadeAnim={fadeAnim} 
          slideAnim={slideAnim} 
          dyn={dyn} 
          colors={colors} 
          isDark={isDark} 
          openPolicy={openPolicy} 
      />
      <PolicyModal
        visible={modalVisible}
        policy={selectedPolicy}
        onClose={closePolicy}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

// ─── Embedded Activity Component ─────────────────────────────────────────────
function SidebarActivityComponent({ colors, isDark }: { colors: any; isDark: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) return;

        // Fetch Notifications
        const nRes = await fetch(`${getBackendUrl()}/get-notifications.php?user_id=${userId}`);
        const nData = await nRes.json();
        if (nData.success && Array.isArray(nData.notifications) && isMounted) {
          setNotifs(nData.notifications.slice(0, 3));
        }

        // Fetch Pending Tasks
        const tRes = await fetch(
          `${SUPABASE_URL}/rest/v1/tasks?assignee_id=eq.${userId}&status=eq.pending&order=created_at.desc&limit=3`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        const tData = await tRes.json();
        if (Array.isArray(tData) && isMounted) {
          setTasks(tData);
        }

        // Fetch Attendance History
        const aRes = await fetch(`${getBackendUrl()}/get-attendance-history.php?user_id=${userId}`);
        const aData = await aRes.json();
        if (aData.ok && Array.isArray(aData.history) && isMounted) {
          setHistory(aData.history.slice(0, 3));
        }

      } catch (e) {} finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const dyn = {
    card: { backgroundColor: colors.card },
    text: { color: colors.text },
    sub: { color: colors.subText },
  };

  if (loading) {
    return (
       <View style={{ padding: 30, alignItems: 'center' }}>
         <Text style={{ color: colors.subText, fontSize: 13 }}>Loading activity...</Text>
       </View>
    );
  }

  return (
    <View style={{ marginTop: 10, paddingHorizontal: 4 }}>
       {/* Notifications */}
       <SectionHeading label="RECENT NOTIFICATIONS" color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
       {notifs.map((n, i) => (
         <View key={`n-${i}`} style={[dyn.card, { padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: isDark ? '#333' : '#EEE' }]}>
           <Text style={[dyn.text, { fontWeight: '700', fontSize: 13, marginBottom: 2 }]} numberOfLines={1}>{n.title}</Text>
           <Text style={[dyn.sub, { fontSize: 12 }]} numberOfLines={2}>{n.message}</Text>
         </View>
       ))}
       {notifs.length === 0 && <Text style={[dyn.sub, { fontSize: 12, marginBottom: 16, fontStyle: 'italic', textAlign: 'center' }]}>No recent notifications</Text>}

       {/* Tasks */}
       <SectionHeading label="PENDING TASKS" color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
       {tasks.map((t, i) => (
         <View key={`t-${i}`} style={[dyn.card, { padding: 12, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#333' : '#EEE' }]}>
           <Ionicons name="ellipse-outline" size={16} color="#F27121" style={{ marginRight: 8 }} />
           <Text style={[dyn.text, { fontSize: 13, flex: 1, fontWeight: '600' }]} numberOfLines={1}>{t.title}</Text>
         </View>
       ))}
       {tasks.length === 0 && <Text style={[dyn.sub, { fontSize: 12, marginBottom: 16, fontStyle: 'italic', textAlign: 'center' }]}>All caught up on tasks</Text>}

       {/* Attendance */}
       <SectionHeading label="RECENT ATTENDANCE" color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
       {history.map((h, i) => (
         <View key={`h-${i}`} style={[dyn.card, { padding: 10, borderRadius: 10, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#333' : '#EEE' }]}>
           <Text style={[dyn.text, { fontSize: 13, fontWeight: '700' }]}>{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
           <Text style={[dyn.sub, { fontSize: 12, fontWeight: '600' }]}>{h.timein ? h.timein.substring(0,5) : '--'}  •  {h.timeout ? h.timeout.substring(0,5) : '--'}</Text>
         </View>
       ))}
       {history.length === 0 && <Text style={[dyn.sub, { fontSize: 12, fontStyle: 'italic', textAlign: 'center' }]}>No recent attendance logs</Text>}

       <TouchableOpacity 
          style={{ marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(242, 113, 33, 0.1)', alignItems: 'center', marginBottom: 20 }}
          onPress={() => router.push('/(tabs)/useractivity' as any)}
          activeOpacity={0.7}
       >
         <Text style={{ color: '#F27121', fontWeight: 'bold', fontSize: 13 }}>View Full Activity Log</Text>
       </TouchableOpacity>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ModernSidebar() {
  const { colors, theme, toggleTheme, sidebarVisible, setSidebarVisible } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();

  const dyn = {
    bg:     { backgroundColor: colors.background },
    text:   { color: colors.text },
    sub:    { color: colors.subText },
    card:   { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    iconBg: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
  };

  // ── Profile state ──────────────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState<'Features' | 'Company' | 'Tools'>('Features');
  const [userName,    setUserName]    = useState('User');
  const [userId,      setUserId]      = useState<string | null>(null);
  const [userRole,    setUserRole]    = useState('');
  const [userDept,    setUserDept]    = useState('');
  const [leaveLeft,   setLeaveLeft]   = useState<string>('—');
  const [shiftHours,  setShiftHours]  = useState<string>('—');
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string>('—');
  // Shift schedule
  const [shiftName,  setShiftName]  = useState('Regular');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd,   setShiftEnd]   = useState('17:00');
  const [isLate,     setIsLate]     = useState(false);
  const [lateBy,     setLateBy]     = useState('');

  useEffect(() => {
    if (!sidebarVisible) return;

    const load = async () => {
      try {
        const id       = await AsyncStorage.getItem('userId');
        const asyncName = await AsyncStorage.getItem('username');

        if (!id) {
          if (asyncName) setUserName(asyncName);
          return;
        }

        setUserId(id);

        // ── Fetch name + role + dept_id + emp_id ───────────────────────
        const empRes  = await fetch(
          `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${id}&select=emp_id,name,role,dept_id`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        const empData = await empRes.json();

        if (empData && empData.length > 0) {
          const emp = empData[0];
          const actualEmpId = emp.emp_id; // Using the real emp_id

          setUserName(emp.name || asyncName || 'User');
          setUserRole(emp.role || '');

          // Fetch dept name
          if (emp.dept_id) {
            try {
              const deptRes  = await fetch(
                `${SUPABASE_URL}/rest/v1/departments?dept_id=eq.${emp.dept_id}&select=name`,
                { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
              );
              const deptData = await deptRes.json();
              if (deptData && deptData.length > 0) setUserDept(deptData[0].name || '');
            } catch (_) {}
          }

          // ── Today's attendance for clocked-in status & shift hours ────
          try {
            const today    = new Date().toISOString().slice(0, 10);
            const attRes   = await fetch(
              `${SUPABASE_URL}/rest/v1/attendance?emp_id=eq.${actualEmpId}&date=eq.${today}&select=timein,timeout&order=att_id.desc&limit=1`,
              { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
            );
            const attData  = await attRes.json();
            if (attData && attData.length > 0) {
              const rec      = attData[0];
              const hasIn    = !!rec.timein;
              const hasOut   = !!rec.timeout;
              setIsClockedIn(hasIn && !hasOut);

              if (hasIn) {
                // Ensure time string works with new Date (add date prefix) by parsing it explicitly
                // timein and timeout are HH:MM:SS format strings
                const getMins = (ts: string) => { const p = ts.split(':').map(Number); return p[0]*60 + p[1]; };
                
                const inMins  = getMins(rec.timein);
                const outMins = hasOut ? getMins(rec.timeout) : (new Date().getHours()*60 + new Date().getMinutes());
                
                const diffMins = outMins - inMins;
                
                if (diffMins >= 0) {
                   const hrs      = Math.floor(diffMins / 60);
                   const mins     = diffMins % 60;
                   setShiftHours(`${hrs}h ${mins}m`);
                }
              }
            }
          } catch (_) {}

          // ── Shift schedule ────────────────────────────────────────────
          let shiftStartTime = '08:00:00';
          let shiftGrace     = 0;
          try {
            const shiftRes  = await fetch(
              `${getBackendUrl()}/get-shift.php?emp_id=${actualEmpId}`,
              { headers: { 'ngrok-skip-browser-warning': 'true' } }
            );
            const shiftData = await shiftRes.json();
            if (shiftData.ok && shiftData.shift) {
              const s = shiftData.shift;
              shiftStartTime = s.start_time || '08:00:00';
              shiftGrace     = s.grace_period_minutes || 0;
              const fmt = (t: string) => t.substring(0, 5);
              setShiftName(s.shift_name  || 'Regular');
              setShiftStart(fmt(s.start_time || '08:00:00'));
              setShiftEnd(fmt(s.end_time   || '17:00:00'));
            }
          } catch (_) {}

          // ── Compute late status using timein + shift ───────────────
          try {
            const today2   = new Date().toISOString().slice(0, 10);
            const att2Res  = await fetch(
              `${SUPABASE_URL}/rest/v1/attendance?emp_id=eq.${actualEmpId}&date=eq.${today2}&select=timein,timeout&order=att_id.desc&limit=1`,
              { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
            );
            const att2Data = await att2Res.json();
            if (att2Data && att2Data.length > 0 && att2Data[0].timein) {
              const timein = att2Data[0].timein as string;
              const [h, m] = timein.split(':').map(Number);
              const ampm   = h >= 12 ? 'PM' : 'AM';
              const h12    = h % 12 || 12;
              setClockInTime(`${h12}:${String(m).padStart(2, '0')} ${ampm}`);

              const [sh, sm]       = shiftStartTime.split(':').map(Number);
              const shiftStartMins = sh * 60 + sm + shiftGrace;
              const clockInMins    = h * 60 + m;

              if (clockInMins > shiftStartMins) {
                setIsLate(true);
                // Late calculation respects raw start (or use shiftStartMins to omit grace time)
                // Using raw start time for lateness text is usually preferred
                const lateMins = clockInMins - (sh * 60 + sm); 
                const lh = Math.floor(lateMins / 60);
                const lm = lateMins % 60;
                setLateBy(lh > 0 ? `${lh}h ${lm}m late` : `${lm}m late`);
              } else {
                setIsLate(false);
                setLateBy('');
              }
            }
          } catch (_) {}

          // ── Leave credits ────────────────────────────────────────────
          try {
            const leaveRes  = await fetch(
              `${SUPABASE_URL}/rest/v1/leave_credits?emp_id=eq.${actualEmpId}&select=remaining_days&limit=1`,
              { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
            );
            const leaveData = await leaveRes.json();
            if (leaveData && leaveData.length > 0 && leaveData[0].remaining_days != null) {
              setLeaveLeft(`${leaveData[0].remaining_days} days`);
            }
          } catch (_) {}

        } else if (asyncName) {
          setUserName(asyncName);
        }
      } catch (_) {}
    };

    load();
  }, [sidebarVisible]);

  // ── Slide animation ────────────────────────────────────────────────────────
  const translateX = useSharedValue(-SIDEBAR_WIDTH);

  useEffect(() => {
    translateX.value = withTiming(sidebarVisible ? 0 : -SIDEBAR_WIDTH, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [sidebarVisible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handlePress = useCallback((route: string) => {
    router.push(route as any);
    setSidebarVisible(false);
  }, []);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Animated.View style={[styles.container, dyn.bg, animatedStyle]}>

        {/* ── Profile Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <UserAvatar userId={userId} displayName={userName} size={52} />

          <View style={styles.headerInfo}>
            <Text style={[styles.username, dyn.text]} numberOfLines={1}>{userName}</Text>

            {/* Role + Department subtitle */}
            {(userRole || userDept) ? (
              <Text style={[styles.subtitle, dyn.sub]} numberOfLines={1}>
                {[userRole, userDept].filter(Boolean).join(' • ')}
              </Text>
            ) : null}

            {/* Status pill */}
            <View style={[styles.statusPill, isClockedIn && isLate ? styles.statusPillLate : undefined]}>
              <PulsingDot />
              <Text style={[styles.statusText, isClockedIn && isLate ? styles.statusTextLate : undefined]}>
                {isClockedIn ? (isLate ? `Late · ${lateBy}` : 'On Time ✓') : 'Not Clocked In'}
              </Text>
            </View>
          </View>

          {/* Theme toggle + close */}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSidebarVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Scrollable middle section ──────────────────────────────── */}
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.scrollContent}
        >
          {/* Quick Stats Row */}
          <View style={styles.statsRow}>
            <StatCard
              icon="calendar-outline"
              label="Leave Left"
              value={leaveLeft}
              cardBg={colors.card}
              textColor={colors.text}
              subColor={colors.subText}
            />
            <StatCard
              icon="time-outline"
              label="Hours Today"
              value={shiftHours}
              cardBg={colors.card}
              textColor={colors.text}
              subColor={colors.subText}
            />
          </View>

          {/* ── Shift Schedule Banner ── */}
          <View style={[styles.shiftCard, { backgroundColor: isDark ? 'rgba(242,113,33,0.12)' : 'rgba(242,113,33,0.08)' }]}>
            <View style={styles.shiftCardLeft}>
              <Ionicons name="time-outline" size={20} color={ACCENT} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.shiftCardName, { color: ACCENT }]}>{shiftName} Shift</Text>
                <Text style={[styles.shiftCardTime, { color: colors.text }]}>{shiftStart} – {shiftEnd}</Text>
              </View>
            </View>
            {isClockedIn ? (
              <View style={[styles.shiftBadge, { backgroundColor: isLate ? 'rgba(192,57,43,0.15)' : 'rgba(39,174,96,0.15)' }]}>
                <Text style={[styles.shiftBadgeText, { color: isLate ? '#C0392B' : '#27AE60' }]}>
                  {isLate ? '⏰ Late' : '✓ On Time'}
                </Text>
              </View>
            ) : (
              <View style={[styles.shiftBadge, { backgroundColor: 'rgba(150,150,150,0.12)' }]}>
                <Text style={[styles.shiftBadgeText, { color: colors.subText }]}>Not In Yet</Text>
              </View>
            )}
          </View>

          {/* Clock-in time row */}
          {isClockedIn && clockInTime !== '—' && (
            <View style={styles.clockInRow}>
              <Ionicons name="enter-outline" size={14} color={isLate ? '#C0392B' : '#27AE60'} />
              <Text style={styles.clockInLabel}> Clocked in at </Text>
              <Text style={[styles.clockInTime, { color: isLate ? '#C0392B' : '#27AE60' }]}>{clockInTime}</Text>
            </View>
          )}

          {/* Feature Grid */}
          <SectionHeading label={SECTION_LABEL_WORKSPACE} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} />
          
          {/* TAB TOGGLE */}
          <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)' }]}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Features' && { backgroundColor: ACCENT }]}
              onPress={() => setActiveTab('Features')}
            >
              <Text style={[styles.tabText, activeTab === 'Features' ? { color: '#FFF' } : { color: colors.subText }]}>Features</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Company' && { backgroundColor: ACCENT }]}
              onPress={() => setActiveTab('Company')}
            >
              <Text style={[styles.tabText, activeTab === 'Company' ? { color: '#FFF' } : { color: colors.subText }]}>Company</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'Tools' && { backgroundColor: ACCENT }]}
              onPress={() => setActiveTab('Tools')}
            >
              <Text style={[styles.tabText, activeTab === 'Tools' ? { color: '#FFF' } : { color: colors.subText }]}>Others</Text>
            </TouchableOpacity>
          </View>

          {/* Render Active Tab Content */}
          {activeTab === 'Company' ? (
            <SidebarCompanyComponent colors={colors} isDark={isDark} />
          ) : (
            Array.from({ 
              length: Math.ceil((activeTab === 'Features' ? FEATURES : TOOLS_FEATURES).length / 2) 
            }).map((_, rowIdx) => {
              const list = activeTab === 'Features' ? FEATURES : TOOLS_FEATURES;
              const rowItems = list.slice(rowIdx * 2, rowIdx * 2 + 2);
              return (
                <View key={rowIdx} style={styles.row}>
                  {rowItems.map((item) => {
                    const IconComp = item.lib;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[styles.card, dyn.card, dyn.border]}
                        onPress={() => handlePress(item.route)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.iconWrapper, dyn.iconBg]}>
                          <IconComp name={item.icon as any} size={26} color={ACCENT} />
                        </View>
                        <Text style={[styles.label, dyn.text]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {rowItems.length < 2 && <View style={styles.cardSpacer} />}
                </View>
              );
            })
          )}

          {/* Account Settings */}
          <SectionHeading label={SECTION_LABEL_ACCOUNT} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} />
          <View style={styles.settingsContainer}>
            {SETTINGS.map((s) => (
              <TouchableOpacity
                key={s.label}
                style={styles.settingsItem}
                onPress={() => handlePress(s.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.settingsIconWrapper, dyn.iconBg]}>
                  <Ionicons name={s.icon as any} size={18} color={colors.text} />
                </View>
                <Text style={[styles.settingsLabel, dyn.text]}>{s.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.subText} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Logout (pinned at bottom) ───────────────────────────────── */}
        <TouchableOpacity
          style={[styles.logoutBtn, dyn.border]}
          onPress={() => {
            showAlert({
              type: 'warning',
              title: 'Confirm Logout',
              message: 'Are you sure you want to log out of your account?',
              buttonText: 'Logout',
              cancelText: 'Cancel',
              onConfirm: async () => {
                setSidebarVisible(false);
                // Clear session data to prevent auto-login from "Remember Me"
                try {
                  await AsyncStorage.multiRemove([
                    'userId', 
                    'username', 
                    'keepLogged', 
                    'emp_id', 
                    'userClockInTime',
                    'login_keep_logged'
                  ]);
                } catch (e) {}

                setTimeout(() => {
                  router.replace('/userlogin');
                }, 300); // Allow sidebar animation to close before routing
              }
            });
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#C0392B" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <CustomAlert
          visible={visible}
          type={config.type}
          title={config.title}
          message={config.message}
          hint={config.hint}
          buttonText={config.buttonText}
          cancelText={config.cancelText}
          onClose={hideAlert}
          onConfirm={config.onConfirm}
          onCancel={config.onCancel}
        />

      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, top: 8, bottom: 1,
    width: SIDEBAR_WIDTH,
    zIndex: 10,
    paddingTop: 30,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(39,174,96,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  statusText: {
    fontSize: 11,
    color: '#27AE60',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  themeBtn: { padding: 6 },
  closeBtn:  { padding: 6 },

  // Scrollable area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // Quick stats
  statsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  // Feature grid
  row:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardSpacer: { flex: 0.48 },
  card: {
    flex: 0.48,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 7,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Account settings list
  settingsContainer: {
    borderWidth: 0,
    paddingBottom: 4,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingsIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutText: {
    color: '#C0392B',
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Status pill late variant
  statusPillLate: {
    backgroundColor: 'rgba(192,57,43,0.12)',
  },
  statusTextLate: {
    color: '#C0392B',
  },

  // Shift schedule banner
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  shiftCardLeft: { flexDirection: 'row', alignItems: 'center' },
  shiftCardName: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  shiftCardTime: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  shiftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  shiftBadgeText: { fontSize: 12, fontWeight: '700' },

  // Clock-in time row
  clockInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  clockInLabel: { fontSize: 12, color: '#888', fontWeight: '500' },
  clockInTime:  { fontSize: 12, fontWeight: '700' },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
