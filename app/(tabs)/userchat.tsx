import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import UserAvatar from '../../components/UserAvatar';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl } from '../../constants/backend-config';
import { recheckNetwork } from '../../constants/network-detector';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';

type ChatData = {
  id: string; 
  type: string; 
  name: string; 
  last_message: string; 
  last_message_time: string; 
  unread_count: number; 
  online?: boolean;
  other_user_id?: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    log_id: string;
    username: string;
  };
  media_url?: string;
  media_type?: 'image' | 'video' | 'file';
};

type Account = {
  log_id: string;
  username: string;
};

// --- Optimized ChatItem Component ---
const ChatItem = React.memo(({ item, colorProps, isDarkTheme, onLongPress, onPress }: { 
  item: ChatData; 
  colorProps: any; 
  isDarkTheme: boolean; 
  onLongPress: (chat: ChatData) => void;
  onPress: (chat: ChatData) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => { Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }).start(); };
  const onPressOut = () => { Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start(); };

  return (
    <TouchableOpacity 
      style={[styles.chatItem, { backgroundColor: colorProps.background }]} 
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={500}
    >
      <Animated.View style={[styles.chatItemInner, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.avatarContainer}>
          {item.type === 'channel' ? (
            <View style={[styles.avatar, { backgroundColor: isDarkTheme ? '#2C3E50' : '#BDC3C7' }]}>
              <Text style={styles.channelIcon}>#</Text>
            </View>
          ) : (
            <UserAvatar
              userId={item.other_user_id}
              displayName={item.name}
              size={50}
              showOnline
              isOnline={item.online}
              backgroundColor="#F27121"
              onlineDotBorderColor={colorProps.background}
            />
          )}
        </View>
        <View style={[styles.chatItemContent, { borderBottomColor: colorProps.border }]}>
          <View style={styles.messageHeader}>
              <Text style={[styles.chatName, { color: colorProps.text }]}>{item.name}</Text>
              <Text style={[styles.timeText, { color: colorProps.subText }]}>{item.last_message_time}</Text>
          </View>
          <View style={styles.messageFooter}>
              <Text style={[styles.lastMessage, { color: colorProps.subText }, item.unread_count > 0 && { color: colorProps.text, fontWeight: 'bold' }]} numberOfLines={1}>
                  {item.last_message}
              </Text>
              {item.unread_count > 0 && (
                  <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread_count}</Text></View>
              )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function UserChat() {
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';
  const [searchText, setSearchText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [chatData, setChatData] = useState<ChatData[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [longPressedChat, setLongPressedChat] = useState<ChatData | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const optionsSlideAnim = useRef(new Animated.Value(500)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { loadUserData(); }, []);
  useFocusEffect(useCallback(() => { if (currentUserId) loadConversations(); }, [currentUserId]));

  const loadUserData = async () => {
    const userId = await AsyncStorage.getItem('userId');
    const username = await AsyncStorage.getItem('username');
    setCurrentUserId(userId);
    setCurrentUsername(username || 'User');
  };

  const loadConversations = async (showLoading = true) => {
    if (!currentUserId) return;
    try {
      let baseUrl = getBackendUrl();
      let res;
      try {
        res = await fetch(`${baseUrl}/get-conversations.php?user_id=${currentUserId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (!res.ok) throw new Error('Refresh needed');
      } catch (e) {
        baseUrl = await recheckNetwork();
        res = await fetch(`${baseUrl}/get-conversations.php?user_id=${currentUserId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      }
      
      const result = await res.json();
      if (result.ok) {
        setChatData(result.conversations.map((conv: any) => ({
          id: String(conv.id), type: conv.type, name: conv.name,
          last_message: conv.last_message || 'No messages yet',
          last_message_time: formatTime(conv.last_message_time),
          unread_count: conv.unread_count || 0,
          online: Math.random() > 0.5,
          other_user_id: conv.other_user_id ?? undefined,
        })));
      }
    } catch (e) { console.error('[Chat] Load failed:', e); } finally { setLoadingChats(false); setRefreshing(false); }
  };

  const loadMessages = async (cid: string) => {
    try {
      let baseUrl = getBackendUrl();
      let res;
      try {
        res = await fetch(`${baseUrl}/get-messages.php?conversation_id=${cid}&limit=50`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (!res.ok) throw new Error('Refresh needed');
      } catch (e) {
        baseUrl = await recheckNetwork();
        res = await fetch(`${baseUrl}/get-messages.php?conversation_id=${cid}&limit=50`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      }
      const result = await res.json();
      if (result.ok) {
        setMessages(result.messages);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) { console.error('[Messages] Load failed:', e); }
  };

  const handleSendMessage = async (text: string | null = null, mediaUrl: string | null = null, mediaType: any = null) => {
    if (!selectedChat || !currentUserId) return;
    const content = text !== null ? text : newMessage;
    if (!content.trim() && !mediaUrl) return;
    try {
      const resp = await fetch(`${getBackendUrl()}/send-message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ conversation_id: selectedChat.id, sender_id: currentUserId, content, media_url: mediaUrl, media_type: mediaType })
      });
      const res = await resp.json();
      if (res.ok) {
        if (!mediaUrl) setNewMessage('');
        loadMessages(selectedChat.id);
      }
    } catch (e) { console.error('Send failed:', e); }
  };

  const pickMedia = async (type: 'image' | 'file') => {
    try {
      let result;
      if (type === 'file') {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (result.canceled) return;
        handleMediaUpload(result.assets[0].uri, result.assets[0].name, 'file');
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
        if (result.canceled) return;
        handleMediaUpload(result.assets[0].uri, result.assets[0].fileName || `img_${Date.now()}`, 'image');
      }
    } catch (e) { console.error('Picker error:', e); }
  };

  const handleMediaUpload = async (uri: string, name: string, type: string) => {
    try {
      setIsSending(true);
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', { uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri, type: type === 'image' ? 'image/jpeg' : 'application/octet-stream', name });
      formData.append('type', type);
      const res = await fetch(`${getBackendUrl()}/upload-chat-media.php`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) await handleSendMessage(null, data.media_url, type);
    } catch (e) { console.error('Upload failed:', e); } finally { setIsSending(false); }
  };

  const openChatOptions = (chat: ChatData) => {
    setLongPressedChat(chat);
    setShowChatOptions(true);
    Animated.spring(optionsSlideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
  };

  const closeChatOptions = () => {
    Animated.timing(optionsSlideAnim, { toValue: 500, duration: 200, useNativeDriver: true }).start(() => {
      setShowChatOptions(false);
      setLongPressedChat(null);
    });
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleShare = async (url: string) => {
    try {
      if (!url) return;
      const filename = url.split('/').pop() || 'file';
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const download = await FileSystem.downloadAsync(url, fileUri);
      await Sharing.shareAsync(download.uri);
    } catch (e) { console.error('Share error:', e); }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = String(item.sender_id) === String(currentUserId);
    const isSystemMessage = !item.sender_id || item.content?.includes('added __') || item.content?.includes('created the channel');
    
    return (
      <View style={[styles.messageItemContainer, isOwn && styles.ownMessageContainer, isSystemMessage && styles.systemMessageContainer]}>
        {!isOwn && !isSystemMessage && selectedChat?.type === 'channel' && (
          <Text style={[styles.senderName, { color: colors.subText }]}>{item.sender?.username || 'User'}</Text>
        )}
        <View style={[styles.messageBubble, isSystemMessage ? styles.systemMessageBubble : (isOwn ? styles.ownMessageBubble : { backgroundColor: isDark ? '#222' : '#F0F0F0' })]}>
          {item.media_url && !isSystemMessage && (
            <TouchableOpacity 
              style={styles.mediaContainer} 
              onPress={() => {
                if (item.media_type === 'image') {
                   setSelectedImageUrl(item.media_url || null);
                   setShowImageViewer(true);
                } else {
                   handleShare(item.media_url!);
                }
              }}
            >
              {item.media_type === 'image' && <Image source={{ uri: item.media_url }} style={styles.messageImage} />}
              {item.media_type === 'file' && (
                <View style={styles.fileContainer}><Ionicons name="document-attach" size={24} color="#F27121" /><Text style={{marginLeft: 8, color: isOwn ? '#FFF' : colors.text}} numberOfLines={1}>File</Text></View>
              )}
            </TouchableOpacity>
          )}
          {item.content ? (
            <Text style={[isSystemMessage ? styles.systemMessageText : styles.messageText, { color: isSystemMessage ? colors.subText : (isOwn ? '#FFF' : colors.text) }]}>
              {isSystemMessage && item.content.includes('|') ? item.content.split('|')[1].split(' ')[0] + ' was added' : item.content}
            </Text>
          ) : null}
        </View>
        {!isSystemMessage && item.sender_id && <Text style={[styles.messageTime, { color: colors.subText }]}>{formatTime(item.created_at)}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {!selectedChat ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="search" size={24} color={colors.text} /></TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
            <TouchableOpacity onPress={() => setShowNewChatModal(true)} style={styles.iconBtn}><Ionicons name="add-circle" size={28} color="#F27121" /></TouchableOpacity>
          </View>
          <View style={[styles.searchContainer, { backgroundColor: isDark ? '#2C2C2E' : '#EAEAEA' }]}>
            <Ionicons name="search" size={20} color={colors.subText} style={styles.searchIcon} />
            <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search chats..." placeholderTextColor={colors.subText} value={searchText} onChangeText={setSearchText} />
          </View>
          <FlatList
            data={chatData.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase()))}
            renderItem={({ item }) => <ChatItem item={item} colorProps={colors} isDarkTheme={isDark} onLongPress={openChatOptions} onPress={(c) => { setSelectedChat(c); loadMessages(c.id); }} />}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(false); }} />}
          />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setSelectedChat(null); setMessages([]); }}><Ionicons name="chevron-back" size={24} color="#F27121" /></TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{selectedChat.name}</Text>
            <TouchableOpacity onPress={() => setShowAddMemberModal(true)}><Ionicons name="person-add" size={24} color="#F27121" /></TouchableOpacity>
          </View>
          <FlatList ref={flatListRef} data={messages} renderItem={renderMessage} keyExtractor={item => item.id} contentContainerStyle={{ padding: 20 }} />
          <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => pickMedia('image')}><Ionicons name="image" size={26} color="#F27121" /></TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={() => pickMedia('file')}><Ionicons name="attach" size={26} color="#F27121" /></TouchableOpacity>
            <TextInput style={[styles.messageInput, { color: colors.text, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0' }]} placeholder="Message..." placeholderTextColor={colors.subText} value={newMessage} onChangeText={setNewMessage} multiline />
            {isSending ? <ActivityIndicator size="small" color="#F27121" /> : (
              <TouchableOpacity style={styles.sendBtn} onPress={() => handleSendMessage()}><Ionicons name="send" size={24} color="#F27121" /></TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Image Viewer */}
      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          {selectedImageUrl && <Image source={{ uri: selectedImageUrl }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <TouchableOpacity 
             style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 5 }} 
             onPress={() => setShowImageViewer(false)}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Options Sheet */}
      <Modal visible={showChatOptions} transparent animationType="fade" onRequestClose={closeChatOptions}>
        <Pressable style={styles.sheetOverlay} onPress={closeChatOptions}>
          <Animated.View style={[styles.sheetContent, { backgroundColor: colors.card, transform: [{ translateY: optionsSlideAnim }] }]}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.sheetOption} onPress={() => { closeChatOptions(); }}>
               <Ionicons name="trash" size={22} color="#ff3b30" /><Text style={{ color: '#ff3b30', marginLeft: 15 }}>Leave Conversation</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>

      <CustomAlert visible={visible} type={config.type} title={config.title} message={config.message} buttonText={config.buttonText} onClose={hideAlert} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 20, paddingHorizontal: 15, borderRadius: 10, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1 },
  listContent: { paddingHorizontal: 20 },
  chatItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  chatItemInner: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  channelIcon: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  chatItemContent: { flex: 1, borderBottomWidth: 1, paddingBottom: 15 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  chatName: { fontSize: 16, fontWeight: 'bold' },
  timeText: { fontSize: 12 },
  messageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, flex: 1, marginRight: 10 },
  unreadBadge: { backgroundColor: '#F27121', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  messageItemContainer: { marginBottom: 15, maxWidth: '75%', alignSelf: 'flex-start' },
  ownMessageContainer: { alignSelf: 'flex-end' },
  systemMessageContainer: { alignSelf: 'center', maxWidth: '100%', marginVertical: 8, alignItems: 'center' },
  systemMessageBubble: { backgroundColor: 'transparent' },
  systemMessageText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  senderName: { fontSize: 12, marginBottom: 4, marginLeft: 12 },
  messageBubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' },
  ownMessageBubble: { backgroundColor: '#F27121', borderBottomRightRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  mediaContainer: { marginBottom: 8, borderRadius: 10, overflow: 'hidden' },
  messageImage: { width: 220, height: 160, borderRadius: 10 },
  fileContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1 },
  attachBtn: { padding: 10 },
  messageInput: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100 },
  sendBtn: { padding: 10 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', margin: 10 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', padding: 20 }
});