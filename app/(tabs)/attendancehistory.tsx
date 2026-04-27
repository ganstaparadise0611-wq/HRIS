import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

interface AttendanceRow {
  att_id: number;
  emp_id: number;
  date: string;
  timein: string | null;
  timeout: string | null;
}

export default function AttendanceHistory() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/get-attendance-history.php?user_id=${userId}`);
      const data = await res.json();
      
      if (data.ok && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.warn('Failed to load attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  function formatTime(timeStr: string | null) {
    if (!timeStr) return '--:--';
    // The DB stores time as 'HH:MM:SS' string in Manila time.
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    // Just string formatting avoids JS Date offset issues entirely
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  const renderItem = ({ item }: { item: AttendanceRow }) => {
    return (
      <View style={[styles.historyCard, dyn.card, dyn.border]}>
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={18} color="#F27121" />
          <Text style={[styles.dateText, dyn.text]}>{formatDate(item.date)}</Text>
        </View>
        
        <View style={styles.timeBlock}>
          <View style={styles.timeSection}>
            <Text style={[styles.timeLabel, dyn.sub]}>CLOCK IN</Text>
            <View style={styles.timeValueBlock}>
                <Ionicons name="enter-outline" size={16} color="#2ecc71" />
                <Text style={[styles.timeValue, dyn.text]}>{formatTime(item.timein)}</Text>
            </View>
          </View>
          <View style={styles.timeSection}>
            <Text style={[styles.timeLabel, dyn.sub]}>CLOCK OUT</Text>
            <View style={[styles.timeValueBlock, styles.timeValueRight]}>
                <Text style={[styles.timeValue, dyn.text]}>{formatTime(item.timeout)}</Text>
                <Ionicons name="exit-outline" size={16} color="#e74c3c" />
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Ionicons name="arrow-back" size={24} color={colors.text} />
         </TouchableOpacity>
         <Text style={[styles.headerTitle, dyn.text]}>Attendance History</Text>
         <View style={{width: 32}} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#F27121" />
          <Text style={[styles.loadingText, dyn.sub]}>Loading your records...</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={60} color="#ccc" />
          <Text style={[styles.emptyText, dyn.sub]}>No attendance records found.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.att_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 24, 
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.04)' },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  
  listContent: { paddingHorizontal: 24, paddingBottom: 120, paddingTop: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 15, fontSize: 16 },

  historyCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  dateText: { fontSize: 16, fontWeight: '700', marginLeft: 10 },
  timeBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeSection: {
    flex: 1,
  },
  timeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6, opacity: 0.5 },
  timeValueBlock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeValueRight: { justifyContent: 'flex-end' },
  timeValue: { fontSize: 16, fontWeight: '700' }
});

