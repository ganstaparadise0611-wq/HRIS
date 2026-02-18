import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PHP_BACKEND_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

interface Activity {
  activity_id: number;
  emp_id: number;
  task_description: string;
  location: string;
  photo_url: string | null;
  status: string;
  created_at: string;
}

export default function UserActivity() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [task, setTask] = useState('');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [empId, setEmpId] = useState<number | null>(null);

  // DYNAMIC STYLES
  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    input: { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0', color: colors.text, borderColor: colors.border },
    border: { borderColor: colors.border },
    iconColor: isDark ? "#FFF" : "#333"
  };

  useEffect(() => {
    loadEmpIdAndActivities();
  }, []);

  const loadEmpIdAndActivities = async () => {
    try {
      setLoading(true);
      
      // Try to get emp_id from AsyncStorage first
      let currentEmpId = await AsyncStorage.getItem('emp_id');
      
      if (!currentEmpId) {
        // If not found, resolve it from log_id
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          currentEmpId = await resolveEmpId(parseInt(userId, 10));
        }
      }
      
      if (currentEmpId) {
        const empIdNum = parseInt(currentEmpId, 10);
        setEmpId(empIdNum);
        await loadActivities(empIdNum);
      } else {
        Alert.alert('Error', 'Unable to load employee ID. Please log in again.');
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      Alert.alert('Error', 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const resolveEmpId = async (logId: number): Promise<string | null> => {
    try {
      // Try RPC function first
      const rpcRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_emp_id_by_log_id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ p_log_id: logId }),
        }
      );
      
      if (rpcRes.ok) {
        const rpcResult = await rpcRes.json();
        if (rpcResult && rpcResult.emp_id) {
          await AsyncStorage.setItem('emp_id', String(rpcResult.emp_id));
          return String(rpcResult.emp_id);
        }
      }
      
      // Fallback: direct query
      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${logId}&select=emp_id`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      
      if (empRes.ok) {
        const employees = await empRes.json();
        if (employees && employees.length > 0 && employees[0].emp_id) {
          const resolvedEmpId = String(employees[0].emp_id);
          await AsyncStorage.setItem('emp_id', resolvedEmpId);
          return resolvedEmpId;
        }
      }
    } catch (error) {
      console.error('Error resolving emp_id:', error);
    }
    return null;
  };

  const loadActivities = async (empIdNum: number) => {
    try {
      const response = await fetch(
        `${PHP_BACKEND_URL}/user_activities.php?emp_id=${empIdNum}&today_only=true`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const result = await response.json();
      if (result.ok && Array.isArray(result.data)) {
        setActivities(result.data);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to add photo evidence.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        if (asset.base64) {
          setPhotoBase64(asset.base64);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#f39c12';
      case 'approved':
      case 'synced':
        return '#2ecc71';
      case 'rejected':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const handleSubmit = async () => {
    if (!task.trim()) {
      Alert.alert('Missing Information', 'Please enter a task description');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Missing Information', 'Please enter a location');
      return;
    }

    if (!empId) {
      Alert.alert('Error', 'Employee ID not found. Please try again.');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('emp_id', empId.toString());
      formData.append('task_description', task.trim());
      formData.append('location', location.trim());
      
      if (photoUri) {
        formData.append('photo', {
          uri: photoUri,
          name: 'activity_photo.jpg',
          type: 'image/jpeg',
        } as any);
      }

      const response = await fetch(`${PHP_BACKEND_URL}/user_activities.php`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      const result = await response.json();

      if (result.ok) {
        Alert.alert('Success', 'Activity recorded successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setTask('');
              setLocation('');
              setPhotoUri(null);
              setPhotoBase64(null);
              // Reload activities
              if (empId) {
                loadActivities(empId);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to save activity');
      }
    } catch (error) {
      console.error('Error submitting activity:', error);
      Alert.alert('Error', 'Failed to submit activity. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={[styles.header, dyn.border]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, dyn.text]}>Activity Record</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F27121" />
          <Text style={[styles.loadingText, dyn.sub]}>Loading activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Activity Record</Text>
        <TouchableOpacity onPress={loadEmpIdAndActivities}>
          <Ionicons name="refresh" size={24} color="#F27121" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* NEW ENTRY */}
        <Text style={[styles.sectionTitle, dyn.sub]}>New Entry</Text>
        <View style={[styles.formCard, dyn.card]}>
            <TouchableOpacity 
              style={[styles.photoUpload, dyn.input, photoUri && styles.photoUploadFilled]} 
              onPress={pickImage}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera-plus" size={30} color={colors.subText} />
                  <Text style={[styles.photoText, dyn.sub]}>Add Photo Evidence</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.label, dyn.sub]}>Task Description</Text>
            <TextInput 
                style={[styles.input, dyn.input]} 
                placeholder="What are you working on?" 
                placeholderTextColor={colors.subText}
                value={task}
                onChangeText={setTask}
                multiline
                numberOfLines={3}
            />

            <Text style={[styles.label, dyn.sub]}>Location</Text>
            <TextInput 
                style={[styles.input, dyn.input]} 
                placeholder="Where are you?" 
                placeholderTextColor={colors.subText}
                value={location}
                onChangeText={setLocation}
            />

            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>SUBMIT RECORD</Text>
              )}
            </TouchableOpacity>
        </View>

        {/* HISTORY */}
        <Text style={[styles.sectionTitle, dyn.sub]}>Today's History</Text>
        
        {activities.length === 0 ? (
          <View style={[styles.emptyContainer, dyn.card]}>
            <Ionicons name="document-text-outline" size={48} color={colors.subText} />
            <Text style={[styles.emptyText, dyn.sub]}>No activities recorded today</Text>
          </View>
        ) : (
          activities.map((item, index) => (
            <View key={item.activity_id} style={styles.activityItem}>
              <View style={styles.timelineContainer}>
                <View style={styles.timelineDot} />
                {index < activities.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                )}
              </View>

              <View style={[styles.activityContent, dyn.card]}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityTime}>{formatTime(item.created_at)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Ionicons 
                      name={item.status.toLowerCase() === 'pending' ? 'time-outline' : 'checkmark-circle'} 
                      size={12} 
                      color={getStatusColor(item.status)} 
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.activityTitle, dyn.text]}>{item.task_description}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={12} color={colors.subText} />
                  <Text style={[styles.activityLocation, dyn.sub]}>{item.location}</Text>
                </View>
                {item.photo_url && (
                  <View style={styles.photoContainer}>
                    <Image 
                      source={{ uri: `data:image/jpeg;base64,${item.photo_url}` }} 
                      style={styles.activityPhoto}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backButton: { padding: 5, width: 34 },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  formCard: { borderRadius: 12, padding: 20, marginBottom: 30, elevation: 2 },
  photoUpload: { height: 100, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  photoUploadFilled: { borderStyle: 'solid', padding: 0 },
  photoPreview: { width: '100%', height: '100%', borderRadius: 8 },
  photoText: { marginTop: 5, fontSize: 12 },
  label: { marginBottom: 8, fontWeight: '600' },
  input: { padding: 15, borderRadius: 8, borderWidth: 1, marginBottom: 20 },
  submitButton: { backgroundColor: '#F27121', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  activityItem: { flexDirection: 'row', marginBottom: 20 },
  timelineContainer: { alignItems: 'center', marginRight: 15, width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F27121', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: -5 },
  activityContent: { flex: 1, borderRadius: 10, padding: 15, elevation: 1 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' },
  activityTime: { color: '#F27121', fontWeight: 'bold', fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, marginLeft: 4, fontWeight: '600' },
  activityTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  activityLocation: { fontSize: 12, marginLeft: 4 },
  photoContainer: { marginTop: 10, borderRadius: 8, overflow: 'hidden' },
  activityPhoto: { width: '100%', height: 200, borderRadius: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center', borderRadius: 12, marginTop: 20 },
  emptyText: { marginTop: 10, fontSize: 14 },
});
