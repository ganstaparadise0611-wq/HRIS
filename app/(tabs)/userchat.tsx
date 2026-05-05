import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Reanimated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import UserAvatar from '../../components/UserAvatar';
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
  media_type?: 'image' | 'video' | 'file' | 'voice';
  reply_to_id?: string;
  is_pinned?: boolean;
  is_deleted?: boolean;
  reactions?: any;
  comment_count?: number;
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
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [longPressedChat, setLongPressedChat] = useState<ChatData | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  
  // New features state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [longPressedMsg, setLongPressedMsg] = useState<Message | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [customThemeMap, setCustomThemeMap] = useState<Record<string, any>>({});
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [msgToForward, setMsgToForward] = useState<Message | null>(null);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [currentThreadParent, setCurrentThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [newThreadMessage, setNewThreadMessage] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatInfoModal, setShowChatInfoModal] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const emojiSlideAnim = useRef(new Animated.Value(600)).current;

  // New state for member management
  const [currentConversationMembers, setCurrentConversationMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [searchAccountText, setSearchAccountText] = useState('');
  const [searchedAccounts, setSearchedAccounts] = useState<any[]>([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);



  const optionsSlideAnim = useRef(new Animated.Value(500)).current;
  const msgOptionsSlideAnim = useRef(new Animated.Value(500)).current;
  const flatListRef = useRef<FlatList>(null);

  // Entrance animations
  const fadeAnim = useSharedValue(0);
  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: interpolate(fadeAnim.value, [0, 1], [20, 0]) }]
  }));

  useEffect(() => {
    loadUserData();
    loadTeamMembers();
    loadCachedConversations();

    // Load persisted theme map
    AsyncStorage.getItem('chat_theme_map').then(data => {
      if (data) setCustomThemeMap(JSON.parse(data));
    });
  }, []);

  const loadCachedConversations = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      const cached = await AsyncStorage.getItem(`cached_chats_${userId}`);
      if (cached) {
        setChatData(JSON.parse(cached));
        setLoadingChats(false);
      }
    } catch (e) {
      console.log('Failed to load cached chats:', e);
    }
  };

  useFocusEffect(useCallback(() => { if (currentUserId) loadConversations(false); }, [currentUserId]));

  const loadTeamMembers = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      const res = await fetch(`${getBackendUrl()}/get-department-employees.php?user_id=${userId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.ok && data.employees) {
        setTeamMembers(data.employees);
      }
    } catch (e) {
      console.log('Failed to load team members:', e);
    }
  };

  const loadUserData = async () => {
    const userId = await AsyncStorage.getItem('userId');
    const username = await AsyncStorage.getItem('username');
    setCurrentUserId(userId);

    if (userId) {
      try {
        const res = await fetch(`${getBackendUrl()}/get-department-employees.php?user_id=${userId}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const data = await res.json();
        if (data.ok && data.employees) {
          const me = data.employees.find((e: any) => String(e.log_id) === String(userId));
          if (me && me.name) {
            setCurrentUsername(me.name);
            return;
          }
        }
      } catch (e) {
        console.log('Failed to fetch self name:', e);
      }
    }
    setCurrentUsername(username || 'User');
  };

  const handleReplyPrivately = async (message: Message) => {
    if (!message || !currentUserId || String(message.sender_id) === String(currentUserId)) return;

    closeMsgOptions();

    // 1. Check if we already have a DM with this person in our chat list
    let existingDm = chatData.find(chat => chat.type === 'dm' && String(chat.other_user_id) === String(message.sender_id));

    if (existingDm) {
      // Open existing DM
      setSelectedChat(existingDm);
      loadMessages(existingDm.id);
      setReplyingTo(message); // Context carry over
    } else {
      // 2. Create new DM
      try {
        const senderName = message.sender?.username || 'User';
        const res = await fetch(`${getBackendUrl()}/create-conversation.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({
            creator_id: currentUserId,
            type: 'dm',
            name: `${currentUsername} & ${senderName}`,
            participant_ids: [currentUserId, message.sender_id]
          })
        });
        const data = await res.json();
        if (data.ok) {
          const newConv: ChatData = {
            id: String(data.conversation.id),
            type: 'dm',
            name: senderName,
            last_message: 'No messages yet',
            last_message_time: new Date().toLocaleTimeString(),
            unread_count: 0,
            other_user_id: String(message.sender_id),
            online: false
          };
          setChatData(prev => [newConv, ...prev]);
          setSelectedChat(newConv);
          setMessages([]);
          setReplyingTo(message); // Context carry over
        } else {
          showAlert({ type: 'error', title: 'Error', message: 'Failed to start private chat.' });
        }
      } catch (e) {
        console.error('Failed to create private DM:', e);
        showAlert({ type: 'error', title: 'Error', message: 'Network error while starting private chat.' });
      }
    }
  };

  const loadConversations = async (showLoading = true) => {
    if (!currentUserId) return;
    if (showLoading && chatData.length === 0) setLoadingChats(true);
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
        const sorted = result.conversations.sort((a: any, b: any) => {
          const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
          const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
          return timeB - timeA;
        });
        const formattedChats = sorted.map((conv: any) => ({
          id: String(conv.id), type: conv.type, name: conv.name,
          last_message: conv.last_message || 'No messages yet',
          last_message_time: formatTime(conv.last_message_time),
          unread_count: conv.unread_count || 0,
          online: conv.online || false,
          other_user_id: conv.other_user_id ?? undefined,
        }));
        setChatData(formattedChats);
        await AsyncStorage.setItem(`cached_chats_${currentUserId}`, JSON.stringify(formattedChats));
      }
    } catch (e) { console.error('[Chat] Load failed:', e); } finally { setLoadingChats(false); setRefreshing(false); }
  };

  const loadMessages = async (cid: string, parentId: string | null = null) => {
    if (parentId) setLoadingThread(true);
    
    // 1. Try to load from cache first for instant UI response
    if (!parentId) {
      try {
        const cached = await AsyncStorage.getItem(`cached_msgs_${cid}`);
        if (cached) setMessages(JSON.parse(cached));
      } catch (e) { console.log('Cache read error', e); }
    }

    try {
      let baseUrl = getBackendUrl();
      let res;
      const parentQuery = parentId ? `&parent_id=${parentId}` : '';
      
      try {
        res = await fetch(`${baseUrl}/get-messages.php?conversation_id=${cid}&limit=100${parentQuery}`, { 
          headers: { 'ngrok-skip-browser-warning': 'true' },
          signal: AbortController ? new AbortController().signal : undefined // Basic timeout support if needed
        });
        if (!res.ok) throw new Error('Refresh needed');
      } catch (e) {
        baseUrl = await recheckNetwork();
        res = await fetch(`${baseUrl}/get-messages.php?conversation_id=${cid}&limit=100${parentQuery}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      }

      const result = await res.json();
      if (result.ok) {
        if (parentId) {
          // Keep oldest-to-newest for thread/comments
          setThreadMessages(result.messages);
        } else {
          // Reverse for main chat (newest first for inverted list)
          const reversedMsgs = result.messages.reverse();
          setMessages(reversedMsgs);
          // 2. Save fresh data to cache
          await AsyncStorage.setItem(`cached_msgs_${cid}`, JSON.stringify(reversedMsgs));
        }
      }
    } catch (e) { console.error('[Messages] Load failed:', e); }
    finally { if (parentId) setLoadingThread(false); }
  };

  const loadConversationMembers = async (cid: string) => {
    try {
      setLoadingMembers(true);
      const res = await fetch(`${getBackendUrl()}/get-conversation-members.php?conversation_id=${cid}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentConversationMembers(data.members);
      }
    } catch (e) {
      console.log('Failed to load members:', e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedChat || !currentUserId) return;
    try {
      const res = await fetch(`${getBackendUrl()}/add-conversation-member.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          conversation_id: selectedChat.id,
          user_id: userId,
          inviter_id: currentUserId
        })
      });
      const data = await res.json();
      if (data.ok) {
        showAlert({ type: 'success', title: 'Success', message: 'Member added!' });
        loadConversationMembers(selectedChat.id);
        loadMessages(selectedChat.id); // Refresh to see system message
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.message || 'Failed to add member' });
      }
    } catch (e) {
      showAlert({ type: 'error', title: 'Error', message: 'Network error' });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedParticipants.length === 0 || !currentUserId) {
      showAlert({ type: 'error', title: 'Missing Info', message: 'Please enter a group name and select at least one member.' });
      return;
    }
    try {
      const res = await fetch(`${getBackendUrl()}/create-conversation.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          creator_id: currentUserId,
          type: 'channel',
          name: newGroupName,
          participant_ids: [currentUserId, ...selectedParticipants]
        })
      });
      const data = await res.json();
      if (data.ok) {
        setShowNewChatModal(false);
        setNewGroupName('');
        setSelectedParticipants([]);
        loadConversations(false);
        showAlert({ type: 'success', title: 'Success', message: 'Group created!' });
      } else {
        showAlert({ type: 'error', title: 'Error', message: data.message || 'Failed to create group' });
      }
    } catch (e) {
      showAlert({ type: 'error', title: 'Error', message: 'Network error' });
    }
  };

  const searchAccounts = async (query: string) => {
    if (!query.trim()) {
      setSearchedAccounts([]);
      return;
    }
    try {
      setSearchingAccounts(true);
      const res = await fetch(`${getBackendUrl()}/search-accounts.php?query=${query}&current_user_id=${currentUserId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.ok) {
        setSearchedAccounts(data.accounts);
      }
    } catch (e) {
      console.log('Search failed:', e);
    } finally {
      setSearchingAccounts(false);
    }
  };

  const handleSendMessage = async (text: string | null = null, mediaUrl: string | null = null, mediaType: any = null, replyToIdOverride: string | null = null) => {
    if (!selectedChat || !currentUserId) return;
    const content = text !== null ? text : newMessage;
    if (!content.trim() && !mediaUrl) return;

    // --- Optimistic Update ---
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: selectedChat.id,
      sender_id: currentUserId,
      content: content,
      created_at: new Date().toISOString(),
      sender: {
        log_id: currentUserId,
        username: currentUsername || 'You'
      },
      media_url: mediaUrl || undefined,
      media_type: mediaType || undefined,
      reply_to_id: replyToIdOverride || replyingTo?.id,
    };

    // Add to UI immediately
    if (replyToIdOverride) {
      // Append to bottom for thread (oldest-to-newest flow)
      setThreadMessages(prev => [...prev, optimisticMessage]);
      // Also update the parent message's comment count in the main feed
      setMessages(prev => prev.map(msg =>
        msg.id === replyToIdOverride
          ? { ...msg, comment_count: (msg.comment_count || 0) + 1 }
          : msg
      ));
    } else {
      // Prepend for main chat (newest first for inverted list)
      setMessages(prev => [optimisticMessage, ...prev]);
    }

    if (!mediaUrl) setNewMessage('');
    setReplyingTo(null);

    try {
      const resp = await fetch(`${getBackendUrl()}/send-message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          conversation_id: selectedChat.id,
          sender_id: currentUserId,
          sender_name: currentUsername,
          content,
          media_url: mediaUrl,
          media_type: mediaType,
          reply_to_id: optimisticMessage.reply_to_id
        })
      });
      const res = await resp.json();
      if (res.ok) {
        // Replace temp message with real one from server
        if (optimisticMessage.reply_to_id) {
          setThreadMessages(prev => prev.map(msg => msg.id === tempId ? res.data : msg));
        } else {
          setMessages(prev => prev.map(msg => msg.id === tempId ? res.data : msg));
        }
      } else {
        // If failed, remove optimistic message
        if (optimisticMessage.reply_to_id) {
          setThreadMessages(prev => prev.filter(msg => msg.id !== tempId));
        } else {
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
        }
        showAlert({ type: 'error', title: 'Error', message: 'Failed to send message. Please try again.' });
      }
    } catch (e) {
      console.error('Send failed:', e);
      if (optimisticMessage.reply_to_id) {
        setThreadMessages(prev => prev.filter(msg => msg.id !== tempId));
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
      }
      showAlert({ type: 'error', title: 'Error', message: 'Network error. Could not send message.' });
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat || !currentUserId) return;
    const cid = selectedChat.id;
    setChatData(prev => prev.filter(c => c.id !== cid));
    setSelectedChat(null);
    setMessages([]);
    setShowChatInfoModal(false);
    try {
      await fetch(`${getBackendUrl()}/delete-conversation.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ conversation_id: cid, user_id: currentUserId })
      });
      showAlert({ type: 'success', title: 'Deleted', message: 'Conversation deleted.' });
    } catch (e) {
      loadConversations(false);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to delete.' });
    }
  };

  const toggleEmojiPicker = (show: boolean) => {
    if (show) {
      setShowEmojiPicker(true);
      Animated.spring(emojiSlideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      Animated.timing(emojiSlideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => setShowEmojiPicker(false));
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const emojiList = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'
  ];

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

  const openMsgOptions = (msg: Message) => {
    setLongPressedMsg(msg);
    setShowMessageOptions(true);
    Animated.spring(msgOptionsSlideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
  };

  const closeMsgOptions = () => {
    Animated.timing(msgOptionsSlideAnim, { toValue: 500, duration: 200, useNativeDriver: true }).start(() => {
      setShowMessageOptions(false);
      setLongPressedMsg(null);
    });
  };

  const handleCopyText = async (text: string) => {
    await Clipboard.setStringAsync(text);
    closeMsgOptions();
    showAlert({ type: 'success', title: 'Copied', message: 'Message copied to clipboard.' });
  };

  const handleDeleteMsg = async (msgId: string) => {
    closeMsgOptions();
    if (!currentUserId) return;

    // Optimistic UI update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, content: 'This message was deleted.', media_url: undefined } : m));

    try {
      await fetch(`${getBackendUrl()}/delete-message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId, user_id: currentUserId })
      });
    } catch (e) {
      console.log('Delete failed', e);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    closeMsgOptions();
    if (!currentUserId) return;

    // Optimistic Update
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        let reactions = { ...(m.reactions || {}) };
        if (reactions[emoji] && reactions[emoji].includes(currentUserId)) {
          reactions[emoji] = reactions[emoji].filter((id: string) => id != currentUserId);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          if (!reactions[emoji]) reactions[emoji] = [];
          reactions[emoji].push(currentUserId);
        }
        return { ...m, reactions };
      }
      return m;
    }));

    try {
      await fetch(`${getBackendUrl()}/react-message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId, user_id: currentUserId, emoji })
      });
    } catch (e) { console.error('React failed', e); }
  };

  const handlePin = async (msgId: string, isPinned: boolean) => {
    closeMsgOptions();
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: isPinned } : m));
    try {
      await fetch(`${getBackendUrl()}/pin-message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId, is_pinned: isPinned })
      });
    } catch (e) { console.error('Pin failed', e); }
  };

  const handleForward = async (targetChat: ChatData) => {
    if (!msgToForward || !currentUserId) return;
    setShowForwardModal(false);
    try {
      await fetch(`${getBackendUrl()}/send-message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: targetChat.id,
          sender_id: currentUserId,
          sender_name: currentUsername,
          content: `[Forwarded]: ${msgToForward.content || 'Media'}`,
          media_url: msgToForward.media_url,
          media_type: msgToForward.media_type
        })
      });
      showAlert({ type: 'success', title: 'Forwarded', message: `Message forwarded to ${targetChat.name}` });
    } catch (e) { console.error('Forward failed', e); } finally { setMsgToForward(null); }
  };

  const handleSelectTheme = (theme: any) => {
    if (!selectedChat) return;
    const newMap = { ...customThemeMap, [selectedChat.id]: theme };
    setCustomThemeMap(newMap);
    setShowThemeModal(false);
    AsyncStorage.setItem('chat_theme_map', JSON.stringify(newMap));
  };

  const getThemeConfig = () => {
    const activeTheme = selectedChat ? customThemeMap[selectedChat.id] : null;
    switch (activeTheme) {
      case 'midnight': return { bg: '#0F172A', ownBubble: '#3B82F6', otherBubble: isDark ? '#1E293B' : '#334155', text: '#FFF', otherText: '#FFF', subText: '#94A3B8', headerBg: '#0F172A', isImage: false, inputBg: '#1E293B', listBg: '#0F172A' };
      case 'abstract_1': return { bgImage: require('../../assets/images/download (10).jpg'), ownBubble: '#60A5FA', otherBubble: 'rgba(30, 30, 60, 0.7)', text: '#FFF', otherText: '#E0E7FF', subText: 'rgba(200,210,240,0.8)', headerBg: 'transparent', isImage: true, inputBg: 'rgba(15, 15, 40, 0.45)', listBg: 'transparent' };
      case 'abstract_2': return { bgImage: require('../../assets/images/download (11).jpg'), ownBubble: '#10B981', otherBubble: 'rgba(20, 20, 20, 0.65)', text: '#FFF', otherText: '#E0FFF0', subText: 'rgba(200,240,220,0.8)', headerBg: 'transparent', isImage: true, inputBg: 'rgba(10, 20, 10, 0.45)', listBg: 'transparent' };
      default: return { bg: colors.background, ownBubble: '#F27121', otherBubble: isDark ? '#222' : '#F0F0F0', text: '#FFF', otherText: colors.text, subText: colors.subText, headerBg: colors.background, isImage: false, inputBg: isDark ? '#2C2C2E' : '#F0F0F0', listBg: colors.background };
    }
  };
  const themeConfig = getThemeConfig();

    const MessageItem = ({ item, isOwn, isSystemMessage, repliedMsg, isThread }: { item: Message, isOwn: boolean, isSystemMessage: boolean, repliedMsg: Message | null, isThread?: boolean }) => {
      const swipeableRef = useRef<Swipeable>(null);

      const renderSwipeAction = () => (
        <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="arrow-undo" size={24} color={themeConfig.ownBubble} />
        </View>
      );

      if (isSystemMessage) {
        return (
          <View style={styles.systemMessageContainer}>
            <View style={styles.systemMessageBubble}>
              <Text style={[styles.systemMessageText, { color: colors.subText }]}>{item.content}</Text>
            </View>
          </View>
        );
      }

      return (
        <Swipeable
          ref={swipeableRef}
          containerStyle={{ width: '100%' }}
          renderRightActions={isOwn && !isSystemMessage ? renderSwipeAction : undefined}
          renderLeftActions={!isOwn && !isSystemMessage ? renderSwipeAction : undefined}
          onSwipeableWillOpen={() => {
            setReplyingTo(item);
            setTimeout(() => swipeableRef.current?.close(), 0);
          }}
          friction={2}
          rightThreshold={30}
          leftThreshold={30}
        >
          <View style={[styles.messageItemContainer, isOwn && styles.ownMessageContainer, isSystemMessage && styles.systemMessageContainer]}>
            {!isOwn && !isSystemMessage && selectedChat?.type === 'channel' && (
              <Text style={[styles.senderName, { color: themeConfig.subText }]}>{item.sender?.username || 'User'}</Text>
            )}
            <View style={{ position: 'relative' }}>
              <Pressable
                onLongPress={() => !isSystemMessage && openMsgOptions(item)}
                delayLongPress={300}
                style={({ pressed }) => [
                  styles.messageBubble,
                  isSystemMessage ? styles.systemMessageBubble : { backgroundColor: isOwn ? themeConfig.ownBubble : themeConfig.otherBubble },
                  pressed && !isSystemMessage && { opacity: 0.8 },
                  { marginBottom: (item.reactions && Object.keys(item.reactions).length > 0) ? 10 : 0 }
                ]}
              >
                {repliedMsg && !isSystemMessage && (
                  <View style={[styles.replyPreview, { backgroundColor: isOwn ? 'rgba(0,0,0,0.1)' : 'rgba(150,150,150,0.2)', borderLeftColor: isOwn ? '#FFF' : themeConfig.ownBubble }]}>
                    <Text style={[styles.replyPreviewName, { color: isOwn ? themeConfig.text : themeConfig.otherText }]}>{repliedMsg.sender?.username || 'User'}</Text>
                    <Text style={[styles.replyPreviewText, { color: isOwn ? 'rgba(255,255,255,0.8)' : themeConfig.subText }]} numberOfLines={1}>
                      {repliedMsg.is_deleted ? 'This message was deleted' : (repliedMsg.content || 'Attachment')}
                    </Text>
                  </View>
                )}
                {item.media_url && !isSystemMessage && !item.is_deleted && (
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
                      <View style={styles.fileContainer}><Ionicons name="document-attach" size={24} color="#F27121" /><Text style={{ marginLeft: 8, color: isOwn ? '#FFF' : colors.text }} numberOfLines={1}>File</Text></View>
                    )}
                  </TouchableOpacity>
                )}
                {item.content ? (
                  <Text style={[
                    isSystemMessage ? styles.systemMessageText : styles.messageText,
                    { color: isSystemMessage ? colors.subText : (isOwn ? themeConfig.text : themeConfig.otherText) },
                    item.is_deleted && { fontStyle: 'italic', opacity: 0.7 }
                  ]}>
                    {isSystemMessage && item.content.includes('|') ? item.content.split('|')[1].split(' ')[0] + ' was added' : (item.is_deleted ? 'This message was deleted' : item.content)}
                  </Text>
                ) : null}

                {!isSystemMessage && !item.is_deleted && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isOwn ? 'flex-start' : 'flex-end', marginTop: 4 }}>
                    {item.is_pinned && <Ionicons name="pin" size={10} color={isOwn ? 'rgba(255,255,255,0.7)' : themeConfig.ownBubble} style={{ marginRight: 4 }} />}
                    <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.7)' : themeConfig.subText }}>{formatTime(item.created_at)}</Text>
                  </View>
                )}

                {isThread !== true && !isSystemMessage && selectedChat?.type === 'channel' && !item.is_deleted && (
                  <View style={{
                    marginTop: 10,
                    marginHorizontal: -16,
                    marginBottom: -10,
                    borderTopWidth: 1,
                    borderTopColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                    backgroundColor: isOwn ? 'rgba(0,0,0,0.05)' : 'rgba(115,96,242,0.03)',
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: 24,
                    paddingVertical: 12,
                    paddingHorizontal: 16
                  }}>
                    {item.comment_count && item.comment_count > 0 ? (
                      <TouchableOpacity
                        onPress={() => {
                          setCurrentThreadParent(item);
                          setThreadMessages([]);
                          loadMessages(selectedChat.id, item.id);
                          setShowThreadModal(true);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 13, color: isOwn ? '#FFF' : '#7360F2', fontWeight: 'bold' }}>
                          {item.comment_count} {item.comment_count === 1 ? 'Comment' : 'Comments'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setCurrentThreadParent(item);
                          setThreadMessages([]);
                          loadMessages(selectedChat.id, item.id);
                          setShowThreadModal(true);
                        }}
                      >
                        <Text style={{ fontSize: 13, color: isOwn ? 'rgba(255,255,255,0.9)' : '#7360F2' }}>Leave a comment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Pressable>

              {item.reactions && Object.keys(item.reactions).length > 0 && (
                <View style={[styles.reactionContainer, { position: 'absolute', bottom: -14, right: 0, zIndex: 30 }]}>
                  {Object.keys(item.reactions).map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => handleReact(item.id, emoji)}
                      style={[styles.viberReactionBadge, { backgroundColor: 'rgba(36, 41, 46, 0.9)', paddingHorizontal: 8, paddingVertical: 4, height: 'auto', width: 'auto', borderRadius: 20 }]}
                    >
                      <Text style={{ fontSize: 16 }}>{emoji}</Text>
                      {item.reactions[emoji].length > 1 && (
                        <Text style={{ fontSize: 11, fontWeight: 'bold', marginLeft: 4, color: '#FFF' }}>{item.reactions[emoji].length}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

          </View>
        </Swipeable>
      );
    };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = String(item.sender_id) === String(currentUserId);
    const isSystemMessage = !item.sender_id || item.content?.includes('added __') || item.content?.includes('created the channel');
    const repliedMsg = item.reply_to_id ? (messages.find(m => m.id == item.reply_to_id) || null) : null;

    return <MessageItem item={item} isOwn={isOwn} isSystemMessage={isSystemMessage} repliedMsg={repliedMsg} />;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {selectedChat && themeConfig.isImage && (
          <Image source={themeConfig.bgImage} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        )}
        <SafeAreaView style={[styles.container, { backgroundColor: (selectedChat && themeConfig.isImage) ? 'transparent' : colors.background }]} edges={['top']}>
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
              <Reanimated.View style={[animatedStyle, { flex: 1 }]}>
                <FlatList
                  ListHeaderComponent={
                    teamMembers.length > 0 ? (
                      <View style={styles.teamSection}>
                        <Text style={[styles.teamSectionSub, { color: colors.subText }]}>Start a chat with your team by clicking their profile down below.</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamScroll}>
                          {teamMembers.map((member) => (
                            <TouchableOpacity
                              key={member.emp_id}
                              style={styles.teamMemberItem}
                              onPress={async () => {
                                try {
                                  if (!currentUserId || !member.log_id) return;
                                  const res = await fetch(`${getBackendUrl()}/create-conversation.php`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                                    body: JSON.stringify({
                                      creator_id: currentUserId,
                                      type: 'dm',
                                      name: `${currentUsername} & ${(member.name || 'User').split(' ')[0]}`,
                                      participant_ids: [currentUserId, member.log_id]
                                    })
                                  });
                                  const data = await res.json();
                                  if (data.ok) {
                                    loadConversations(false);
                                  }
                                } catch (e) {
                                  console.log('Failed to create DM', e);
                                }
                              }}
                            >
                              <UserAvatar
                                userId={member.log_id}
                                displayName={member.name}
                                size={56}
                                showOnline
                                isOnline={member.is_online === true}
                                backgroundColor="#F27121"
                                onlineDotBorderColor={colors.background}
                              />
                              <Text style={[styles.teamMemberName, { color: colors.text }]} numberOfLines={2}>
                                {(member.name || 'User').split(' ')[0]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ) : null
                  }
                  data={chatData.filter(c => c.name.toLowerCase().includes(searchText.toLowerCase()))}
                  renderItem={({ item }) => <ChatItem item={item} colorProps={colors} isDarkTheme={isDark} onLongPress={openChatOptions} onPress={(c) => { setSelectedChat(c); loadMessages(c.id); loadConversationMembers(c.id); }} />}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContent}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(false); }} />}
                />
              </Reanimated.View>
            </View>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
              style={{ flex: 1, backgroundColor: themeConfig.listBg }}
            >
              <View style={[styles.header, { borderBottomColor: themeConfig.isImage ? 'transparent' : colors.border, paddingHorizontal: 15, backgroundColor: themeConfig.headerBg }]}>
                <TouchableOpacity onPress={() => { setSelectedChat(null); setMessages([]); }}><Ionicons name="chevron-back" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
                <Pressable onPress={() => setShowChatInfoModal(true)} style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.headerTitle, { color: themeConfig.isImage ? '#FFF' : colors.text }]} numberOfLines={1}>{selectedChat.name}</Text>
                  <Text style={{ color: themeConfig.subText, fontSize: 10 }}>{selectedChat.type === 'dm' ? 'Personal Chat' : 'Group'}</Text>
                </Pressable>
                <TouchableOpacity onPress={() => setShowThemeModal(true)} style={{ marginRight: 15 }}>
                  <Ionicons name="color-palette" size={24} color={themeConfig.ownBubble} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddMemberModal(true)} style={{ marginRight: 15 }}><Ionicons name="person-add" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setShowChatInfoModal(true)}><Ionicons name="information-circle" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
              </View>

              {messages.filter(m => m.is_pinned).length > 0 && (
                <View style={[styles.pinnedBanner, { backgroundColor: themeConfig.isImage ? 'rgba(0,0,0,0.3)' : (isDark ? '#1A1A1A' : '#F0F0F0') }]}>
                  <Ionicons name="pin" size={16} color={themeConfig.ownBubble} />
                  <Text style={{ color: themeConfig.isImage ? '#FFF' : colors.text, marginLeft: 10, flex: 1, fontSize: 13 }} numberOfLines={1}>
                    {messages.filter(m => m.is_pinned).slice(-1)[0].content || 'Pinned Message'}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <FlatList
                  ref={flatListRef}
                  inverted
                  data={selectedChat?.type === 'channel' ? messages.filter(m => !m.reply_to_id) : messages}
                  renderItem={renderMessage}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: 20 }}
                />
              </View>

              {replyingTo && (
                <View style={[styles.replyBanner, { backgroundColor: themeConfig.isImage ? 'rgba(0,0,0,0.3)' : (isDark ? '#2C2C2E' : '#EAEAEA'), borderLeftColor: themeConfig.ownBubble }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: themeConfig.ownBubble, fontSize: 12, fontWeight: 'bold' }}>Replying to {replyingTo.sender?.username || 'User'}</Text>
                    <Text style={{ color: colors.subText, fontSize: 13 }} numberOfLines={1}>{replyingTo.content || 'Attachment'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 5 }}>
                    <Ionicons name="close" size={20} color={themeConfig.subText} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.inputContainer, { borderTopColor: themeConfig.isImage ? 'transparent' : colors.border, backgroundColor: themeConfig.headerBg }]}>
                <View style={styles.leftIcons}>
                  <TouchableOpacity style={styles.messengerIconBtn} onPress={() => pickMedia('file')}><Ionicons name="add-circle" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
                  <TouchableOpacity style={styles.messengerIconBtn} onPress={async () => {
                    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
                    if (!result.canceled) handleMediaUpload(result.assets[0].uri, result.assets[0].fileName || `cam_${Date.now()}`, 'image');
                  }}><Ionicons name="camera" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
                  <TouchableOpacity style={styles.messengerIconBtn} onPress={() => pickMedia('image')}><Ionicons name="image" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
                </View>

                <View style={[styles.messengerInputWrapper, { backgroundColor: themeConfig.inputBg }]}>
                  <TextInput
                    style={[styles.messageInput, { color: themeConfig.isImage ? '#FFF' : colors.text }]}
                    placeholder="Message..."
                    placeholderTextColor={themeConfig.subText}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                  />
                  <TouchableOpacity style={{ padding: 4 }} onPress={() => toggleEmojiPicker(true)}><Ionicons name="happy-outline" size={22} color={themeConfig.ownBubble} /></TouchableOpacity>
                </View>

                <View style={{ marginLeft: 5 }}>
                  {isSending ? (
                    <ActivityIndicator size="small" color={themeConfig.ownBubble} />
                  ) : (
                    newMessage.trim().length > 0 ? (
                      <TouchableOpacity style={styles.sendBtn} onPress={() => handleSendMessage()}><Ionicons name="send" size={24} color={themeConfig.ownBubble} /></TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.sendBtn} onPress={() => handleSendMessage('❤️')}><Ionicons name="heart" size={28} color={themeConfig.ownBubble} /></TouchableOpacity>
                    )
                  )}
                </View>
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

          {/* Message Options Sheet */}
          <Modal visible={showMessageOptions} transparent animationType="fade" onRequestClose={closeMsgOptions}>
            <Pressable style={styles.sheetOverlay} onPress={closeMsgOptions}>
              <Animated.View style={[styles.sheetContent, { backgroundColor: 'transparent', transform: [{ translateY: msgOptionsSlideAnim }] }]}>
                {longPressedMsg && !longPressedMsg.is_deleted && (
                  <View style={{ paddingHorizontal: 20 }}>
                    {/* Viber Style Reaction Bar */}
                    <View style={[styles.viberReactionRow, { backgroundColor: isDark ? '#2C2C2E' : '#FFF' }]}>
                      {['💜', '😂', '😮', '😢', '😡', '👍'].map(emoji => (
                        <TouchableOpacity key={emoji} onPress={() => { handleReact(longPressedMsg.id, emoji); closeMsgOptions(); }} style={styles.viberEmojiBtn}>
                          <Text style={{ fontSize: 24 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={styles.viberEmojiBtn}><Ionicons name="add-circle-outline" size={26} color={colors.subText} /></TouchableOpacity>
                    </View>

                    {/* Viber Style Vertical Menu */}
                    <View style={[styles.viberMenuContainer, { backgroundColor: isDark ? '#2C2C2E' : '#FFF' }]}>
                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => { setReplyingTo(longPressedMsg); closeMsgOptions(); }}>
                        <Ionicons name="arrow-undo" size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>Reply</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => handleReplyPrivately(longPressedMsg)}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>Reply privately</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => { closeMsgOptions(); showAlert({ type: 'info', title: 'Message Info', message: `Sent at: ${new Date(longPressedMsg.created_at).toLocaleString()}` }); }}>
                        <Ionicons name="information-circle-outline" size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>Info</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => { handleCopyText(longPressedMsg.content || ''); closeMsgOptions(); }}>
                        <Ionicons name="copy-outline" size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>Copy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => { setMsgToForward(longPressedMsg); setShowForwardModal(true); closeMsgOptions(); }}>
                        <Ionicons name="arrow-redo-outline" size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>Forward</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => { closeMsgOptions(); showAlert({ type: 'info', title: 'Translate', message: 'Translation feature coming soon!' }); }}>
                        <Ionicons name="language-outline" size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>Translate</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.viberMenuOption} onPress={() => { handlePin(longPressedMsg.id, !longPressedMsg.is_pinned); closeMsgOptions(); }}>
                        <Ionicons name={longPressedMsg.is_pinned ? "pin-outline" : "pin"} size={22} color={colors.text} />
                        <Text style={[styles.viberMenuText, { color: colors.text }]}>{longPressedMsg.is_pinned ? 'Unpin' : 'Pin'}</Text>
                      </TouchableOpacity>

                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 5, opacity: 0.5 }} />

                      {String(longPressedMsg.sender_id) === String(currentUserId) && (
                        <TouchableOpacity style={styles.viberMenuOption} onPress={() => { handleDeleteMsg(longPressedMsg.id); closeMsgOptions(); }}>
                          <Ionicons name="trash-outline" size={22} color="#ff3b30" />
                          <Text style={[styles.viberMenuText, { color: '#ff3b30' }]}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </Animated.View>
            </Pressable>
          </Modal>

          {/* Forward Modal */}
          <Modal visible={showForwardModal} animationType="slide" onRequestClose={() => setShowForwardModal(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setShowForwardModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Forward To...</Text>
              </View>
              <FlatList
                data={chatData}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleForward(item)} style={[styles.chatItem, { borderBottomColor: colors.border }]}>
                    <UserAvatar displayName={item.name} size={40} />
                    <Text style={[styles.chatName, { color: colors.text, marginLeft: 12 }]}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={item => item.id}
              />
            </SafeAreaView>
          </Modal>

          {/* Theme Picker Modal */}
          <Modal visible={showThemeModal} transparent animationType="slide" onRequestClose={() => setShowThemeModal(false)}>
            <Pressable style={styles.sheetOverlay} onPress={() => setShowThemeModal(false)}>
              <View style={[styles.sheetContent, { backgroundColor: colors.card, paddingBottom: 50 }]}>
                <View style={styles.sheetHandle} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 20 }}>Select Chat Theme</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}>
                  <TouchableOpacity onPress={() => handleSelectTheme(null)} style={[styles.themeOption, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                    <Text style={{ color: colors.text, fontSize: 12 }}>Default</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectTheme('midnight')} style={[styles.themeOption, { backgroundColor: '#0F172A' }]}>
                    <Text style={{ color: '#FFF', fontSize: 12 }}>Midnight</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectTheme('abstract_1')} style={styles.themeOption}>
                    <Image source={require('../../assets/images/download (10).jpg')} style={styles.themeOptionImg} />
                    <Text style={styles.themeLabel}>Abstract 1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectTheme('abstract_2')} style={styles.themeOption}>
                    <Image source={require('../../assets/images/download (11).jpg')} style={styles.themeOptionImg} />
                    <Text style={styles.themeLabel}>Abstract 2</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          {/* Thread Modal */}
          <Modal visible={showThreadModal} animationType="slide" onRequestClose={() => setShowThreadModal(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={[styles.header, { 
                borderBottomColor: colors.border, 
                backgroundColor: themeConfig.isImage ? '#1A1A1A' : themeConfig.ownBubble,
                paddingTop: Platform.OS === 'ios' ? 0 : 10
              }]}>
                <TouchableOpacity onPress={() => setShowThreadModal(false)}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                <View style={{ marginLeft: 15 }}>
                  <Text style={[styles.headerTitle, { color: '#FFF' }]}>Comments</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                    {currentThreadParent?.sender?.username || 'Post'}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
              </View>

              <FlatList
                data={threadMessages}
                ListHeaderComponent={() => currentThreadParent ? (
                  <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: isDark ? '#1A1A1A' : '#F9F9F9' }}>
                    <Text style={{ color: colors.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Parent Message</Text>
                    <MessageItem item={currentThreadParent} isOwn={String(currentThreadParent.sender_id) === String(currentUserId)} isSystemMessage={false} repliedMsg={null} isThread={true} />
                  </View>
                ) : null}
                renderItem={({ item }) => {
                  const isOwn = String(item.sender_id) === String(currentUserId);
                  return <MessageItem item={item} isOwn={isOwn} isSystemMessage={false} repliedMsg={null} isThread={true} />;
                }}
                ListEmptyComponent={() => loadingThread ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={themeConfig.ownBubble} />
                    <Text style={{ marginTop: 15, color: colors.subText, fontSize: 13 }}>Loading discussion...</Text>
                  </View>
                ) : (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
                    <Text style={{ marginTop: 15, color: colors.subText, fontSize: 13 }}>No comments yet. Start the discussion!</Text>
                  </View>
                )}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
              />

              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  paddingHorizontal: 15, 
                  paddingVertical: 12, 
                  borderTopWidth: 1, 
                  borderTopColor: colors.border,
                  backgroundColor: colors.background
                }}>
                  <View style={{ 
                    flex: 1, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', 
                    borderRadius: 24, 
                    paddingHorizontal: 15,
                    paddingVertical: 8
                  }}>
                    <TextInput
                      style={{ flex: 1, color: colors.text, fontSize: 15, maxHeight: 100 }}
                      placeholder="Write a comment..."
                      placeholderTextColor={colors.subText}
                      value={newThreadMessage}
                      onChangeText={setNewThreadMessage}
                      multiline
                    />
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!newThreadMessage.trim() || !currentThreadParent) return;
                      const content = newThreadMessage;
                      setNewThreadMessage('');
                      setReplyingTo(currentThreadParent);
                      setNewMessage(content);
                      setTimeout(() => {
                        handleSendMessage(content, null, null, currentThreadParent.id);
                        setShowThreadModal(false);
                      }, 50);
                    }}
                    style={{ 
                      marginLeft: 12, 
                      backgroundColor: themeConfig.ownBubble, 
                      width: 40, 
                      height: 40, 
                      borderRadius: 20, 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      elevation: 2,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2
                    }}
                  >
                    <Ionicons name="send" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </Modal>

      {/* Chat Info Modal (Messenger Style) */}
      <Modal visible={showChatInfoModal} transparent animationType="slide" onRequestClose={() => setShowChatInfoModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15 }}>
              <TouchableOpacity onPress={() => setShowChatInfoModal(false)}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity><Ionicons name="ellipsis-vertical" size={20} color={colors.text} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <UserAvatar displayName={selectedChat?.name || 'Chat'} size={100} backgroundColor="#F27121" />
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginTop: 15 }}>{selectedChat?.name}</Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 30 }}>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => showAlert({ type: 'info', title: 'Profile', message: 'Profile viewing coming soon!' })}>
                  <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 5 }}><Ionicons name="person-circle" size={22} color={colors.text} /></View>
                  <Text style={{ fontSize: 11, color: colors.text }}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => showAlert({ type: 'info', title: 'Nicknames', message: 'Nickname customization coming soon!' })}>
                  <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 5 }}><Ionicons name="text" size={22} color={colors.text} /></View>
                  <Text style={{ fontSize: 11, color: colors.text }}>Nicknames</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setShowChatInfoModal(false)}>
                  <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 5 }}><Ionicons name="search" size={22} color={colors.text} /></View>
                  <Text style={{ fontSize: 11, color: colors.text }}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => { setShowChatInfoModal(false); setShowThemeModal(true); }}>
                  <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 5 }}><Ionicons name="color-palette" size={22} color={colors.text} /></View>
                  <Text style={{ fontSize: 11, color: colors.text }}>Customise</Text>
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: colors.subText, fontSize: 13, fontWeight: 'bold', marginBottom: 15 }}>Chat info</Text>
                
                <TouchableOpacity onPress={() => setShowMediaGallery(true)} style={{ flexDirection: 'row', gap: 2, marginBottom: 20, height: 120 }}>
                  {messages.filter(m => m.media_type === 'image').length > 0 ? (
                    messages.filter(m => m.media_type === 'image').slice(0, 3).map((m, i) => (
                      <View key={i} style={{ flex: i === 0 ? 2 : 1, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', borderRadius: 8, overflow: 'hidden', marginRight: i < 2 ? 2 : 0 }}>
                        <Image source={{ uri: m.media_url }} style={{ width: '100%', height: '100%' }} />
                      </View>
                    ))
                  ) : (
                    <View style={{ flex: 1, backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="images-outline" size={32} color={colors.subText} />
                      <Text style={{ color: colors.subText, fontSize: 12, marginTop: 5 }}>No media shared yet</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} onPress={() => setShowMediaGallery(true)}>
                  <Ionicons name="images" size={22} color={colors.text} style={{ width: 40 }} />
                  <Text style={{ fontSize: 15, color: colors.text }}>View all media, files and links</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} onPress={() => setShowPinnedModal(true)}>
                  <Ionicons name="pin" size={22} color={colors.text} style={{ width: 40 }} />
                  <Text style={{ fontSize: 15, color: colors.text }}>Pinned messages</Text>
                </TouchableOpacity>

                <Text style={{ color: colors.subText, fontSize: 13, fontWeight: 'bold', marginVertical: 15 }}>Actions</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} onPress={() => { setShowChatInfoModal(false); setShowAddMemberModal(true); }}>
                  <Ionicons name="people" size={22} color={colors.text} style={{ width: 40 }} />
                  <Text style={{ fontSize: 15, color: colors.text }}>Add members</Text>
                </TouchableOpacity>

                <Text style={{ color: colors.subText, fontSize: 13, fontWeight: 'bold', marginVertical: 15 }}>Members ({currentConversationMembers.length})</Text>
                {loadingMembers ? (
                  <ActivityIndicator size="small" color="#F27121" />
                ) : (
                  currentConversationMembers.map((member, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                      <UserAvatar displayName={member.username} size={36} />
                      <Text style={{ marginLeft: 12, fontSize: 15, color: colors.text }}>{member.username}</Text>
                      {String(member.user_id) === String(currentUserId) && <Text style={{ color: colors.subText, fontSize: 12, marginLeft: 5 }}>(You)</Text>}
                    </View>
                  ))
                )}

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} onPress={() => showAlert({ type: 'info', title: 'Auto-save', message: 'Auto-save photos coming soon!' })}>
                  <Ionicons name="download" size={22} color={colors.text} style={{ width: 40 }} />
                  <Text style={{ fontSize: 15, color: colors.text }}>Auto-save photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} onPress={() => showAlert({ type: 'info', title: 'Share', message: 'Share contact coming soon!' })}>
                  <Ionicons name="share-social" size={22} color={colors.text} style={{ width: 40 }} />
                  <Text style={{ fontSize: 15, color: colors.text }}>Share contact</Text>
                </TouchableOpacity>

                <Text style={{ color: colors.subText, fontSize: 13, fontWeight: 'bold', marginVertical: 15 }}>Privacy & support</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }}>
                  <Ionicons name="lock-closed" size={22} color={colors.text} style={{ width: 40 }} />
                  <View>
                    <Text style={{ fontSize: 15, color: colors.text }}>End-to-end encryption</Text>
                    <Text style={{ fontSize: 12, color: colors.subText }}>This chat is end-to-end encrypted</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} onPress={handleDeleteChat}>
                  <Ionicons name="trash" size={22} color="#FF3B30" style={{ width: 40 }} />
                  <Text style={{ fontSize: 15, color: '#FF3B30' }}>Delete chat</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 50 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Media Gallery Modal */}
      <Modal visible={showMediaGallery} animationType="slide" onRequestClose={() => setShowMediaGallery(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowMediaGallery(false)}><Ionicons name="close" size={28} color={colors.text} /></TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text }}>Media & Files</Text>
              <View style={{ width: 28 }} />
            </View>
            <FlatList
              data={messages.filter(m => m.media_url)}
              numColumns={3}
              renderItem={({ item }) => (
                <TouchableOpacity style={{ width: '33.33%', aspectRatio: 1, padding: 1 }} onPress={() => { if (item.media_type === 'image') { setSelectedImageUrl(item.media_url!); setShowImageViewer(true); } }}>
                  {item.media_type === 'image' ? (
                    <Image source={{ uri: item.media_url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View style={{ width: '100%', height: '100%', backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="document-attach" size={32} color={colors.subText} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={item => item.id}
              ListEmptyComponent={<View style={{ padding: 50, alignItems: 'center' }}><Ionicons name="images-outline" size={48} color={colors.subText} /><Text style={{ color: colors.subText, marginTop: 10 }}>No media shared yet</Text></View>}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Pinned Messages Modal */}
      <Modal visible={showPinnedModal} animationType="slide" onRequestClose={() => setShowPinnedModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowPinnedModal(false)}><Ionicons name="close" size={28} color={colors.text} /></TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text }}>Pinned Messages</Text>
              <View style={{ width: 28 }} />
            </View>
            <FlatList
              data={messages.filter(m => m.is_pinned)}
              renderItem={({ item }) => (
                <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 5 }}>{item.sender?.username}</Text>
                  <Text style={{ color: colors.text }}>{item.content || '[Attachment]'}</Text>
                </View>
              )}
              keyExtractor={item => item.id}
              ListEmptyComponent={<View style={{ padding: 50, alignItems: 'center' }}><Ionicons name="pin-outline" size={48} color={colors.subText} /><Text style={{ color: colors.subText, marginTop: 10 }}>No pinned messages</Text></View>}
            />
          </SafeAreaView>
        </View>
      </Modal>

          {/* Emoji Picker Modal */}
          <Modal visible={showEmojiPicker} transparent animationType="none" onRequestClose={() => toggleEmojiPicker(false)}>
            <Pressable style={styles.sheetOverlay} onPress={() => toggleEmojiPicker(false)} />
            <Animated.View style={[styles.sheetContent, { transform: [{ translateY: emojiSlideAnim }], height: 400, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', position: 'absolute', bottom: 0, left: 0, right: 0 }]}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Emojis</Text>
              </View>
              <ScrollView contentContainerStyle={{ padding: 15, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {emojiList.map((emoji, index) => (
                  <TouchableOpacity key={index} style={{ width: '14%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }} onPress={() => handleEmojiSelect(emoji)}>
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </Modal>

          {/* New Chat / Group Modal */}
          <Modal visible={showNewChatModal} animationType="slide" onRequestClose={() => setShowNewChatModal(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowNewChatModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>New Group</Text>
                <TouchableOpacity onPress={handleCreateGroup}><Text style={{ color: '#F27121', fontWeight: 'bold' }}>Create</Text></TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0', padding: 15, borderRadius: 12, color: colors.text, marginBottom: 20 }]}
                  placeholder="Group Name"
                  placeholderTextColor={colors.subText}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                />
                <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 10 }}>Select Members</Text>
                <View style={[styles.searchContainer, { backgroundColor: isDark ? '#2C2C2E' : '#EAEAEA', marginHorizontal: 0, marginBottom: 15 }]}>
                  <Ionicons name="search" size={20} color={colors.subText} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search people..."
                    placeholderTextColor={colors.subText}
                    value={searchAccountText}
                    onChangeText={(t) => { setSearchAccountText(t); searchAccounts(t); }}
                  />
                </View>
              </View>
              <FlatList
                data={searchAccountText ? searchedAccounts : teamMembers}
                keyExtractor={(item) => String(item.log_id || item.emp_id)}
                renderItem={({ item }) => {
                  const id = String(item.log_id || item.emp_id);
                  const isSelected = selectedParticipants.includes(id);
                  if (id === currentUserId) return null;
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedParticipants(prev => isSelected ? prev.filter(p => p !== id) : [...prev, id])}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <UserAvatar displayName={item.name || item.username} size={40} />
                      <Text style={{ flex: 1, marginLeft: 15, color: colors.text }}>{item.name || item.username}</Text>
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? "#F27121" : colors.subText} />
                    </TouchableOpacity>
                  );
                }}
              />
            </SafeAreaView>
          </Modal>

          {/* Add Member Modal */}
          <Modal visible={showAddMemberModal} animationType="slide" onRequestClose={() => setShowAddMemberModal(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowAddMemberModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Add Member</Text>
                <View style={{ width: 24 }} />
              </View>
              <View style={{ padding: 20 }}>
                <View style={[styles.searchContainer, { backgroundColor: isDark ? '#2C2C2E' : '#EAEAEA', marginHorizontal: 0, marginBottom: 15 }]}>
                  <Ionicons name="search" size={20} color={colors.subText} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search people..."
                    placeholderTextColor={colors.subText}
                    value={searchAccountText}
                    onChangeText={(t) => { setSearchAccountText(t); searchAccounts(t); }}
                  />
                </View>
              </View>
              <FlatList
                data={searchAccountText ? searchedAccounts : teamMembers}
                keyExtractor={(item) => String(item.log_id || item.emp_id)}
                renderItem={({ item }) => {
                  const id = String(item.log_id || item.emp_id);
                  const isAlreadyIn = currentConversationMembers.some(m => String(m.user_id) === id);
                  if (id === currentUserId) return null;
                  return (
                    <TouchableOpacity
                      disabled={isAlreadyIn}
                      onPress={() => { handleAddMember(id); setShowAddMemberModal(false); }}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: isAlreadyIn ? 0.5 : 1 }}
                    >
                      <UserAvatar displayName={item.name || item.username} size={40} />
                      <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={{ color: colors.text }}>{item.name || item.username}</Text>
                        {isAlreadyIn && <Text style={{ color: colors.subText, fontSize: 11 }}>Already in group</Text>}
                      </View>
                      {!isAlreadyIn && <Ionicons name="add-circle" size={24} color="#F27121" />}
                    </TouchableOpacity>
                  );
                }}
              />
            </SafeAreaView>
          </Modal>

          <CustomAlert visible={visible} type={config.type} title={config.title} message={config.message} buttonText={config.buttonText} onClose={hideAlert} />
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 20, paddingHorizontal: 15, borderRadius: 16, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1 },
  teamSection: { paddingHorizontal: 20, paddingBottom: 15 },
  teamSectionSub: { fontSize: 13, marginBottom: 15 },
  teamScroll: { paddingRight: 20, gap: 15 },
  teamMemberItem: { alignItems: 'center', width: 64 },
  teamMemberName: { fontSize: 12, marginTop: 6, textAlign: 'center' },
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
  unreadBadge: { backgroundColor: '#F27121', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  messageItemContainer: { marginBottom: 15, maxWidth: '75%', alignSelf: 'flex-start' },
  ownMessageContainer: { alignSelf: 'flex-end' },
  systemMessageContainer: { alignSelf: 'center', maxWidth: '100%', marginVertical: 8, alignItems: 'center' },
  systemMessageBubble: { backgroundColor: 'transparent' },
  systemMessageText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  senderName: { fontSize: 12, marginBottom: 4, marginLeft: 12 },
  messageBubble: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' },
  ownMessageBubble: { backgroundColor: '#F27121', borderBottomRightRadius: 8 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  mediaContainer: { marginBottom: 8, borderRadius: 16, overflow: 'hidden' },
  messageImage: { width: 220, height: 160, borderRadius: 16 },
  fileContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, paddingBottom: Platform.OS === 'ios' ? 10 : 5 },
  leftIcons: { flexDirection: 'row', alignItems: 'center', marginRight: 5 },
  messengerIconBtn: { padding: 6 },
  messengerInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, minHeight: 38, maxHeight: 100 },
  messageInput: { flex: 1, fontSize: 16, paddingVertical: 8, marginRight: 5 },
  sendBtn: { padding: 4 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40 },
  sheetHeader: { alignItems: 'center', paddingBottom: 15 },
  sheetTitle: { fontSize: 16, fontWeight: 'bold' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', margin: 10 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  replyPreview: { padding: 8, borderRadius: 8, borderLeftWidth: 4, marginBottom: 5 },
  replyPreviewName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  replyPreviewText: { fontSize: 12 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderLeftWidth: 4 },
  reactionContainer: { flexDirection: 'row', gap: -8 },
  viberReactionBadge: { 
    minWidth: 36, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: '#24292E', 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'row',
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 15 },
  viberReactionRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, borderRadius: 30, marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  viberEmojiBtn: { padding: 5 },
  viberMenuContainer: { borderRadius: 24, paddingVertical: 10, paddingHorizontal: 5, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  viberMenuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  viberMenuText: { fontSize: 16, marginLeft: 15 },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  themeOption: { width: 80, height: 120, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  themeOptionImg: { ...StyleSheet.absoluteFillObject },
  themeLabel: { position: 'absolute', bottom: 5, backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFF', fontSize: 10, paddingHorizontal: 5, borderRadius: 5 }
});