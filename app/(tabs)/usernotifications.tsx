import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function UserNotifications() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic Theme Colors
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/get-notifications.php?user_id=${userId}`);
      const data = await res.json();
      
      if (data.success && data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/read-notification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.warn('Failed to mark all as read', err);
    }
  };

  const markAsReadAndNavigate = async (notif: Notification) => {
    // Optimistically mark local as read
    if (!notif.is_read) {
      try {
        const backendUrl = getBackendUrl();
        fetch(`${backendUrl}/read-notification.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id }),
        }).catch(() => {});
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (e) {}
    }

    // Navigate Based on Type
    switch (notif.type) {
      case 'chat':
        router.push('/(tabs)/userchat' as any);
        break;
      case 'leave_request':
        router.push('/(tabs)/userleave' as any);
        break;
      case 'overtime_request':
        router.push('/(tabs)/userovertime' as any);
        break;
      case 'on_duty':
        router.push('/(tabs)/useronduty' as any);
        break;
      case 'task_assigned':
        router.push('/(tabs)/usertasks' as any);
        break;
      case 'feeds':
        router.push('/(tabs)/feeds' as any);
        break;
      default:
        // Do nothing for generic notifications
        break;
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'chat': return 'chatbubble-ellipses';
      case 'leave_request': return 'calendar';
      case 'overtime_request': return 'time';
      case 'on_duty': return 'briefcase';
      case 'task_assigned': return 'clipboard';
      case 'feeds': return 'megaphone';
      default: return 'notifications';
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.is_read;
    const dateStr = new Date(item.created_at).toLocaleString();

    return (
      <TouchableOpacity 
        style={[styles.notificationCard, dyn.card, isUnread && styles.unreadCard]}
        onPress={() => markAsReadAndNavigate(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: isUnread ? '#FFECE0' : (isDark ? '#2C3E50' : '#F0F0F0') }]}>
          <Ionicons name={getIconForType(item.type) as any} size={24} color={isUnread ? '#F27121' : dyn.sub.color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, dyn.text]}>{item.title}</Text>
          <Text style={[styles.cardMessage, dyn.sub]} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.cardTime}>{dateStr}</Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <Ionicons name="arrow-back" size={24} color={colors.text} />
         </TouchableOpacity>
         <Text style={[styles.headerTitle, dyn.text]}>Notifications</Text>
         <TouchableOpacity onPress={markAllAsRead}>
           <Text style={styles.markReadText}>Read All</Text>
         </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#F27121" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
          <Text style={[styles.emptyText, dyn.sub]}>No new notifications.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
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
  markReadText: { color: '#F27121', fontSize: 14, fontWeight: '700' },
  
  listContent: { paddingHorizontal: 24, paddingBottom: 120, paddingTop: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  notificationCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 28,
    marginBottom: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#F27121',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardMessage: { fontSize: 13, lineHeight: 18, marginBottom: 6, opacity: 0.7 },
  cardTime: { fontSize: 11, opacity: 0.45 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F27121', marginLeft: 10 },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 15, fontSize: 16 },
});

