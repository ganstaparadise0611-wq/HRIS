import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import CustomAlert from '../../components/CustomAlert';
import { getBackendUrl } from '../../constants/backend-config';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from './ThemeContext';

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  due_date?: string;
}

interface Feedback {
  id: number;
  title: string;
  message: string;
  type: 'suggestion' | 'complaint' | 'compliment';
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

export default function UserTasks() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert } = useCustomAlert();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'tasks' | 'feedback'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'task' | 'feedback'>('task');
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formType, setFormType] = useState<'suggestion' | 'complaint' | 'compliment'>('suggestion');
  const [formDueDate, setFormDueDate] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      loadFeedbacks();
    }, [])
  );

  const loadTasks = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID found');
        return;
      }

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/tasks.php?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setTasks(result.data);
      } else {
        throw new Error(result.error || 'Failed to load tasks');
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load tasks. Please try again.'
      });
    }
  };

  const loadFeedbacks = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID found');
        return;
      }

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/feedback.php?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setFeedbacks(result.data);
      } else {
        throw new Error(result.error || 'Failed to load feedback');
      }
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load feedback. Please try again.'
      });
    }
  };

  const submitTask = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all required fields'
      });
      return;
    }

    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID found');
      }

      const taskData = {
        user_id: parseInt(userId),
        title: formTitle,
        description: formDescription,
        priority: formPriority,
        due_date: formDueDate || null
      };

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/tasks.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        resetForm();
        setModalVisible(false);
        loadTasks(); // Reload tasks to show the new task
        showAlert({
          type: 'success',
          title: 'Success',
          message: 'Task created successfully!'
        });
      } else {
        throw new Error(result.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to create task. Please try again.'
      });
    }
  };

  const submitFeedback = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all required fields'
      });
      return;
    }

    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID found');
      }

      const feedbackData = {
        user_id: parseInt(userId),
        title: formTitle,
        message: formDescription,
        type: formType
      };

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/feedback.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        resetForm();
        setModalVisible(false);
        loadFeedbacks(); // Reload feedback to show the new feedback
        showAlert({
          type: 'success',
          title: 'Success',
          message: 'Feedback submitted successfully!'
        });
      } else {
        throw new Error(result.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to submit feedback. Please try again.'
      });
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormType('suggestion');
    setFormDueDate('');
  };

  const openModal = (type: 'task' | 'feedback') => {
    setModalType(type);
    resetForm();
    setModalVisible(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#E74C3C';
      case 'medium': return '#F39C12';
      case 'low': return '#27AE60';
      default: return colors.text;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved': return '#27AE60';
      case 'in_progress':
      case 'reviewed': return '#F39C12';
      case 'pending': return '#3498DB';
      default: return colors.text;
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View style={[styles.itemCard, { backgroundColor: colors.card }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
            <Text style={[styles.badgeText, { color: getPriorityColor(item.priority) }]}>
              {item.priority.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.itemDescription, { color: colors.subText }]}>{item.description}</Text>
      <View style={styles.itemFooter}>
        <Text style={[styles.dateText, { color: colors.subText }]}>
          Created: {item.created_at}
        </Text>
        {item.due_date && (
          <Text style={[styles.dateText, { color: colors.subText }]}>
            Due: {item.due_date}
          </Text>
        )}
      </View>
    </View>
  );

  const renderFeedback = ({ item }: { item: Feedback }) => (
    <View style={[styles.itemCard, { backgroundColor: colors.card }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: '#F27121' + '20' }]}>
            <Text style={[styles.badgeText, { color: '#F27121' }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.itemDescription, { color: colors.subText }]}>{item.message}</Text>
      <Text style={[styles.dateText, { color: colors.subText }]}>
        Submitted: {item.created_at}
      </Text>
    </View>
  );

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, dyn.text]}>Tasks & Feedback</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tasks' && styles.activeTab]} 
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>
            Tasks ({tasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'feedback' && styles.activeTab]} 
          onPress={() => setActiveTab('feedback')}
        >
          <Text style={[styles.tabText, activeTab === 'feedback' && styles.activeTabText]}>
            Feedback ({feedbacks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'tasks' ? (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => `task-${item.id}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name="checkmark-done-outline" 
                size={64} 
                color={colors.subText} 
              />
              <Text style={[styles.emptyText, dyn.sub]}>
                No tasks yet
              </Text>
              <Text style={[styles.emptySubText, dyn.sub]}>
                Tap the + button to create a task
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={feedbacks}
          renderItem={renderFeedback}
          keyExtractor={(item) => `feedback-${item.id}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name="chatbubble-outline" 
                size={64} 
                color={colors.subText} 
              />
              <Text style={[styles.emptyText, dyn.sub]}>
                No feedback yet
              </Text>
              <Text style={[styles.emptySubText, dyn.sub]}>
                Tap the + button to submit feedback
              </Text>
            </View>
          )}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => openModal(activeTab === 'tasks' ? 'task' : 'feedback')}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, dyn.card]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dyn.text]}>
                {modalType === 'task' ? 'Create New Task' : 'Submit Feedback'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <TextInput
                style={[styles.input, dyn.border, dyn.text]}
                placeholder="Title"
                placeholderTextColor={colors.subText}
                value={formTitle}
                onChangeText={setFormTitle}
              />

              <TextInput
                style={[styles.textArea, dyn.border, dyn.text]}
                placeholder={modalType === 'task' ? 'Task description...' : 'Your feedback...'}
                placeholderTextColor={colors.subText}
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
                numberOfLines={4}
              />

              {modalType === 'task' ? (
                <>
                  <Text style={[styles.label, dyn.text]}>Priority</Text>
                  <View style={styles.priorityContainer}>
                    {['low', 'medium', 'high'].map((priority) => (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          styles.priorityButton,
                          { borderColor: colors.border },
                          formPriority === priority && { backgroundColor: '#F27121' }
                        ]}
                        onPress={() => setFormPriority(priority as 'low' | 'medium' | 'high')}
                      >
                        <Text style={[
                          styles.priorityText,
                          { color: colors.text },
                          formPriority === priority && { color: '#FFF' }
                        ]}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[styles.input, dyn.border, dyn.text]}
                    placeholder="Due Date (YYYY-MM-DD) - Optional"
                    placeholderTextColor={colors.subText}
                    value={formDueDate}
                    onChangeText={setFormDueDate}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, dyn.text]}>Feedback Type</Text>
                  <View style={styles.priorityContainer}>
                    {['suggestion', 'complaint', 'compliment'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.priorityButton,
                          { borderColor: colors.border },
                          formType === type && { backgroundColor: '#F27121' }
                        ]}
                        onPress={() => setFormType(type as 'suggestion' | 'complaint' | 'compliment')}
                      >
                        <Text style={[
                          styles.priorityText,
                          { color: colors.text },
                          formType === type && { color: '#FFF' }
                        ]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={modalType === 'task' ? submitTask : submitFeedback}
            >
              <Text style={styles.submitButtonText}>
                {modalType === 'task' ? 'Create Task' : 'Submit Feedback'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Alert */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 24 },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#F27121' },
  tabText: { fontSize: 16, color: '#666' },
  activeTabText: { color: '#F27121', fontWeight: 'bold' },
  
  listContainer: { padding: 20, paddingTop: 0 },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 10 },
  badges: { flexDirection: 'column', gap: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  itemDescription: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  dateText: { fontSize: 12 },
  
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySubText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F27121',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  
  form: { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityText: { fontSize: 14, fontWeight: '500' },
  
  submitButton: {
    backgroundColor: '#F27121',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});