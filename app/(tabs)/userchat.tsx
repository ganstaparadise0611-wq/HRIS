import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

type ChatData = {
  id: string; type: string; name: string; message: string; time: string; unread: number; online?: boolean;
};

export default function UserChat() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchText, setSearchText] = useState('');

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    search: { backgroundColor: isDark ? '#252525' : '#E0E0E0', color: colors.text }
  };

  const chatData: ChatData[] = [
    { id: '1', type: 'channel', name: '# announcements', message: 'HR: Please update your 201 files.', time: '10:30 AM', unread: 2 },
    { id: '2', type: 'channel', name: '# it-support', message: 'You: Server is back online.', time: 'Yesterday', unread: 0 },
    { id: '3', type: 'dm', name: 'Supervisor', message: 'Great job on the pitch deck!', time: 'Yesterday', unread: 0, online: true },
    { id: '4', type: 'dm', name: 'HR Manager', message: 'Sent the form. Thanks.', time: 'Mon', unread: 0, online: false },
    { id: '5', type: 'dm', name: 'John Doe (Intern)', message: 'Can you help me with React?', time: 'Mon', unread: 1, online: true },
  ];

  const renderItem = ({ item }: { item: ChatData }) => (
    <TouchableOpacity style={[styles.chatItem, dyn.bg]}>
      <View style={styles.avatarContainer}>
        {item.type === 'channel' ? (
           <View style={[styles.avatar, { backgroundColor: isDark ? '#2C3E50' : '#BDC3C7' }]}>
             <Text style={styles.channelIcon}>#</Text>
           </View>
        ) : (
           <View style={[styles.avatar, { backgroundColor: '#F27121' }]}>
             <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
             {item.online && <View style={[styles.onlineDot, { borderColor: colors.background }]} />}
           </View>
        )}
      </View>
      <View style={[styles.messageContent, dyn.border]}>
        <View style={styles.messageHeader}>
            <Text style={[styles.chatName, dyn.text]}>{item.name}</Text>
            <Text style={[styles.timeText, dyn.sub]}>{item.time}</Text>
        </View>
        <View style={styles.messageFooter}>
            <Text style={[styles.lastMessage, dyn.sub, item.unread > 0 && { color: colors.text, fontWeight: 'bold' }]} numberOfLines={1}>
                {item.message}
            </Text>
            {item.unread > 0 && (
                <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread}</Text></View>
            )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Team Chat</Text>
        <TouchableOpacity style={styles.iconBtn}>
           <Ionicons name="create-outline" size={24} color="#F27121" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, dyn.search]}>
        <Ionicons name="search" size={20} color={colors.subText} style={styles.searchIcon} />
        <TextInput 
            style={[styles.searchInput, { color: colors.text }]} 
            placeholder="Search messages..." 
            placeholderTextColor={colors.subText}
            value={searchText}
            onChangeText={setSearchText}
        />
      </View>

      <FlatList
        data={chatData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 20, paddingHorizontal: 15, borderRadius: 10, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1 },
  listContent: { paddingHorizontal: 20 },
  chatItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  channelIcon: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2ecc71', position: 'absolute', bottom: 0, right: 0, borderWidth: 2 },
  messageContent: { flex: 1, borderBottomWidth: 1, paddingBottom: 15 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  chatName: { fontSize: 16, fontWeight: 'bold' },
  timeText: { fontSize: 12 },
  messageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, flex: 1, marginRight: 10 },
  unreadBadge: { backgroundColor: '#F27121', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
});