import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { PHP_BACKEND_URL } from '../../constants/backend-config';
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
};

type Account = {
  log_id: string;
  username: string;
};

export default function UserChat() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';
  const [searchText, setSearchText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  
  // Chat list state
  const [chatData, setChatData] = useState<ChatData[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  
  // Conversation view state
  const [selectedChat, setSelectedChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // New conversation modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatType, setNewChatType] = useState<'channel' | 'dm'>('channel');
  const [newChatName, setNewChatName] = useState('');
  const [accountSuggestions, setAccountSuggestions] = useState<Account[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  
  // Add member modal state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearchText, setMemberSearchText] = useState('');
  const [memberSuggestions, setMemberSuggestions] = useState<Account[]>([]);
  const [loadingMemberSuggestions, setLoadingMemberSuggestions] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  
  // Chat info modal state
  const [showChatInfoModal, setShowChatInfoModal] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const searchTimeoutRef = useRef<any>(null);
  const memberSearchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadConversations();
    }
  }, [currentUserId]);

  const loadUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const username = await AsyncStorage.getItem('username');
      setCurrentUserId(userId);
      setCurrentUsername(username || 'User');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadConversations = async () => {
    if (!currentUserId) return;
    
    try {
      setLoadingChats(true);
      const response = await fetch(`${PHP_BACKEND_URL}/get-conversations.php?user_id=${currentUserId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const result = await response.json();
      
      if (result.ok) {
        // Format the data to match ChatData type
        const formattedChats = result.conversations.map((conv: any) => ({
          id: conv.id,
          type: conv.type,
          name: conv.name,
          last_message: conv.last_message || 'No messages yet',
          last_message_time: formatTime(conv.last_message_time),
          unread_count: conv.unread_count || 0,
          online: Math.random() > 0.5 // Mock online status
        }));
        setChatData(formattedChats);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Use mock data if API fails
      setChatData([
        { id: '1', type: 'channel', name: '# announcements', last_message: 'HR: Please update your 201 files.', last_message_time: '10:30 AM', unread_count: 2 },
        { id: '2', type: 'channel', name: '# it-support', last_message: 'You: Server is back online.', last_message_time: 'Yesterday', unread_count: 0 },
        { id: '3', type: 'dm', name: 'Supervisor', last_message: 'Great job on the pitch deck!', last_message_time: 'Yesterday', unread_count: 0, online: true },
        { id: '4', type: 'dm', name: 'HR Manager', last_message: 'Sent the form. Thanks.', last_message_time: 'Mon', unread_count: 0, online: false },
        { id: '5', type: 'dm', name: 'John Doe (Intern)', last_message: 'Can you help me with React?', last_message_time: 'Mon', unread_count: 1, online: true },
      ]);
    } finally {
      setLoadingChats(false);
    }
  };

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const response = await fetch(`${PHP_BACKEND_URL}/get-messages.php?conversation_id=${conversationId}&limit=50`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const result = await response.json();
      
      if (result.ok) {
        setMessages(result.messages);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      // Mock messages for testing
      setMessages([
        { 
          id: '1', 
          conversation_id: conversationId, 
          sender_id: '999', 
          content: 'Hello! How can I help you?', 
          created_at: new Date().toISOString(),
          sender: { log_id: '999', username: 'System' }
        },
        { 
          id: '2', 
          conversation_id: conversationId, 
          sender_id: currentUserId || '1', 
          content: 'Hi there!', 
          created_at: new Date().toISOString(),
          sender: { log_id: currentUserId || '1', username: currentUsername }
        }
      ]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleChatPress = (chat: ChatData) => {
    setSelectedChat(chat);
    loadMessages(chat.id);
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    setMessages([]);
    setMessageText('');
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !currentUserId) return;
    
    try {
      setSendingMessage(true);
      const response = await fetch(`${PHP_BACKEND_URL}/send-message.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          conversation_id: selectedChat.id,
          sender_id: currentUserId,
          content: messageText.trim()
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        // Add message to local state immediately
        const newMessage: Message = {
          id: result.data.id || Date.now().toString(),
          conversation_id: selectedChat.id,
          sender_id: currentUserId,
          content: messageText.trim(),
          created_at: new Date().toISOString(),
          sender: { log_id: currentUserId, username: currentUsername }
        };
        
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Still add message locally for demo
      const newMessage: Message = {
        id: Date.now().toString(),
        conversation_id: selectedChat.id,
        sender_id: currentUserId,
        content: messageText.trim(),
        created_at: new Date().toISOString(),
        sender: { log_id: currentUserId, username: currentUsername }
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateNewChat = () => {
    setShowNewChatModal(true);
    setNewChatName('');
    setSelectedAccount(null);
    setAccountSuggestions([]);
  };

  const searchAccounts = async (query: string) => {
    if (!query.trim() || newChatType !== 'dm') {
      setAccountSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);
      const response = await fetch(
        `${PHP_BACKEND_URL}/search-accounts.php?query=${encodeURIComponent(query)}&current_user_id=${currentUserId}&limit=10`
      );
      const result = await response.json();
      
      if (result.ok) {
        setAccountSuggestions(result.accounts || []);
      }
    } catch (error) {
      console.error('Error searching accounts:', error);
      setAccountSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearchInputChange = (text: string) => {
    setNewChatName(text);
    setSelectedAccount(null);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search - wait 300ms after user stops typing
    if (newChatType === 'dm' && text.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchAccounts(text);
      }, 300);
    } else {
      setAccountSuggestions([]);
    }
  };

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setNewChatName(account.username);
    setAccountSuggestions([]);
  };

  const handleCreateConversation = async () => {
    if (newChatType === 'dm') {
      // For DM, must select an account
      if (!selectedAccount) {
        showAlert({ type: 'error', title: 'Error', message: 'Please select a user from the suggestions' });
        return;
      }
    } else {
      // For channel, just need a name
      if (!newChatName.trim()) {
        showAlert({ type: 'error', title: 'Error', message: 'Please enter a channel name' });
        return;
      }
    }

    if (!currentUserId) {
      showAlert({ type: 'error', title: 'Error', message: 'User not logged in' });
      return;
    }

    try {
      // Prepare participant IDs
      const participantIds = [currentUserId];
      if (newChatType === 'dm' && selectedAccount) {
        participantIds.push(selectedAccount.log_id);
      }

      // Create conversation via API
      const response = await fetch(`${PHP_BACKEND_URL}/create-conversation.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          creator_id: currentUserId,
          type: newChatType,
          name: newChatType === 'channel' ? newChatName : newChatName,
          participant_ids: participantIds
        })
      });

      const result = await response.json();

      if (result.ok && result.conversation) {
        // Create local representation
        const newConversation: ChatData = {
          id: result.conversation.id,
          type: result.conversation.type,
          name: newChatType === 'channel' ? `# ${result.conversation.name}` : result.conversation.name,
          last_message: 'No messages yet',
          last_message_time: 'Now',
          unread_count: 0,
          online: newChatType === 'dm' ? Math.random() > 0.5 : undefined
        };

        setChatData(prev => [newConversation, ...prev]);
        setShowNewChatModal(false);
        setNewChatName('');
        setSelectedAccount(null);
        setAccountSuggestions([]);
        setNewChatType('channel');
        
        showAlert({ type: 'success', title: 'Success', message: 'Conversation created! Tap to start chatting.' });
      } else {
        showAlert({ type: 'error', title: 'Error', message: result.message || 'Failed to create conversation' });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to create conversation. Please check your connection.' });
    }
  };

  const handleAttachment = () => {
    showAlert({
      type: 'info',
      title: 'Attachments',
      message: 'Choose attachment type: Photo/Video or Document',
      hint: 'This feature is coming soon!'
    });
  };

  const handleConversationInfo = () => {
    if (!selectedChat) return;
    setShowChatInfoModal(true);
  };

  const searchMembersToAdd = async (query: string) => {
    if (!query.trim()) {
      setMemberSuggestions([]);
      return;
    }

    try {
      setLoadingMemberSuggestions(true);
      const response = await fetch(
        `${PHP_BACKEND_URL}/search-accounts.php?query=${encodeURIComponent(query)}&current_user_id=${currentUserId}&limit=10`
      );
      const result = await response.json();
      
      if (result.ok) {
        setMemberSuggestions(result.accounts || []);
      }
    } catch (error) {
      console.error('Error searching members:', error);
      setMemberSuggestions([]);
    } finally {
      setLoadingMemberSuggestions(false);
    }
  };

  const handleMemberSearchInputChange = (text: string) => {
    setMemberSearchText(text);
    
    if (memberSearchTimeoutRef.current) {
      clearTimeout(memberSearchTimeoutRef.current);
    }
    
    if (text.trim()) {
      memberSearchTimeoutRef.current = setTimeout(() => {
        searchMembersToAdd(text);
      }, 300);
    } else {
      setMemberSuggestions([]);
    }
  };

  const handleAddMemberToChannel = async (account: Account) => {
    if (!selectedChat || selectedChat.type !== 'channel') return;

    try {
      setAddingMember(true);
      const response = await fetch(`${PHP_BACKEND_URL}/add-conversation-member.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          conversation_id: selectedChat.id,
          user_id: account.log_id
        })
      });

      const result = await response.json();

      if (result.ok) {
        showAlert({ type: 'success', title: 'Success', message: `${account.username} has been added to ${selectedChat.name}` });
        setShowAddMemberModal(false);
        setMemberSearchText('');
        setMemberSuggestions([]);
      } else {
        showAlert({ type: 'error', title: 'Error', message: result.message || 'Failed to add member' });
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to add member. Please check your connection.' });
    } finally {
      setAddingMember(false);
    }
  };

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    search: { backgroundColor: isDark ? '#252525' : '#E0E0E0', color: colors.text }
  };

  const renderChatItem = ({ item }: { item: ChatData }) => (
    <TouchableOpacity style={[styles.chatItem, dyn.bg]} onPress={() => handleChatPress(item)}>
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
      <View style={[styles.chatItemContent, dyn.border]}>
        <View style={styles.messageHeader}>
            <Text style={[styles.chatName, dyn.text]}>{item.name}</Text>
            <Text style={[styles.timeText, dyn.sub]}>{item.last_message_time}</Text>
        </View>
        <View style={styles.messageFooter}>
            <Text style={[styles.lastMessage, dyn.sub, item.unread_count > 0 && { color: colors.text, fontWeight: 'bold' }]} numberOfLines={1}>
                {item.last_message}
            </Text>
            {item.unread_count > 0 && (
                <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread_count}</Text></View>
            )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwnMessage = String(item.sender_id) === String(currentUserId);
    const senderName = item.sender?.username || 'Unknown';
    
    return (
      <View style={[styles.messageItemContainer, isOwnMessage && styles.ownMessageContainer]}>
        {!isOwnMessage && selectedChat?.type === 'channel' && (
          <Text style={[styles.senderName, dyn.sub]}>{senderName}</Text>
        )}
        <View style={[
          styles.messageBubble, 
          isOwnMessage ? styles.ownMessageBubble : [styles.otherMessageBubble, { backgroundColor: isDark ? '#2C2C2C' : '#E5E5EA' }]
        ]}>
          <Text style={[styles.messageContent, { color: isOwnMessage ? '#FFF' : colors.text }]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.subText }]}>
            {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // Conversation View
  if (selectedChat) {
    return (
      <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        
        <View style={[styles.header, dyn.border]}>
          <TouchableOpacity onPress={handleBackToList} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.conversationHeader}>
            <Text style={[styles.headerTitle, dyn.text]}>{selectedChat.name}</Text>
            {selectedChat.type === 'dm' && selectedChat.online && (
              <Text style={[styles.onlineStatus, { color: '#2ecc71' }]}>● Online</Text>
            )}
          </View>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={handleConversationInfo}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="information-circle" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.conversationContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F27121" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          <View style={[styles.messageInputContainer, dyn.border, { backgroundColor: isDark ? '#1C1C1C' : '#F5F5F5' }]}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
              <Ionicons name="add-circle-outline" size={28} color={colors.subText} />
            </TouchableOpacity>
            <TextInput
              style={[styles.messageInput, dyn.text]}
              placeholder="Type a message..."
              placeholderTextColor={colors.subText}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendBtn, (!messageText.trim() || sendingMessage) && styles.sendBtnDisabled]} 
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Chat Info Modal */}
        <Modal
          visible={showChatInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowChatInfoModal(false)}
        >
          <View style={styles.chatInfoOverlay}>
            <View style={[styles.chatInfoModal, dyn.bg]}>
              <View style={[styles.modalHeader, dyn.border]}>
                <Text style={[styles.modalTitle, dyn.text]}>Chat Information</Text>
                <TouchableOpacity onPress={() => setShowChatInfoModal(false)} style={styles.iconBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.chatInfoContent}>
                <View style={styles.chatInfoItem}>
                  <Ionicons name="chatbubbles" size={24} color="#F27121" />
                  <View style={styles.chatInfoTextContainer}>
                    <Text style={[styles.chatInfoLabel, dyn.sub]}>Chat Name</Text>
                    <Text style={[styles.chatInfoValue, dyn.text]}>{selectedChat?.name}</Text>
                  </View>
                </View>

                <View style={styles.chatInfoItem}>
                  <Ionicons name={selectedChat?.type === 'channel' ? 'people' : 'person'} size={24} color="#F27121" />
                  <View style={styles.chatInfoTextContainer}>
                    <Text style={[styles.chatInfoLabel, dyn.sub]}>Type</Text>
                    <Text style={[styles.chatInfoValue, dyn.text]}>
                      {selectedChat?.type === 'channel' ? 'Group Chat' : 'Direct Message'}
                    </Text>
                  </View>
                </View>

                {selectedChat?.type === 'dm' && (
                  <View style={styles.chatInfoItem}>
                    <Ionicons name="radio-button-on" size={24} color={selectedChat?.online ? '#2ecc71' : '#95a5a6'} />
                    <View style={styles.chatInfoTextContainer}>
                      <Text style={[styles.chatInfoLabel, dyn.sub]}>Status</Text>
                      <Text style={[styles.chatInfoValue, dyn.text]}>
                        {selectedChat?.online ? 'Active now' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Chat List View
  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Team Chat</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleCreateNewChat}>
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

      {loadingChats ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F27121" />
        </View>
      ) : (
        <FlatList
          data={chatData}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* New Conversation Modal */}
      <Modal
        visible={showNewChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dyn.card]}>
            <View style={[styles.modalHeader, dyn.border]}>
              <Text style={[styles.modalTitle, dyn.text]}>New Conversation</Text>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, dyn.text]}>Conversation Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newChatType === 'channel' && styles.typeButtonActive,
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setNewChatType('channel')}
                >
                  <Ionicons 
                    name="megaphone" 
                    size={24} 
                    color={newChatType === 'channel' ? '#F27121' : colors.subText} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    { color: newChatType === 'channel' ? '#F27121' : colors.text }
                  ]}>Channel</Text>
                  {newChatType === 'channel' && (
                    <Ionicons name="checkmark-circle" size={20} color="#F27121" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newChatType === 'dm' && styles.typeButtonActive,
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setNewChatType('dm')}
                >
                  <Ionicons 
                    name="person" 
                    size={24} 
                    color={newChatType === 'dm' ? '#F27121' : colors.subText} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    { color: newChatType === 'dm' ? '#F27121' : colors.text }
                  ]}>Direct Message</Text>
                  {newChatType === 'dm' && (
                    <Ionicons name="checkmark-circle" size={20} color="#F27121" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, dyn.text, { marginTop: 20 }]}>
                {newChatType === 'channel' ? 'Channel Name' : 'Search User'}
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, dyn.border, { color: colors.text, backgroundColor: isDark ? '#2C2C2C' : '#F5F5F5' }]}
                  placeholder={newChatType === 'channel' ? 'e.g., general, announcements' : 'Type username to search...'}
                  placeholderTextColor={colors.subText}
                  value={newChatName}
                  onChangeText={handleSearchInputChange}
                  autoCapitalize="none"
                  editable={newChatType === 'channel' || !selectedAccount}
                />
                {loadingSuggestions && newChatType === 'dm' && (
                  <ActivityIndicator 
                    size="small" 
                    color="#F27121" 
                    style={{ position: 'absolute', right: 15, top: 15 }} 
                  />
                )}
              </View>

              {/* Account Suggestions Dropdown */}
              {newChatType === 'dm' && accountSuggestions.length > 0 && (
                <View style={[styles.suggestionsContainer, dyn.card, dyn.border]}>
                  <Text style={[styles.suggestionsHeader, dyn.sub]}>
                    Select User ({accountSuggestions.length} found)
                  </Text>
                  {accountSuggestions.map((account) => (
                    <TouchableOpacity
                      key={account.log_id}
                      style={[styles.suggestionItem, dyn.border]}
                      onPress={() => handleSelectAccount(account)}
                    >
                      <View style={[styles.suggestionAvatar, { backgroundColor: '#F27121' }]}>
                        <Text style={styles.suggestionAvatarText}>
                          {account.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestionUsername, dyn.text]}>
                          {account.username}
                        </Text>
                        <Text style={[styles.suggestionId, dyn.sub]}>
                          ID: {account.log_id}
                        </Text>
                      </View>
                      <Ionicons name="person-add" size={20} color="#F27121" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected Account Indicator */}
              {selectedAccount && newChatType === 'dm' && (
                <View style={[styles.selectedAccountBanner, { backgroundColor: 'rgba(242, 113, 33, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#F27121" />
                  <Text style={[styles.selectedAccountText, { color: '#F27121' }]}>
                    Ready to chat with {selectedAccount.username}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setSelectedAccount(null);
                      setNewChatName('');
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="#F27121" />
                  </TouchableOpacity>
                </View>
              )}

              {/* No Results Message */}
              {newChatType === 'dm' && newChatName.trim() && !loadingSuggestions && accountSuggestions.length === 0 && !selectedAccount && (
                <View style={[styles.noResultsContainer, dyn.border]}>
                  <Ionicons name="search" size={32} color={colors.subText} />
                  <Text style={[styles.noResultsText, dyn.sub]}>
                    No users found matching "{newChatName}"
                  </Text>
                  <Text style={[styles.noResultsHint, dyn.sub]}>
                    Try a different username
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowNewChatModal(false);
                    setNewChatName('');
                  }}
                >
                  <Text style={[styles.cancelButtonText, dyn.text]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateConversation}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dyn.card]}>
            <View style={[styles.modalHeader, dyn.border]}>
              <Text style={[styles.modalTitle, dyn.text]}>Add Member to Channel</Text>
              <TouchableOpacity onPress={() => {
                setShowAddMemberModal(false);
                setMemberSearchText('');
                setMemberSuggestions([]);
              }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, dyn.text]}>Search User</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.input, dyn.border, { color: colors.text, backgroundColor: isDark ? '#2C2C2C' : '#F5F5F5' }]}
                  placeholder="Type username to search..."
                  placeholderTextColor={colors.subText}
                  value={memberSearchText}
                  onChangeText={handleMemberSearchInputChange}
                  autoCapitalize="none"
                />
                {loadingMemberSuggestions && (
                  <ActivityIndicator 
                    size="small" 
                    color="#F27121" 
                    style={{ position: 'absolute', right: 15, top: 15 }} 
                  />
                )}
              </View>

              {/* Member Suggestions */}
              {memberSuggestions.length > 0 && (
                <View style={[styles.suggestionsContainer, dyn.card, dyn.border]}>
                  <Text style={[styles.suggestionsHeader, dyn.sub]}>
                    Select Member ({memberSuggestions.length} found)
                  </Text>
                  {memberSuggestions.map((account) => (
                    <TouchableOpacity
                      key={account.log_id}
                      style={[styles.suggestionItem, dyn.border]}
                      onPress={() => handleAddMemberToChannel(account)}
                      disabled={addingMember}
                    >
                      <View style={[styles.suggestionAvatar, { backgroundColor: '#F27121' }]}>
                        <Text style={styles.suggestionAvatarText}>
                          {account.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestionUsername, dyn.text]}>
                          {account.username}
                        </Text>
                        <Text style={[styles.suggestionId, dyn.sub]}>
                          ID: {account.log_id}
                        </Text>
                      </View>
                      {addingMember ? (
                        <ActivityIndicator size="small" color="#F27121" />
                      ) : (
                        <Ionicons name="person-add" size={20} color="#F27121" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* No Results Message */}
              {memberSearchText.trim() && !loadingMemberSuggestions && memberSuggestions.length === 0 && (
                <View style={[styles.noResultsContainer, dyn.border]}>
                  <Ionicons name="search" size={32} color={colors.subText} />
                  <Text style={[styles.noResultsText, dyn.sub]}>
                    No users found matching "{memberSearchText}"
                  </Text>
                  <Text style={[styles.noResultsHint, dyn.sub]}>
                    Try a different username
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowAddMemberModal(false);
                    setMemberSearchText('');
                    setMemberSuggestions([]);
                  }}
                >
                  <Text style={[styles.cancelButtonText, dyn.text]}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={visible}
        type={config.type}
        title={config.title}
        message={config.message}
        hint={config.hint}
        buttonText={config.buttonText}
        onClose={hideAlert}
        backgroundColor={colors.card}
        textColor={colors.text}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 8, minWidth: 40, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 20, paddingHorizontal: 15, borderRadius: 10, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1 },
  listContent: { paddingHorizontal: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  channelIcon: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2ecc71', position: 'absolute', bottom: 0, right: 0, borderWidth: 2 },
  chatItemContent: { flex: 1, borderBottomWidth: 1, paddingBottom: 15 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  chatName: { fontSize: 16, fontWeight: 'bold' },
  timeText: { fontSize: 12 },
  messageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, flex: 1, marginRight: 10 },
  unreadBadge: { backgroundColor: '#F27121', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  
  // Conversation View Styles
  conversationHeader: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  onlineStatus: { fontSize: 12, marginTop: 2 },
  conversationContainer: { flex: 1 },
  messagesContainer: { padding: 20 },
  messageItemContainer: { marginBottom: 15, maxWidth: '75%', alignSelf: 'flex-start' },
  ownMessageContainer: { alignSelf: 'flex-end' },
  senderName: { fontSize: 12, marginBottom: 4, marginLeft: 12 },
  messageBubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' },
  ownMessageBubble: { backgroundColor: '#F27121', borderBottomRightRadius: 4 },
  otherMessageBubble: { borderBottomLeftRadius: 4 },
  messageContent: { fontSize: 15, lineHeight: 20 },
  messageTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  
  // Message Input Styles
  messageInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderTopWidth: 1,
    minHeight: 60
  },
  attachBtn: { marginRight: 8, marginBottom: 8 },
  messageInput: { 
    flex: 1, 
    minHeight: 38,
    maxHeight: 100, 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    fontSize: 15,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)'
  },
  sendBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 19, 
    backgroundColor: '#F27121', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 8
  },
  sendBtnDisabled: { opacity: 0.5 },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 400
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  modalBody: {
    padding: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8
  },
  typeButtonActive: {
    borderColor: '#F27121',
    backgroundColor: 'rgba(242, 113, 33, 0.1)'
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 16
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  cancelButton: {
    borderWidth: 1
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  createButton: {
    backgroundColor: '#F27121'
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  
  // Account Suggestions Styles
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 10,
    maxHeight: 250,
    overflow: 'hidden'
  },
  suggestionsHeader: {
    fontSize: 12,
    fontWeight: '600',
    padding: 12,
    paddingBottom: 8,
    textTransform: 'uppercase'
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 12
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  suggestionAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  suggestionUsername: {
    fontSize: 16,
    fontWeight: '600'
  },
  suggestionId: {
    fontSize: 12,
    marginTop: 2
  },
  selectedAccountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8
  },
  selectedAccountText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    marginTop: 10
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12
  },
  noResultsHint: {
    fontSize: 12,
    marginTop: 4
  },

  // Chat Info Modal Styles
  chatInfoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  chatInfoModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  chatInfoContent: {
    padding: 20
  },
  chatInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16
  },
  chatInfoTextContainer: {
    flex: 1
  },
  chatInfoLabel: {
    fontSize: 12,
    marginBottom: 4
  },
  chatInfoValue: {
    fontSize: 16,
    fontWeight: '600'
  }
});