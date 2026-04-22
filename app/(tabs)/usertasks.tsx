import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
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
  status: 'pending' | 'in_progress' | 'completed' | 'verified' | 'cancelled' | 'suspended';
  created_at: string;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  assigned_to?: number;
  user_id?: number;
  creator_id?: number;
}

interface Feedback {
  id: number;
  title: string;
  message: string;
  type: 'suggestion' | 'complaint' | 'compliment';
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  satisfaction_rating?: number | null;
  share_to_feed?: boolean | null;
}

interface Employee {
  emp_id: number;
  log_id?: number;
  name: string;
  role?: string;
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [attachmentSize, setAttachmentSize] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskAttachments, setTaskAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'received' | 'sent'>('received');
  
  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formType, setFormType] = useState<'suggestion' | 'complaint' | 'compliment'>('suggestion');
  const [formDueDate, setFormDueDate] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formRating, setFormRating] = useState<number>(0);
  const [formShareToFeed, setFormShareToFeed] = useState(false);
  const [pickerStep, setPickerStep] = useState<0 | 1 | 2>(0); // 0 = hidden, 1 = start, 2 = end
  const [viewDate, setViewDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      loadFeedbacks();
    }, [taskFilter])
  );

  const loadTasks = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID found');
        return;
      }

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/tasks.php?user_id=${userId}&type=${taskFilter}`, {
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

  const loadEmployees = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.warn('No user ID found');
        return;
      }

      setEmployeesLoading(true);
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/get-department-employees.php?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.ok) {
        const list = Array.isArray(result.employees) ? result.employees : [];
        setEmployees(list);

        if (!assigneeId) {
          const myId = parseInt(userId, 10);
          const me = list.find((emp: Employee) => Number(emp.log_id) === myId);
          setAssigneeId(me?.log_id ?? myId);
        }
      } else {
        throw new Error(result.message || 'Failed to load employees');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load employees. Please try again.'
      });
    } finally {
      setEmployeesLoading(false);
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
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        due_date: formDueDate || null,
        assigned_to: assigneeId ?? parseInt(userId, 10)
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
        const created = result.data;
        const taskId = Array.isArray(created) ? created[0]?.id : created?.id;

        if (attachmentUri && taskId) {
          try {
            const formData = new FormData();
            formData.append('file', {
              uri: attachmentUri,
              name: attachmentName || 'attachment',
              type: attachmentType || 'application/octet-stream'
            } as any);
            formData.append('task_id', String(taskId));
            formData.append('uploaded_by', String(userId));

            const uploadRes = await fetch(`${backendUrl}/task-attachments.php`, {
              method: 'POST',
              headers: { 'ngrok-skip-browser-warning': 'true' },
              body: formData,
            });

            const uploadData = await uploadRes.json();
            if (!uploadData.ok) {
              console.warn('Attachment upload failed:', uploadData);
            }
          } catch (uploadError) {
            console.warn('Attachment upload error:', uploadError);
          }
        }

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
        type: formType,
        satisfaction_rating: formRating > 0 ? formRating : null,
        share_to_feed: formShareToFeed
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
    setFormStartDate('');
    setFormEndDate('');
    setFormRating(0);
    setFormShareToFeed(false);
    setAssigneeId(null);
    setAttachmentUri(null);
    setAttachmentName(null);
    setAttachmentType(null);
    setAttachmentSize(null);
  };

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;

      const file = result.assets[0];
      setAttachmentUri(file.uri);
      setAttachmentName(file.name ?? 'attachment');
      setAttachmentType(file.mimeType ?? 'application/octet-stream');
      setAttachmentSize(file.size ?? null);
    } catch (error) {
      console.warn('Failed to pick attachment:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to pick attachment. Please try again.'
      });
    }
  };

  const clearAttachment = () => {
    setAttachmentUri(null);
    setAttachmentName(null);
    setAttachmentType(null);
    setAttachmentSize(null);
  };

  const taskStatusOptions: Array<Task['status']> = [
    'pending',
    'in_progress',
    'completed',
    'verified',
    'cancelled',
    'suspended'
  ];

  const handleDateChange = (d: Date) => {
    const formatted = d.toISOString().split('T')[0];
    if (pickerStep === 1) {
      setFormStartDate(formatted);
      setPickerStep(0);
    } else if (pickerStep === 2) {
      setFormEndDate(formatted);
      setPickerStep(0);
    }
  };

  const loadTaskAttachments = async (taskId: number) => {
    try {
      setAttachmentsLoading(true);
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/task-attachments.php?task_id=${taskId}`, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.ok) {
        setTaskAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      } else {
        setTaskAttachments([]);
      }
    } catch (_e) {
      setTaskAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    loadTaskAttachments(task.id);
  };

  const updateTaskStatus = async (status: Task['status']) => {
    if (!selectedTask) return;
    try {
      setStatusUpdating(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) throw new Error('No user ID found');
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/tasks.php`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          user_id: parseInt(userId, 10),
          status
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTask({ ...selectedTask, status });
        setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? { ...t, status } : t)));
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (e) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to update task status.'
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const renderRatingStars = (value?: number | null, size: number = 16) => {
    const rating = value ?? 0;
    return (
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons
            key={`star-${i}`}
            name={i <= rating ? 'star' : 'star-outline'}
            size={size}
            color={i <= rating ? '#F27121' : '#C9C9C9'}
          />
        ))}
      </View>
    );
  };

  const openModal = (type: 'task' | 'feedback') => {
    setModalType(type);
    resetForm();
    setModalVisible(true);
    if (type === 'task') {
      loadEmployees();
    }
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
      case 'verified': return '#16A085';
      case 'in_progress':
      case 'reviewed': return '#F39C12';
      case 'cancelled': return '#E74C3C';
      case 'suspended': return '#8E44AD';
      case 'pending': return '#3498DB';
      default: return colors.text;
    }
  };

  const renderTask = ({ item }: { item: Task }) => {
    const isSent = taskFilter === 'sent';
    const otherUser = isSent 
      ? employees.find(e => Number(e.log_id) === item.assigned_to)
      : employees.find(e => Number(e.log_id) === item.user_id);
    
    const displayName = otherUser ? otherUser.name : (isSent ? `User ${item.assigned_to}` : `User ${item.user_id}`);
    const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    
    return (
      <TouchableOpacity
        style={[styles.taskItem, { borderBottomColor: colors.border }]}
        onPress={() => openTaskDetail(item)}
        activeOpacity={0.7}
      >
        <View style={styles.taskAvatar}>
          <View style={[styles.avatarCircle, { backgroundColor: '#EEE' }]}>
            <Ionicons name="person" size={24} color="#CCC" />
          </View>
        </View>
        <View style={styles.taskInfo}>
          <View style={styles.taskRow}>
            <Text style={[styles.taskTo, { color: colors.text }]}>
              {isSent ? 'To : ' : 'From : '}{displayName}
            </Text>
            <Text style={[styles.taskTime, { color: colors.subText }]}>{timeStr}</Text>
          </View>
          <View style={styles.taskRow}>
            <Text style={[styles.taskText, { color: colors.subText }]} numberOfLines={1}>
              {item.description}
            </Text>
            <Text style={[styles.taskStatus, { color: getStatusColor(item.status) }]}>
              {item.status === 'pending' ? 'New' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
      {item.satisfaction_rating ? (
        <View style={styles.ratingBlock}>
          {renderRatingStars(item.satisfaction_rating, 14)}
        </View>
      ) : null}
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

  const selectedAssignee = employees.find((emp) => Number(emp.log_id) === assigneeId);
  const styles = createStyles(colors, theme);

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#F27121' }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: '#FFF' }]}>Task & Feedback</Text>
        <TouchableOpacity onPress={() => openModal(activeTab === 'tasks' ? 'task' : 'feedback')}>
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tasks' && styles.activeTab]} 
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>
            TASK
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'feedback' && styles.activeTab]} 
          onPress={() => setActiveTab('feedback')}
        >
          <Text style={[styles.tabText, activeTab === 'feedback' && styles.activeTabText]}>
            FEEDBACK
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Buttons (only for tasks) */}
      {activeTab === 'tasks' && (
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterButton, taskFilter === 'received' && styles.activeFilter]} 
            onPress={() => setTaskFilter('received')}
          >
            <Ionicons name="file-tray-outline" size={18} color={taskFilter === 'received' ? '#F27121' : colors.subText} />
            <Text style={[styles.filterText, { color: taskFilter === 'received' ? '#F27121' : colors.subText }]}>Received</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, taskFilter === 'sent' && styles.activeFilter]} 
            onPress={() => setTaskFilter('sent')}
          >
            <Ionicons name="send-outline" size={18} color={taskFilter === 'sent' ? '#F27121' : colors.subText} />
            <Text style={[styles.filterText, { color: taskFilter === 'sent' ? '#F27121' : colors.subText }]}>Sent</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* FAB removed as it's now in the header */}

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F27121' }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalOverlay, dyn.bg]}
          >
            <View style={[styles.modalContent, dyn.bg, { padding: 0 }]}>
            <View style={[styles.fullHeader, { backgroundColor: '#F27121' }]}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.fullHeaderTitle}>
                {modalType === 'task' ? 'Create New Task' : 'Submit Feedback'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={[styles.form, { padding: 20 }]} showsVerticalScrollIndicator={false}>
              {modalType === 'task' ? (
                <>
                  {/* Selected Employee Info */}
                  <TouchableOpacity 
                    style={styles.selectedEmployeeContainer}
                    onPress={() => setShowAssigneeModal(true)}
                  >
                    <View style={[styles.avatarCircle, { marginRight: 15 }]}>
                      <Ionicons name="person" size={24} color="#CCC" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedEmployeeName, { color: '#F27121' }]}>
                        {selectedAssignee ? selectedAssignee.name : 'Select Employee'}
                      </Text>
                      <Text style={[styles.selectedEmployeeRole, { color: '#AAA' }]}>
                        {selectedAssignee ? (selectedAssignee.role || 'Employee') : 'Click to select an employee'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <Text style={[styles.inputLabel, { color: '#F27121' }]}>Task</Text>
                  <TextInput
                    style={[styles.taskTitleInput, { color: colors.text }]}
                    placeholder="Sales Report 2019"
                    placeholderTextColor={colors.subText}
                    value={formTitle}
                    onChangeText={setFormTitle}
                  />
                  <View style={styles.underline} />

                  <View style={styles.dateRow}>
                    <View style={styles.dateColumn}>
                      <Text style={[styles.inputLabel, { color: '#F27121' }]}>Start Date</Text>
                      <TouchableOpacity 
                        style={styles.dateInputContainer}
                        onPress={() => { setViewDate(formStartDate ? new Date(formStartDate) : new Date()); setPickerStep(1); }}
                      >
                        <Text style={[styles.dateInput, { color: formStartDate ? colors.text : colors.subText }]}>
                          {formStartDate || "Select Date"}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#CCC" />
                      </TouchableOpacity>
                      <View style={styles.underline} />
                    </View>
                    <View style={styles.dateColumn}>
                      <Text style={[styles.inputLabel, { color: '#F27121' }]}>End Date</Text>
                      <TouchableOpacity 
                        style={styles.dateInputContainer}
                        onPress={() => { setViewDate(formEndDate ? new Date(formEndDate) : new Date()); setPickerStep(2); }}
                      >
                        <Text style={[styles.dateInput, { color: formEndDate ? colors.text : colors.subText }]}>
                          {formEndDate || "Select Date"}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#CCC" />
                      </TouchableOpacity>
                      <View style={styles.underline} />
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { color: '#F27121', marginTop: 20 }]}>Priority</Text>
                  
                  {/* Segmented Priority Selector */}
                  <View style={styles.prioritySegment}>
                    {(['low', 'medium', 'high'] as const).map((p, idx) => {
                      const isActive = formPriority === p;
                      const labels = { low: 'Low', medium: 'Normal', high: 'High' };
                      const colors_map = { low: '#4CAF50', medium: '#FF9800', high: '#F44336' };
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.prioritySegmentBtn,
                            idx === 0 && styles.prioritySegmentFirst,
                            idx === 2 && styles.prioritySegmentLast,
                            isActive && { backgroundColor: colors_map[p], borderColor: colors_map[p] },
                            !isActive && { borderColor: colors.border, backgroundColor: colors.card },
                          ]}
                          onPress={() => setFormPriority(p)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={p === 'low' ? 'flag-outline' : p === 'medium' ? 'flag' : 'flag'}
                            size={14}
                            color={isActive ? '#FFF' : colors_map[p]}
                          />
                          <Text style={[
                            styles.prioritySegmentText,
                            { color: isActive ? '#FFF' : colors.text },
                          ]}>
                            {labels[p]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.inputLabel, { color: '#F27121', marginTop: 20 }]}>Description</Text>
                  <TextInput
                    style={[styles.textAreaInput, { color: colors.text }]}
                    placeholder="Input task description..."
                    placeholderTextColor={colors.subText}
                    value={formDescription}
                    onChangeText={setFormDescription}
                    multiline
                  />
                  <View style={styles.underline} />

                  <Text style={[styles.inputLabel, { color: '#F27121', marginTop: 20 }]}>Attachment</Text>
                  <View style={styles.attachmentSection}>
                    <TouchableOpacity 
                      style={[styles.attachmentAddBox, dyn.border, { borderStyle: 'dashed' }]}
                      onPress={pickAttachment}
                    >
                      {attachmentUri ? (
                        <Ionicons name="document-text" size={32} color="#F27121" />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <Ionicons name="cloud-upload-outline" size={28} color={dyn.sub.color} />
                          <Text style={[dyn.sub, { fontSize: 12, marginTop: 4 }]}>Upload file</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {attachmentName && (
                      <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }} numberOfLines={1}>{attachmentName}</Text>
                        <Text style={{ fontSize: 11, color: colors.subText, marginTop: 2 }}>
                          {attachmentSize ? (attachmentSize / 1024).toFixed(1) + ' KB' : 'Unknown size'}
                        </Text>
                        <TouchableOpacity onPress={clearAttachment} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                          <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '600' }}>Remove File</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.label, dyn.text]}>Type</Text>
                  <View style={styles.priorityContainer}>
                    {['suggestion', 'complaint', 'compliment'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.priorityButton,
                          { borderColor: colors.border },
                          formType === type && { backgroundColor: '#F27121' + '20', borderColor: '#F27121' }
                        ]}
                        onPress={() => setFormType(type as any)}
                      >
                        <Text style={[
                          styles.priorityText,
                          { color: colors.text },
                          formType === type && { color: '#F27121' }
                        ]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.label, dyn.text]}>Title</Text>
                  <TextInput
                    style={[styles.input, dyn.border, dyn.text]}
                    placeholder="Title"
                    placeholderTextColor={colors.subText}
                    value={formTitle}
                    onChangeText={setFormTitle}
                  />

                  <Text style={[styles.label, dyn.text]}>Your feedback...</Text>
                  <TextInput
                    style={[styles.textArea, dyn.border, dyn.text]}
                    placeholder="Your feedback..."
                    placeholderTextColor={colors.subText}
                    value={formDescription}
                    onChangeText={setFormDescription}
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={[styles.label, dyn.text]}>Satisfaction Rating (Optional)</Text>
                  <View style={styles.ratingPicker}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TouchableOpacity key={`rate-${i}`} style={styles.ratingStarButton} onPress={() => setFormRating(i)}>
                        <Ionicons
                          name={i <= formRating ? 'star' : 'star-outline'}
                          size={32}
                          color={i <= formRating ? '#F27121' : '#C9C9C9'}
                        />
                      </TouchableOpacity>
                    ))}
                    {formRating > 0 && (
                      <TouchableOpacity onPress={() => setFormRating(0)}>
                        <Text style={styles.ratingClearText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.shareToggle}
                    onPress={() => setFormShareToFeed(!formShareToFeed)}
                  >
                    <Ionicons 
                      name={formShareToFeed ? 'checkbox' : 'square-outline'} 
                      size={24} 
                      color={formShareToFeed ? '#F27121' : colors.subText} 
                    />
                    <Text style={[styles.shareToggleText, dyn.text]}>Share this to public feed</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={modalType === 'task' ? submitTask : submitFeedback}
            >
              <Text style={styles.sendButtonText}>
                {modalType === 'task' ? 'SEND' : 'SUBMIT'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Custom Calendar Modal ── */}
      <Modal visible={pickerStep > 0} transparent animationType="fade" onRequestClose={() => setPickerStep(0)}>
        <View style={styles.centeredModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setPickerStep(0)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.calendarBox, dyn.card]}>
            <Text style={[{ fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }, dyn.text]}>
              {pickerStep === 1 ? 'Select Start Date' : 'Select End Date'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setPickerStep(0)}>
                <Text style={[dyn.sub, { fontWeight: '600' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[dyn.text, { fontWeight: 'bold' }]}>
                {pickerStep === 1 ? (formStartDate || 'None') : (formEndDate || 'None')}
              </Text>
            </View>

            {/* Nav */}
            <View style={styles.calendarHeader}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={styles.navBtn}>
                  <Ionicons name="chevron-back" size={24} color={dyn.text.color} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.monthYearText, dyn.text]}>
                {viewDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={styles.navBtn}>
                  <Ionicons name="chevron-forward" size={24} color={dyn.text.color} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Days */}
            <View style={styles.weekDaysRow}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                <Text key={i} style={[styles.weekDayText, dyn.sub]}>{d}</Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => (
                <View key={`e${i}`} style={styles.dayCell} />
              ))}
              {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1);
                d.setHours(0, 0, 0, 0);
                const isSel = pickerStep === 1
                  ? d.getTime() === (formStartDate ? new Date(formStartDate).getTime() : 0)
                  : d.getTime() === (formEndDate ? new Date(formEndDate).getTime() : 0);
                
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayCell, isSel && { backgroundColor: '#F27121' }]}
                    onPress={() => handleDateChange(d)}
                  >
                    <Text style={[styles.dayText, isSel ? { color: '#FFF' } : dyn.text]}>{i + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </Modal>

      {/* Task Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectedTask !== null}
        onRequestClose={() => setSelectedTask(null)}
      >
        <TouchableOpacity
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setSelectedTask(null)}
        >
          <TouchableOpacity
            style={[styles.detailSheet, dyn.card]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedTask && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <Text style={[styles.detailTitle, dyn.text]}>{selectedTask.title}</Text>
                  <TouchableOpacity onPress={() => setSelectedTask(null)}>
                    <Ionicons name="close" size={22} color={colors.subText} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.detailDescription, dyn.sub]}>
                  {selectedTask.description}
                </Text>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, dyn.sub]}>Status</Text>
                  <Text style={[styles.detailValue, { color: getStatusColor(selectedTask.status) }]}>
                    {selectedTask.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, dyn.sub]}>Priority</Text>
                  <Text style={[styles.detailValue, { color: getPriorityColor(selectedTask.priority) }]}>
                    {selectedTask.priority.toUpperCase()}
                  </Text>
                </View>
                {selectedTask.start_date && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dyn.sub]}>Start Date</Text>
                    <Text style={[styles.detailValue, dyn.text]}>{selectedTask.start_date}</Text>
                  </View>
                )}
                {selectedTask.end_date && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dyn.sub]}>End Date</Text>
                    <Text style={[styles.detailValue, dyn.text]}>{selectedTask.end_date}</Text>
                  </View>
                )}
                {selectedTask.due_date && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dyn.sub]}>Due Date</Text>
                    <Text style={[styles.detailValue, dyn.text]}>{selectedTask.due_date}</Text>
                  </View>
                )}

                <Text style={[styles.sectionLabel, dyn.text]}>Update Status</Text>
                <View style={styles.statusOptions}>
                  {taskStatusOptions.map((status) => (
                    <TouchableOpacity
                      key={`status-${status}`}
                      style={[
                        styles.statusOption,
                        selectedTask.status === status && { backgroundColor: getStatusColor(status) + '20', borderColor: getStatusColor(status) }
                      ]}
                      onPress={() => updateTaskStatus(status)}
                      disabled={statusUpdating}
                    >
                      <Text style={[styles.statusOptionText, { color: getStatusColor(status) }]}>
                        {status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {statusUpdating && (
                  <View style={styles.statusUpdatingRow}>
                    <ActivityIndicator size="small" color="#F27121" />
                    <Text style={[styles.statusUpdatingText, dyn.sub]}>Updating status...</Text>
                  </View>
                )}

                <Text style={[styles.sectionLabel, dyn.text]}>Attachments</Text>
                {attachmentsLoading ? (
                  <View style={styles.attachmentsLoading}>
                    <ActivityIndicator size="small" color="#F27121" />
                    <Text style={[styles.statusUpdatingText, dyn.sub]}>Loading attachments...</Text>
                  </View>
                ) : taskAttachments.length === 0 ? (
                  <Text style={[styles.attachmentsEmpty, dyn.sub]}>No attachments</Text>
                ) : (
                  taskAttachments.map((att) => (
                    <TouchableOpacity
                      key={att.attachment_id}
                      style={styles.attachmentItem}
                      onPress={() => att.file_path && Linking.openURL(att.file_path)}
                    >
                      <Ionicons name="document" size={18} color={colors.subText} />
                      <Text style={[styles.attachmentItemText, dyn.text]} numberOfLines={1}>
                        {att.filename}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Assignee Selector Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showAssigneeModal}
        onRequestClose={() => setShowAssigneeModal(false)}
      >
        <TouchableOpacity
          style={styles.selectorOverlay}
          activeOpacity={1}
          onPress={() => setShowAssigneeModal(false)}
        >
          <TouchableOpacity
            style={[styles.selectorSheet, dyn.card]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.selectorTitle, dyn.text]}>Select Employee</Text>
            <ScrollView style={styles.selectorList}>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={`${emp.emp_id}-${emp.log_id ?? ''}`}
                  style={styles.selectorItem}
                  onPress={() => {
                    if (emp.log_id != null) {
                      setAssigneeId(Number(emp.log_id));
                    }
                    setShowAssigneeModal(false);
                  }}
                >
                  <View style={styles.selectorItemText}>
                    <Text style={[styles.selectorName, dyn.text]}>{emp.name}</Text>
                    <Text style={[styles.selectorRole, dyn.sub]}>
                      {emp.role ? emp.role : 'Employee'}
                    </Text>
                  </View>
                  {Number(emp.log_id) === assigneeId && (
                    <Ionicons name="checkmark-circle" size={20} color="#F27121" />
                  )}
                </TouchableOpacity>
              ))}
              {employees.length === 0 && !employeesLoading && (
                <Text style={[styles.selectorEmpty, dyn.sub]}>No employees found.</Text>
              )}
              {employeesLoading && (
                <Text style={[styles.selectorEmpty, dyn.sub]}>Loading...</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.selectorCancelButton, { borderColor: colors.border }]}
              onPress={() => setShowAssigneeModal(false)}
            >
              <Text style={[styles.selectorCancelText, dyn.sub]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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

const createStyles = (colors: any, theme: string) => StyleSheet.create({
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#F27121' },
  tabText: { fontSize: 14, color: '#999', fontWeight: 'bold' },
  activeTabText: { color: '#F27121' },
  
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    paddingVertical: 15,
    backgroundColor: theme === 'dark' ? '#121212' : '#F9F9F9',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilter: {
    borderColor: '#F27121',
    backgroundColor: theme === 'dark' ? '#F2712120' : '#FFF9F6',
  },
  filterText: { fontSize: 14, fontWeight: '600' },

  listContainer: { paddingBottom: 20 },
  taskItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  taskAvatar: {
    marginRight: 15,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme === 'dark' ? '#333' : '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  taskInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskTo: { fontSize: 16, fontWeight: '700' },
  taskTime: { fontSize: 12 },
  taskText: { fontSize: 14, flex: 1, marginRight: 10 },
  taskStatus: { fontSize: 13, fontWeight: 'bold' },

  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 15,
    marginTop: 15,
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
    justifyContent: 'flex-start',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F27121',
  },
  fullHeaderTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
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
  selectorButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectorText: { fontSize: 15 },
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

  attachmentBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentText: { fontSize: 14, fontWeight: '600' },
  removeAttachmentButton: { alignSelf: 'flex-start', marginBottom: 12 },
  removeAttachmentText: { color: '#F27121', fontSize: 13, fontWeight: '600' },

  ratingRow: { flexDirection: 'row', gap: 4 },
  ratingBlock: { marginTop: 6, marginBottom: 6 },
  ratingPicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingStarButton: { padding: 2 },
  ratingClearText: { color: '#F27121', fontSize: 12, fontWeight: '600' },

  shareToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  shareToggleText: { fontSize: 14, fontWeight: '600' },
  
  selectedEmployeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  selectedEmployeeName: { fontSize: 16, fontWeight: 'bold' },
  selectedEmployeeRole: { fontSize: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 5 },
  taskTitleInput: { fontSize: 16, paddingVertical: 5, fontWeight: '500' },
  underline: { height: 1, backgroundColor: colors.border, width: '100%' },
  dateRow: { flexDirection: 'row', gap: 20, marginTop: 15 },
  dateColumn: { flex: 1 },
  dateInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateInput: { fontSize: 16, paddingVertical: 5, flex: 1 },
  prioritySliderContainer: { marginTop: 10, position: 'relative', height: 40, justifyContent: 'center' },
  sliderTrack: { height: 4, backgroundColor: '#E0E0E0', width: '100%', borderRadius: 2 },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#CCC',
    transform: [{ translateX: -8 }],
    zIndex: 2,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  sliderLabelText: { fontSize: 12, color: '#999' },
  textAreaInput: { fontSize: 16, paddingVertical: 10, minHeight: 60, textAlignVertical: 'top' },

  prioritySegment: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  prioritySegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
  },
  prioritySegmentFirst: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  prioritySegmentLast: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  prioritySegmentText: { fontSize: 13, fontWeight: '600' },
  attachmentSection: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  attachmentAddBox: {
    width: 60,
    height: 60,
    backgroundColor: theme === 'dark' ? '#333' : '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  sendButton: {
    backgroundColor: '#FBA15C',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
    marginHorizontal: 10,
    shadowColor: '#FBA15C',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sendButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  selectorSheet: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
    backgroundColor: colors.card,
  },
  selectorTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  selectorList: { maxHeight: 360 },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  selectorItemText: { flex: 1, paddingRight: 12 },
  selectorName: { fontSize: 15, fontWeight: '600' },
  selectorRole: { marginTop: 2, fontSize: 12 },
  selectorEmpty: { textAlign: 'center', paddingVertical: 16 },
  selectorCancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  selectorCancelText: { fontSize: 14 },

  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  detailSheet: {
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
    backgroundColor: colors.card,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, paddingRight: 8 },
  detailDescription: { marginTop: 8, marginBottom: 12, lineHeight: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusOptionText: { fontSize: 11, fontWeight: '600' },
  statusUpdatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statusUpdatingText: { fontSize: 12 },
  attachmentsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachmentsEmpty: { fontSize: 12 },
  attachmentItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  attachmentItemText: { fontSize: 13, fontWeight: '600', flex: 1 },

  centeredModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  calendarBox: {
    width: '100%', maxWidth: 340, borderRadius: 16, padding: 24,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12,
  },
  calendarHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14, paddingHorizontal: 4,
  },
  monthYearText: { fontSize: 15, fontWeight: '700' },
  navBtn: { padding: 4 },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDayText: { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginVertical: 3 },
  dayText: { fontSize: 14, fontWeight: '500' },
});