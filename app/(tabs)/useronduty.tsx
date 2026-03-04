import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { getBackendUrl, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../constants/backend-config';
import { recheckNetwork } from '../../constants/network-detector';
import { useTheme } from './ThemeContext';

const ON_DUTY_TYPES = [
  'Sales Support',
  'Client Meeting',
  'Site Visit',
  'Training',
  'Conference',
  'Other',
];

export default function UserOnDuty() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { visible, config, showAlert, hideAlert} = useCustomAlert();
  const isDark = theme === 'dark';
  
  const [step, setStep] = useState(1); // 1 = Basic Info, 2 = Details
  const [requestFor, setRequestFor] = useState('');
  const [onDutyType, setOnDutyType] = useState('');
  const [remark, setRemark] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState('');
  
  // Step 2 fields
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [fullDay, setFullDay] = useState(true);
  const [usdAllowance, setUsdAllowance] = useState('');
  const [idrAllowance, setIdrAllowance] = useState('');
  
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserInfo();
  }, []);

  useEffect(() => {
    recheckNetwork().catch(() => {});
  }, []);

  const loadUserInfo = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${userId}&select=name`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );
        const data = await response.json();
        if (data && data.length > 0 && data[0].name) {
          setRequestFor(data[0].name);
        } else {
          const username = await AsyncStorage.getItem('username');
          if (username) {
            setRequestFor(username);
          }
        }
      }
    } catch (_error) {
      // Fallback to username if employees fetch fails
      try {
        const username = await AsyncStorage.getItem('username');
        if (username) setRequestFor(username);
      } catch (_e) {}
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setAttachment(file.uri);
      setAttachmentName(file.name || 'document');
      showAlert({
        type: 'success',
        title: 'Attachment',
        message: `"${file.name}" selected. You can change it by tapping Upload again.`,
      });
    } catch (err) {
      showAlert({
        type: 'error',
        title: 'Attachment',
        message: 'Could not open file picker. You can proceed without an attachment.',
      });
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleNext = () => {
    if (!onDutyType) {
      showAlert({ type: 'error', title: 'Missing Information', message: 'Please select On Duty Type' });
      return;
    }
    if (!remark.trim()) {
      showAlert({ type: 'error', title: 'Missing Information', message: 'Please fill in the Remark field' });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!destination.trim()) {
      showAlert({ type: 'error', title: 'Missing Information', message: 'Please enter destination' });
      return;
    }

    try {
      setSubmitting(true);
      const userId = await AsyncStorage.getItem('userId');
      
      if (!userId) {
        showAlert({ type: 'error', title: 'Error', message: 'User not logged in' });
        return;
      }

      // Prepare form data
      const formData = {
        user_id: parseInt(userId, 10),
        request_for: requestFor,
        on_duty_type: onDutyType,
        remark: remark,
        destination: destination,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        full_day: fullDay,
        usd_allowance: usdAllowance ? parseFloat(usdAllowance) : 0,
        idr_allowance: idrAllowance ? parseFloat(idrAllowance) : 0,
        attachment: attachmentName,
        status: 'pending',
      };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${getBackendUrl()}/on_duty.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : {};
      } catch (_parseError) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok || !result.ok) {
        const errorMsg = result.message || 'Failed to submit on duty request. Please try again.';
        throw new Error(errorMsg);
      }

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'On Duty request submitted successfully!',
        buttonText: 'OK',
        onClose: () => {
          // Reset form
          setStep(1);
          setOnDutyType('');
          setRemark('');
          setDestination('');
          setAttachment(null);
          setAttachmentName('');
          setUsdAllowance('');
          setIdrAllowance('');
          router.back();
          hideAlert();
        }
      });
    } catch (error: any) {
      let errorMessage = 'Failed to submit request. Please try again.';
      
      if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!destination.trim()) {
      showAlert({ type: 'error', title: 'Missing Information', message: 'Please enter destination' });
      return;
    }

    try {
      setSubmitting(true);
      const userId = await AsyncStorage.getItem('userId');
      
      if (!userId) {
        showAlert({ type: 'error', title: 'Error', message: 'User not logged in' });
        return;
      }

      // Prepare form data with status 'draft'
      const formData = {
        user_id: parseInt(userId, 10),
        request_for: requestFor,
        on_duty_type: onDutyType,
        remark: remark,
        destination: destination,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        full_day: fullDay,
        usd_allowance: usdAllowance ? parseFloat(usdAllowance) : 0,
        idr_allowance: idrAllowance ? parseFloat(idrAllowance) : 0,
        attachment: attachmentName,
        status: 'draft',
      };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${getBackendUrl()}/on_duty.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : {};
      } catch (_parseError) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok || !result.ok) {
        const errorMsg = result.message || 'Failed to save draft. Please try again.';
        throw new Error(errorMsg);
      }

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'On Duty request saved as draft!',
        buttonText: 'OK',
        onClose: () => {
          router.back();
          hideAlert();
        }
      });
    } catch (error: any) {
      let errorMessage = 'Failed to save draft. Please try again.';
      
      if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showAlert({ type: 'error', title: 'Error', message: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input: { backgroundColor: isDark ? '#252525' : '#F0F0F0', color: colors.text, borderColor: colors.border },
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, dyn.bg]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, dyn.text]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* HEADER */}
      <View style={[styles.header, dyn.card]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>On Duty Form</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 ? (
          /* STEP 1: BASIC INFO */
          <View>
            <Text style={[styles.sectionTitle, dyn.text]}>Basic Information</Text>
            
            {/* Request For */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>Request for</Text>
              <View style={[styles.input, dyn.input, styles.disabledInput]}>
                <Ionicons name="person" size={20} color={colors.subText} style={styles.inputIcon} />
                <Text style={[styles.inputText, dyn.text]}>{requestFor}</Text>
              </View>
            </View>

            {/* On Duty Type */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>On Duty Type</Text>
              <TouchableOpacity
                style={[styles.input, dyn.input, styles.dropdownButton]}
                onPress={() => setShowTypeDropdown(true)}
              >
                <Text style={[styles.dropdownText, onDutyType ? dyn.text : dyn.sub]}>
                  {onDutyType || 'Select on duty type'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {/* Remark */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>Remark</Text>
              <TextInput
                style={[styles.input, dyn.input, styles.textArea]}
                placeholder="Enter remark (e.g., Meeting with Mr.Bryan)"
                placeholderTextColor={colors.subText}
                multiline
                numberOfLines={4}
                value={remark}
                onChangeText={setRemark}
              />
            </View>

            {/* Attachment */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>Attachment</Text>
              <TouchableOpacity
                style={[styles.uploadButton, dyn.border]}
                onPress={handleUploadAttachment}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#F27121" />
                <Text style={styles.uploadButtonText}>
                  {attachmentName || 'TAP TO PICK FILE'}
                </Text>
              </TouchableOpacity>
              {attachmentName ? (
                <View style={styles.attachmentRow}>
                  <Text style={[styles.attachmentName, dyn.sub]} numberOfLines={1}>{attachmentName}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAttachment(null);
                      setAttachmentName('');
                    }}
                    style={styles.removeAttachmentButton}
                  >
                    <Ionicons name="close-circle" size={22} color="#E74C3C" />
                    <Text style={styles.removeAttachmentText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* NEXT BUTTON */}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>NEXT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* STEP 2: DETAILS */
          <View>
            {/* On Duty Type Banner */}
            <View style={styles.typeBanner}>
              <Ionicons name="information-circle" size={20} color="#F27121" />
              <Text style={styles.typeBannerText}>On Duty Type: {onDutyType}</Text>
            </View>

            <Text style={[styles.sectionTitle, dyn.text]}>DETAIL</Text>

            {/* Destination */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>Destination</Text>
              <View style={[styles.input, dyn.input, styles.searchInput]}>
                <Ionicons name="search" size={20} color={colors.subText} style={styles.inputIcon} />
                <TextInput
                  style={[styles.searchTextInput, dyn.text]}
                  placeholder="Type your destination here"
                  placeholderTextColor={colors.subText}
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </View>

            {/* Date Section */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>Date</Text>
              
              {/* Start Date */}
              <TouchableOpacity
                style={[styles.input, dyn.input, styles.dateButton]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={[styles.dateButtonText, dyn.text]}>Start Date: {formatDate(startDate)}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.subText} />
              </TouchableOpacity>

              {/* Full Day Toggle */}
              <TouchableOpacity
                style={styles.fullDayContainer}
                onPress={() => setFullDay(!fullDay)}
              >
                <View style={[styles.checkbox, fullDay && styles.checkboxChecked]}>
                  {fullDay && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={[styles.fullDayText, dyn.text]}>Full Day</Text>
              </TouchableOpacity>

              {/* End Date */}
              <TouchableOpacity
                style={[styles.input, dyn.input, styles.dateButton, { marginTop: 10 }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={[styles.dateButtonText, dyn.text]}>End Date: {formatDate(endDate)}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {/* Total Allowance */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, dyn.sub]}>Total Allowance</Text>
              <View style={styles.allowanceContainer}>
                <View style={[styles.allowanceInput, dyn.input]}>
                  <Text style={[styles.allowanceLabel, dyn.sub]}>USD</Text>
                  <TextInput
                    style={[styles.allowanceTextInput, dyn.text]}
                    placeholder="0"
                    placeholderTextColor={colors.subText}
                    keyboardType="numeric"
                    value={usdAllowance}
                    onChangeText={setUsdAllowance}
                  />
                </View>
                <View style={[styles.allowanceInput, dyn.input]}>
                  <Text style={[styles.allowanceLabel, dyn.sub]}>IDR</Text>
                  <TextInput
                    style={[styles.allowanceTextInput, dyn.text]}
                    placeholder="0"
                    placeholderTextColor={colors.subText}
                    keyboardType="numeric"
                    value={idrAllowance}
                    onChangeText={setIdrAllowance}
                  />
                </View>
              </View>
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.draftButton, dyn.border]}
                onPress={handleSaveDraft}
              >
                <Text style={[styles.draftButtonText, dyn.text]}>Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'SUBMITTING...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* On Duty Type Dropdown Modal */}
      <Modal
        visible={showTypeDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTypeDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeDropdown(false)}
        >
          <View style={[styles.dropdownModal, dyn.card]}>
            {ON_DUTY_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.dropdownOption, dyn.border]}
                onPress={() => {
                  setOnDutyType(type);
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, dyn.text]}>{type}</Text>
                {onDutyType === type && (
                  <Ionicons name="checkmark" size={20} color="#F27121" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStartDatePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Start Date</Text>
                <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                textColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accentColor="#F27121"
                themeVariant={Platform.OS === 'ios' ? 'dark' : undefined}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowStartDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setStartDate(selectedDate);
                    }
                  } else {
                    if (selectedDate) {
                      setStartDate(selectedDate);
                    }
                  }
                }}
                style={styles.datePickerComponent}
              />
              
              {Platform.OS === 'ios' && (
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={[styles.datePickerButton2, styles.cancelButton2]}
                    onPress={() => setShowStartDatePicker(false)}
                  >
                    <Text style={styles.cancelButtonText2}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePickerButton2, styles.confirmButton]}
                    onPress={() => setShowStartDatePicker(false)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEndDatePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select End Date</Text>
                <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                textColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                accentColor="#F27121"
                themeVariant={Platform.OS === 'ios' ? 'dark' : undefined}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowEndDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setEndDate(selectedDate);
                    }
                  } else {
                    if (selectedDate) {
                      setEndDate(selectedDate);
                    }
                  }
                }}
                style={styles.datePickerComponent}
              />
              
              {Platform.OS === 'ios' && (
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity
                    style={[styles.datePickerButton2, styles.cancelButton2]}
                    onPress={() => setShowEndDatePicker(false)}
                  >
                    <Text style={styles.cancelButtonText2}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.datePickerButton2, styles.confirmButton]}
                    onPress={() => setShowEndDatePicker(false)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 10,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledInput: {
    opacity: 0.7,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownButton: {
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#F27121',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  attachmentName: {
    fontSize: 12,
    flex: 1,
    fontStyle: 'italic',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  removeAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeAttachmentText: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#F27121',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  typeBannerText: {
    color: '#F27121',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchInput: {
    paddingLeft: 10,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 5,
  },
  dateButton: {
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 16,
  },
  fullDayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#F27121',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#F27121',
  },
  fullDayText: {
    fontSize: 14,
  },
  allowanceContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  allowanceInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  allowanceLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  allowanceTextInput: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 30,
  },
  draftButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 12,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  dropdownOptionText: {
    fontSize: 16,
  },
  datePickerModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#000000',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  datePickerComponent: {
    width: '100%',
    marginVertical: 10,
  },
  datePickerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  datePickerButton2: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton2: {
    backgroundColor: '#555',
  },
  cancelButtonText2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#F27121',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
