import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { 
  Image, 
  Platform, 
  SafeAreaView, 
  ScrollView, 
  StatusBar, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { useTheme } from './ThemeContext';

export default function ShiftScheduleScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  // State
  const [step, setStep] = useState(0); 
  const [employee, setEmployee] = useState('Talia Putri');
  const [startDate, setStartDate] = useState(new Date(2020, 7, 3)); 
  const [endDate, setEndDate] = useState(new Date(2020, 7, 9)); 
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const dyn = {
    bg: { backgroundColor: isDark ? colors.background : '#F8F9FA' },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
    border: { borderColor: isDark ? '#334155' : '#E2E8F0' },
    accent: '#F27121', 
    inputBg: isDark ? '#0F172A' : '#F1F5F9',
    softOrange: isDark ? 'rgba(242, 113, 33, 0.15)' : '#FFF0E6',
  };

  const handleNext = () => setStep(1);
  const handleBack = () => {
    if (step === 1) setStep(0);
    else router.back();
  };

  const scheduleData = [
    { day: 'Mon, 3 Aug', hours: '8 Hours', shift: 'SHIFT_PAGI', time: '08:00 - 17:00' },
    { day: 'Tue, 4 Aug', hours: '8 Hours', shift: 'SHIFT_PAGI', time: '08:00 - 17:00' },
  ];

  const renderSelectionStep = () => (
    <View style={styles.content}>
      <View style={[styles.cardContainer, dyn.card]}>
        <Text style={[styles.sectionTitle, dyn.text]}>Schedule Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, dyn.sub]}>Employee</Text>
          <TouchableOpacity style={[styles.input, { backgroundColor: dyn.inputBg }]}>
            <View style={styles.inputLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: dyn.softOrange }]}>
                <Ionicons name="person" size={16} color={dyn.accent} />
              </View>
              <Text style={[styles.inputText, dyn.text]}>{employee}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={dyn.sub.color} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, dyn.sub]}>Start Date</Text>
          <TouchableOpacity 
            style={[styles.input, { backgroundColor: dyn.inputBg }]}
            onPress={() => setShowStartPicker(true)}
          >
            <View style={styles.inputLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: dyn.softOrange }]}>
                <Ionicons name="calendar" size={16} color={dyn.accent} />
              </View>
              <Text style={[styles.inputText, dyn.text]}>
                {startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, dyn.sub]}>End Date</Text>
          <TouchableOpacity 
            style={[styles.input, { backgroundColor: dyn.inputBg }]}
            onPress={() => setShowEndPicker(true)}
          >
            <View style={styles.inputLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: dyn.softOrange }]}>
                <Ionicons name="calendar" size={16} color={dyn.accent} />
              </View>
              <Text style={[styles.inputText, dyn.text]}>
                {endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: dyn.accent }]} onPress={handleNext}>
        <Text style={styles.primaryButtonText}>View Schedule</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );

  const renderScheduleStep = () => (
    <View style={styles.content}>
      <View style={[styles.summaryCard, dyn.card, dyn.border]}>
        
        {/* Header Row */}
        <View style={[styles.summaryTopRow, dyn.border]}>
          <Text style={styles.summaryEmployeeLabel}>Employee</Text>
          <View style={styles.summaryDateHeaders}>
            {scheduleData.map((item, idx) => (
              <View key={idx} style={styles.summaryDateHeader}>
                <Text style={styles.summDay}>{item.day}</Text>
                <Text style={styles.summHours}>{item.hours}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Data Row */}
        <View style={styles.summaryDataRow}>
          <View style={styles.summaryEmpInfo}>
            <Image 
              source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Talia' }} 
              style={styles.avatar} 
            />
            <View>
              <Text style={[styles.summaryName, dyn.text]}>{employee}</Text>
              <Text style={[styles.summaryTotalHours, dyn.sub]}>40 Hours</Text>
            </View>
          </View>
          <View style={styles.summaryCells}>
            {scheduleData.map((item, idx) => (
              <View key={idx} style={styles.summaryCell}>
                <View style={[styles.shiftBadge, { backgroundColor: dyn.softOrange }]}>
                  <Text style={[styles.summShift, { color: dyn.accent }]}>{item.shift}</Text>
                </View>
                <Text style={[styles.summTime, dyn.text]}>{item.time}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: dyn.accent }]} onPress={() => router.back()}>
        <Text style={styles.primaryButtonText}>Confirm & Submit</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, dyn.bg]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, dyn.border]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Shift Schedule</Text>
        {step === 1 ? (
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={24} color={dyn.text.color} />
          </TouchableOpacity>
        ) : <View style={{ width: 34 }} />}
      </View>

      {step === 0 ? renderSelectionStep() : renderScheduleStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    height: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  shareButton: { padding: 5 },
  
  content: { flex: 1, padding: 20 },
  cardContainer: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 16,
  },
  inputLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputText: { fontSize: 15, fontWeight: '500' },
  
  primaryButton: { 
    flexDirection: 'row',
    height: 56, 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10,
    shadowColor: '#F27121',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  
  summaryCard: { 
    borderRadius: 24, 
    borderWidth: 1,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05, 
    shadowRadius: 15,
    elevation: 4,
    overflow: 'hidden',
  },
  summaryTopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.02)'
  },
  summaryEmployeeLabel: { 
    width: '38%', 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#F27121' 
  },
  summaryDateHeaders: { 
    flex: 1, 
    flexDirection: 'row', 
    justifyContent: 'space-around' 
  },
  summaryDateHeader: { alignItems: 'center' },
  summDay: { fontSize: 12, fontWeight: '700', color: '#F27121' },
  summHours: { fontSize: 11, color: '#888', marginTop: 2 },

  summaryDataRow: { 
    flexDirection: 'row', 
    paddingVertical: 20, 
    paddingHorizontal: 16,
    alignItems: 'center' 
  },
  summaryEmpInfo: { 
    width: '38%', 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  summaryName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  summaryTotalHours: { fontSize: 12 },
  
  summaryCells: { 
    flex: 1, 
    flexDirection: 'row', 
    justifyContent: 'space-around' 
  },
  summaryCell: { alignItems: 'center' },
  shiftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  summShift: { fontSize: 10, fontWeight: '800' },
  summTime: { fontSize: 12, fontWeight: '500' },
});
