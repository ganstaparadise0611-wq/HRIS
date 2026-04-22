import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { getBackendUrl } from '../../constants/backend-config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  no: number;
  emp_id: number;
  emp_number: string;
  name: string;
  position: string;
  work_location: string;
  work_location_name: string;
  // Exact 90 columns mapped
  absence_due_to_suspension: number;
  absence_without_official_leave: number;
  absent: number;
  absent_due_to_half_day: number;
  bereavement_half_day_1: number;
  bereavement_half_day_2: number;
  birthday_leave: number;
  break_due_to_lwph1: number;
  break_due_to_lwph2: number;
  early_in: number;
  early_out: number;
  emergency_leave_full_day: number;
  emergency_leave_half_day_1: number;
  emergency_leave_half_day_2: number;
  holiday: number;
  inhouse_training: number;
  late_in: number;
  late_out: number;
  leave_without_pay_full_day: number;
  leave_without_pay_half_day_1: number;
  leave_without_pay_half_day_2: number;
  leave_in_lieu: number;
  maternity_cs_full_day: number;
  maternity_cs_half_day_1: number;
  maternity_cs_half_day_2: number;
  maternity_normal_full_day: number;
  maternity_normal_half_day_1: number;
  maternity_normal_half_day_2: number;
  maternity_normal_cs: number;
  maternity_normal_cs_less_7: number;
  solo_parent_leave: number;
  miscarriage_leave: number;
  no_swipe_in: number;
  no_swipe_out: number;
  no_swipe_in_with_half_day_leave_filing: number;
  no_swipe_out_with_half_day_leave_filing: number;
  off_on_duty: number;
  present_on_duty_2: number;
  present_on_duty_3: number;
  special_on_duty: number;
  on_duty_half: number;
  overtime_public_holiday: number;
  overtime_regular: number;
  paternity_leave_full_day: number;
  paternity_leave_half_day_1: number;
  paternity_leave_half_day_2: number;
  penalty_no_in: number;
  penalty_no_out: number;
  present_full_day: number;
  present_half_day_1: number;
  present_half_day_2: number;
  present_off: number;
  present_off_nsi: number;
  present_off_nso: number;
  present_off_special: number;
  present_3_regular_holiday: number;
  service_incentive_leave_full_day: number;
  service_incentive_leave_half_day_1: number;
  service_incentive_leave_half_day_2: number;
  sick_leave_full_day: number;
  sick_leave_half_day_1: number;
  sick_leave_half_day_2: number;
  sick_leave_manager_full_day: number;
  sick_leave_manager_half_day_1: number;
  sick_leave_manager_half_day_2: number;
  solo_parent_leave_full_day: number;
  solo_parent_leave_half_day_1: number;
  solo_parent_leave_half_day_2: number;
  special_leave_for_women_ra_9710_full_day: number;
  special_leave_for_women_half_day_1: number;
  special_leave_for_women_half_day_2: number;
  suspension: number;
  training: number;
  unproductive: number;
  vacation_leave_full_day: number;
  vacation_leave_half_day_1: number;
  vacation_leave_half_day_2: number;
  vacation_leave_manager_full_day: number;
  vacation_leave_manager_half_day_1: number;
  vacation_leave_manager_half_day_2: number;
  vawc_leave_ra_9262_full_day: number;
  vawc_leave_half_day_1: number;
  vawc_leave_half_day_2: number;
  total_activity: number;
}

// ─── Report Column Definitions (exact GreatDay order) ─────────────────────────

const COLUMNS: { key: keyof ReportRow; label: string; group: string }[] = [
  { key: 'absence_due_to_suspension', label: 'Absence Due to Suspension', group: 'Absences' },
  { key: 'absence_without_official_leave', label: 'Absence Without Official Leave', group: 'Leaves' },
  { key: 'absent', label: 'Absent', group: 'Absences' },
  { key: 'absent_due_to_half_day', label: 'Absent due to Half Day', group: 'Absences' },
  { key: 'bereavement_half_day_1', label: 'Bereavement Half Day 1', group: 'Other' },
  { key: 'bereavement_half_day_2', label: 'Bereavement Half Day 2', group: 'Other' },
  { key: 'birthday_leave', label: 'Birthday Leave', group: 'Leaves' },
  { key: 'break_due_to_lwph1', label: 'Break Due to LWPH1', group: 'Time Records' },
  { key: 'break_due_to_lwph2', label: 'Break Due to LWPH2', group: 'Time Records' },
  { key: 'early_in', label: 'Early In', group: 'Time Records' },
  { key: 'early_out', label: 'Early Out', group: 'Time Records' },
  { key: 'emergency_leave_full_day', label: 'Emergency Leave (Full Day)', group: 'Leaves' },
  { key: 'emergency_leave_half_day_1', label: 'Emergency Leave Half Day 1', group: 'Leaves' },
  { key: 'emergency_leave_half_day_2', label: 'Emergency Leave Half Day 2', group: 'Leaves' },
  { key: 'holiday', label: 'Holiday', group: 'Presence' },
  { key: 'inhouse_training', label: 'Inhouse Training', group: 'Other' },
  { key: 'late_in', label: 'Late In', group: 'Time Records' },
  { key: 'late_out', label: 'Late Out', group: 'Time Records' },
  { key: 'leave_without_pay_full_day', label: 'Leave Without Pay (Full Day)', group: 'Leaves' },
  { key: 'leave_without_pay_half_day_1', label: 'Leave Without Pay Half Day 1', group: 'Leaves' },
  { key: 'leave_without_pay_half_day_2', label: 'Leave Without Pay Half Day 2', group: 'Leaves' },
  { key: 'leave_in_lieu', label: 'Leave in Lieu', group: 'Leaves' },
  { key: 'maternity_cs_full_day', label: 'Maternity CS (Full Day)', group: 'Special Leaves' },
  { key: 'maternity_cs_half_day_1', label: 'Maternity CS Half Day 1', group: 'Special Leaves' },
  { key: 'maternity_cs_half_day_2', label: 'Maternity CS Half Day 2', group: 'Special Leaves' },
  { key: 'maternity_normal_full_day', label: 'Maternity Normal (Full Day)', group: 'Special Leaves' },
  { key: 'maternity_normal_half_day_1', label: 'Maternity Normal Half Day 1', group: 'Special Leaves' },
  { key: 'maternity_normal_half_day_2', label: 'Maternity Normal Half Day 2', group: 'Special Leaves' },
  { key: 'maternity_normal_cs', label: 'Maternity Normal/CS', group: 'Special Leaves' },
  { key: 'maternity_normal_cs_less_7', label: 'Maternity Normal/CS Less 7', group: 'Special Leaves' },
  { key: 'solo_parent_leave', label: 'Solo Parent Leave', group: 'Special Leaves' },
  { key: 'miscarriage_leave', label: 'Miscarriage Leave', group: 'Leaves' },
  { key: 'no_swipe_in', label: 'No Swipe In', group: 'Time Records' },
  { key: 'no_swipe_out', label: 'No Swipe Out', group: 'Time Records' },
  { key: 'no_swipe_in_with_half_day_leave_filing', label: 'No Swipe In with Half Day Leave Filing', group: 'Time Records' },
  { key: 'no_swipe_out_with_half_day_leave_filing', label: 'No Swipe Out with Half Day Leave Filing', group: 'Time Records' },
  { key: 'off_on_duty', label: 'Off On Duty', group: 'Presence' },
  { key: 'present_on_duty_2', label: 'Present On Duty 2', group: 'Presence' },
  { key: 'present_on_duty_3', label: 'Present On Duty 3', group: 'Presence' },
  { key: 'special_on_duty', label: 'Special On Duty', group: 'Presence' },
  { key: 'on_duty_half', label: 'On Duty Half', group: 'Presence' },
  { key: 'overtime_public_holiday', label: 'Overtime (Public Holiday)', group: 'Overtime' },
  { key: 'overtime_regular', label: 'Overtime (Regular)', group: 'Overtime' },
  { key: 'paternity_leave_full_day', label: 'Paternity Leave (Full Day)', group: 'Special Leaves' },
  { key: 'paternity_leave_half_day_1', label: 'Paternity Leave Half Day 1', group: 'Special Leaves' },
  { key: 'paternity_leave_half_day_2', label: 'Paternity Leave Half Day 2', group: 'Special Leaves' },
  { key: 'penalty_no_in', label: 'Penalty No In', group: 'Time Records' },
  { key: 'penalty_no_out', label: 'Penalty No Out', group: 'Time Records' },
  { key: 'present_full_day', label: 'Present (Full Day)', group: 'Presence' },
  { key: 'present_half_day_1', label: 'Present Half Day 1', group: 'Presence' },
  { key: 'present_half_day_2', label: 'Present Half Day 2', group: 'Presence' },
  { key: 'present_off', label: 'Present OFF', group: 'Presence' },
  { key: 'present_off_nsi', label: 'Present OFF NSI', group: 'Presence' },
  { key: 'present_off_nso', label: 'Present OFF NSO', group: 'Presence' },
  { key: 'present_off_special', label: 'Present OFF Special', group: 'Presence' },
  { key: 'present_3_regular_holiday', label: 'Present 3 Regular Holiday', group: 'Presence' },
  { key: 'service_incentive_leave_full_day', label: 'Service Incentive Leave (Full Day)', group: 'Leaves' },
  { key: 'service_incentive_leave_half_day_1', label: 'Service Incentive Leave Half Day 1', group: 'Leaves' },
  { key: 'service_incentive_leave_half_day_2', label: 'Service Incentive Leave Half Day 2', group: 'Leaves' },
  { key: 'sick_leave_full_day', label: 'Sick Leave (Full Day)', group: 'Leaves' },
  { key: 'sick_leave_half_day_1', label: 'Sick Leave Half Day 1', group: 'Leaves' },
  { key: 'sick_leave_half_day_2', label: 'Sick Leave Half Day 2', group: 'Leaves' },
  { key: 'sick_leave_manager_full_day', label: 'Sick Leave Manager (Full Day)', group: 'Leaves' },
  { key: 'sick_leave_manager_half_day_1', label: 'Sick Leave Manager Half Day 1', group: 'Leaves' },
  { key: 'sick_leave_manager_half_day_2', label: 'Sick Leave Manager Half Day 2', group: 'Leaves' },
  { key: 'solo_parent_leave_full_day', label: 'Solo Parent Leave (Full Day)', group: 'Special Leaves' },
  { key: 'solo_parent_leave_half_day_1', label: 'Solo Parent Leave Half Day 1', group: 'Special Leaves' },
  { key: 'solo_parent_leave_half_day_2', label: 'Solo Parent Leave Half Day 2', group: 'Special Leaves' },
  { key: 'special_leave_for_women_ra_9710_full_day', label: 'Special Leave for Women (RA 9710 Full Day)', group: 'Special Leaves' },
  { key: 'special_leave_for_women_half_day_1', label: 'Special Leave for Women Half Day 1', group: 'Special Leaves' },
  { key: 'special_leave_for_women_half_day_2', label: 'Special Leave for Women Half Day 2', group: 'Special Leaves' },
  { key: 'suspension', label: 'Suspension', group: 'Absences' },
  { key: 'training', label: 'Training', group: 'Other' },
  { key: 'unproductive', label: 'Unproductive', group: 'Other' },
  { key: 'vacation_leave_full_day', label: 'Vacation Leave (Full Day)', group: 'Leaves' },
  { key: 'vacation_leave_half_day_1', label: 'Vacation Leave Half Day 1', group: 'Leaves' },
  { key: 'vacation_leave_half_day_2', label: 'Vacation Leave Half Day 2', group: 'Leaves' },
  { key: 'vacation_leave_manager_full_day', label: 'Vacation Leave Manager (Full Day)', group: 'Leaves' },
  { key: 'vacation_leave_manager_half_day_1', label: 'Vacation Leave Manager Half Day 1', group: 'Leaves' },
  { key: 'vacation_leave_manager_half_day_2', label: 'Vacation Leave Manager Half Day 2', group: 'Leaves' },
  { key: 'vawc_leave_ra_9262_full_day', label: 'VAWC Leave (RA 9262 Full Day)', group: 'Special Leaves' },
  { key: 'vawc_leave_half_day_1', label: 'VAWC Leave Half Day 1', group: 'Special Leaves' },
  { key: 'vawc_leave_half_day_2', label: 'VAWC Leave Half Day 2', group: 'Special Leaves' },
  { key: 'total_activity', label: 'Total Activity', group: 'Total' },
];

const GROUP_COLORS: Record<string, string> = {
  'Absences':       '#EF4444',
  'Leaves':         '#F59E0B',
  'Time Records':   '#3B82F6',
  'Presence':       '#10B981',
  'Overtime':       '#8B5CF6',
  'Special Leaves': '#EC4899',
  'Other':          '#64748B',
  'Total':          '#F48B29',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendanceReportScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const dyn = {
    bg:    { backgroundColor: colors.background },
    text:  { color: colors.text },
    sub:   { color: isDark ? '#AAA' : '#666' },
    card:  { backgroundColor: colors.card },
    border:{ borderColor: colors.border },
    input: { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? '#444' : '#D1D1D6' },
    checkboxEmpty: isDark ? '#666' : '#D1D1D6',
    tableBg: isDark ? '#1A1A2E' : '#F8FAFC',
    tableHeader: isDark ? '#2D2D44' : '#E2E8F0',
    tableRow: isDark ? '#1E1E30' : '#FFF',
    tableAlt: isDark ? '#252540' : '#F8FAFC',
    tableSticky: isDark ? '#1C1C1E' : '#FFF',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [userId, setUserId]     = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate,   setEndDate]   = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

  const [pickerStep, setPickerStep] = useState<0 | 1 | 2>(0);
  const [viewDate,   setViewDate]   = useState(new Date());

  const [showUnknownStatus,  setShowUnknownStatus]  = useState(false);
  const [showDetailLocation, setShowDetailLocation] = useState(false);

  const [isDateOptionModalVisible, setDateOptionModalVisible] = useState(false);
  const [isDownloadModalVisible,   setDownloadModalVisible]   = useState(false);
  const [isEmpModalVisible,        setEmpModalVisible]        = useState(false);

  // Employee selection
  interface DeptEmployee { emp_id: number; name: string; role: string; }
  const [deptEmployees,    setDeptEmployees]    = useState<DeptEmployee[]>([]);
  const [selectedEmpIds,   setSelectedEmpIds]   = useState<Set<number>>(new Set());
  const [empSearch,        setEmpSearch]        = useState('');
  const [empLoading,       setEmpLoading]       = useState(false);

  const [report,    setReport]    = useState<ReportRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  const { visible: alertVisible, config: alertConfig, showAlert, hideAlert } = useCustomAlert();

  // ── Bootstrap user + load dept employees ────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => {
      setUserId(id);
      if (id) loadDeptEmployees(id);
    });
  }, []);

  const loadDeptEmployees = async (uid: string) => {
    setEmpLoading(true);
    try {
      const base = getBackendUrl();
      const res  = await fetch(`${base}/get-department-employees.php?user_id=${uid}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.employees)) {
        const list: DeptEmployee[] = json.employees;
        setDeptEmployees(list);
        setSelectedEmpIds(new Set());
      }
    } catch (_) {}
    finally { setEmpLoading(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const toISODate = (d: Date) => d.toISOString().slice(0, 10);

  // ── Fetch Report ──────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!userId) {
      showAlert({ type: 'warning', title: 'Not Logged In', message: 'Please log in first.' });
      return;
    }
    if (selectedEmpIds.size === 0) {
      showAlert({ type: 'warning', title: 'No Employee Selected', message: 'Please select at least one employee.' });
      return;
    }
    setLoading(true);
    try {
      const base   = getBackendUrl();
      const ids    = Array.from(selectedEmpIds).join(',');
      const url    = `${base}/attendance-report.php?user_id=${userId}&start_date=${toISODate(startDate)}&end_date=${toISODate(endDate)}&emp_ids=${ids}&show_unknown=${showUnknownStatus}&show_detail_location=${showDetailLocation}`;
      const res    = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const json   = await res.json();
      if (json.ok) {
        setReport(json.report ?? []);
        setGenerated(json.generated_at ?? null);
      } else {
        showAlert({ type: 'error', title: 'Failed', message: json.message ?? 'Could not load report.' });
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Network Error', message: e.message });
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, selectedEmpIds, showUnknownStatus, showDetailLocation]);

  // ── Date Picker ───────────────────────────────────────────────────────────
  const handleDateChange = (event: any, selectedDate?: Date) => {
    const step = pickerStep;
    setPickerStep(0);

    if (!selectedDate || event?.type === 'dismissed') return;

    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);

    if (step === 1) {
      if (d > endDate) {
        showAlert({ type: 'warning', title: 'Invalid Date', message: 'Start date cannot be after end date.' });
      } else {
        setStartDate(d);
      }
    } else if (step === 2) {
      if (d < startDate) {
        showAlert({ type: 'warning', title: 'Invalid Date', message: 'End date cannot be before start date.' });
      } else {
        setEndDate(d);
      }
    }
  };

  const pickSpecificDate = (step: 1 | 2) => {
    setDateOptionModalVisible(false);
    setTimeout(() => {
      setViewDate(step === 1 ? startDate : endDate);
      setPickerStep(step);
    }, 150);
  };

  // ── Excel Export (CSV via Share) ──────────────────────────────────────────
  const exportCSV = async () => {
    if (report.length === 0) {
      showAlert({ type: 'warning', title: 'No Data', message: 'Generate a report first before downloading.' });
      return;
    }

    const header1 = [
      'No.', 'Emp No', 'Employee Name', 'Position', 'Work Location', 'Work Location Name',
      'Absence Due to Suspension',
      'Absence Without Official Leave',
      'Absent',
      'Absent due to Half Day',
      'Bereavement Half Day 1',
      'Bereavement Half Day 2',
      'Birthday Leave',
      'Break Due to LWPH1',
      'Break Due to LWPH2',
      'Early In',
      'Early Out',
      'Emergency Leave (Full Day)',
      'Emergency Leave Half Day 1',
      'Emergency Leave Half Day 2',
      'Holiday',
      'Inhouse Training',
      'Late In',
      'Late Out',
      'Leave Without Pay (Full Day)',
      'Leave Without Pay Half Day 1',
      'Leave Without Pay Half Day 2',
      'Leave in Lieu',
      'Maternity CS (Full Day)',
      'Maternity CS Half Day 1',
      'Maternity CS Half Day 2',
      'Maternity Normal (Full Day)',
      'Maternity Normal Half Day 1',
      'Maternity Normal Half Day 2',
      'Maternity Normal/CS',
      'Maternity Normal/CS Less 7',
      'Solo Parent Leave',
      'Miscarriage Leave',
      'No Swipe In',
      'No Swipe Out',
      'No Swipe In with Half Day Leave Filing',
      'No Swipe Out with Half Day Leave Filing',
      'Off On Duty',
      'Present On Duty 2',
      'Present On Duty 3',
      'Special On Duty',
      'On Duty Half',
      'Overtime (Public Holiday)',
      'Overtime (Regular)',
      'Paternity Leave (Full Day)',
      'Paternity Leave Half Day 1',
      'Paternity Leave Half Day 2',
      'Penalty No In',
      'Penalty No Out',
      'Present (Full Day)',
      'Present Half Day 1',
      'Present Half Day 2',
      'Present OFF',
      'Present OFF NSI',
      'Present OFF NSO',
      'Present OFF Special',
      'Present 3 Regular Holiday',
      'Service Incentive Leave (Full Day)',
      'Service Incentive Leave Half Day 1',
      'Service Incentive Leave Half Day 2',
      'Sick Leave (Full Day)',
      'Sick Leave Half Day 1',
      'Sick Leave Half Day 2',
      'Sick Leave Manager (Full Day)',
      'Sick Leave Manager Half Day 1',
      'Sick Leave Manager Half Day 2',
      'Solo Parent Leave (Full Day)',
      'Solo Parent Leave Half Day 1',
      'Solo Parent Leave Half Day 2',
      'Special Leave for Women (RA 9710 Full Day)',
      'Special Leave for Women Half Day 1',
      'Special Leave for Women Half Day 2',
      'Suspension',
      'Training',
      'Unproductive',
      'Vacation Leave (Full Day)',
      'Vacation Leave Half Day 1',
      'Vacation Leave Half Day 2',
      'Vacation Leave Manager (Full Day)',
      'Vacation Leave Manager Half Day 1',
      'Vacation Leave Manager Half Day 2',
      'VAWC Leave (RA 9262 Full Day)',
      'VAWC Leave Half Day 1',
      'VAWC Leave Half Day 2',
      'Total Activity',
    ].join(',');

    const rows = report.map(r => [
      r.no, `"${r.emp_number}"`, `"${r.name}"`, `"${r.position}"`, `"${r.work_location}"`, `"${r.work_location_name}"`,
      r.absence_due_to_suspension, r.absence_without_official_leave, r.absent, r.absent_due_to_half_day, r.bereavement_half_day_1, r.bereavement_half_day_2, r.birthday_leave, r.break_due_to_lwph1, r.break_due_to_lwph2, r.early_in, r.early_out, r.emergency_leave_full_day, r.emergency_leave_half_day_1, r.emergency_leave_half_day_2, r.holiday, r.inhouse_training, r.late_in, r.late_out, r.leave_without_pay_full_day, r.leave_without_pay_half_day_1, r.leave_without_pay_half_day_2, r.leave_in_lieu, r.maternity_cs_full_day, r.maternity_cs_half_day_1, r.maternity_cs_half_day_2, r.maternity_normal_full_day, r.maternity_normal_half_day_1, r.maternity_normal_half_day_2, r.maternity_normal_cs, r.maternity_normal_cs_less_7, r.solo_parent_leave, r.miscarriage_leave, r.no_swipe_in, r.no_swipe_out, r.no_swipe_in_with_half_day_leave_filing, r.no_swipe_out_with_half_day_leave_filing, r.off_on_duty, r.present_on_duty_2, r.present_on_duty_3, r.special_on_duty, r.on_duty_half, r.overtime_public_holiday, r.overtime_regular, r.paternity_leave_full_day, r.paternity_leave_half_day_1, r.paternity_leave_half_day_2, r.penalty_no_in, r.penalty_no_out, r.present_full_day, r.present_half_day_1, r.present_half_day_2, r.present_off, r.present_off_nsi, r.present_off_nso, r.present_off_special, r.present_3_regular_holiday, r.service_incentive_leave_full_day, r.service_incentive_leave_half_day_1, r.service_incentive_leave_half_day_2, r.sick_leave_full_day, r.sick_leave_half_day_1, r.sick_leave_half_day_2, r.sick_leave_manager_full_day, r.sick_leave_manager_half_day_1, r.sick_leave_manager_half_day_2, r.solo_parent_leave_full_day, r.solo_parent_leave_half_day_1, r.solo_parent_leave_half_day_2, r.special_leave_for_women_ra_9710_full_day, r.special_leave_for_women_half_day_1, r.special_leave_for_women_half_day_2, r.suspension, r.training, r.unproductive, r.vacation_leave_full_day, r.vacation_leave_half_day_1, r.vacation_leave_half_day_2, r.vacation_leave_manager_full_day, r.vacation_leave_manager_half_day_1, r.vacation_leave_manager_half_day_2, r.vawc_leave_ra_9262_full_day, r.vawc_leave_half_day_1, r.vawc_leave_half_day_2,
      r.total_activity,
    ].join(','));

    const csv = [
      `Attendance Report: ${formatDate(startDate)} - ${formatDate(endDate)}`,
      '',
      header1,
      ...rows,
    ].join('\n');

    try {
      const fileName = `Attendance_Report_${toISODate(startDate)}_${toISODate(endDate)}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download Attendance Report',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        showAlert({ type: 'warning', title: 'Not Available', message: 'Sharing is not available on this device.' });
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Export Failed', message: e.message });
    }
    setDownloadModalVisible(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const renderTableHeader = () => (
    <View style={styles.tableHeaderRow}>
      {/* Sticky identity columns placeholder — rendered via fixedLeftHeader */}
      <View style={[styles.thFixed, styles.thNo, { backgroundColor: dyn.tableHeader }]}>
        <Text style={[styles.thText, dyn.text]}>No.</Text>
      </View>
      <View style={[styles.thFixed, styles.thEmpNo, { backgroundColor: dyn.tableHeader }]}>
        <Text style={[styles.thText, dyn.text]}>Emp No.</Text>
      </View>
      <View style={[styles.thFixed, styles.thName, { backgroundColor: dyn.tableHeader }]}>
        <Text style={[styles.thText, dyn.text]}>Name</Text>
      </View>
      <View style={[styles.thFixed, styles.thPosition, { backgroundColor: dyn.tableHeader }]}>
        <Text style={[styles.thText, dyn.text]}>Position</Text>
      </View>
      <View style={[styles.thFixed, styles.thLocation, { backgroundColor: dyn.tableHeader }]}>
        <Text style={[styles.thText, dyn.text]}>Work Location</Text>
      </View>
      {COLUMNS.map(col => (
        <View
          key={col.key}
          style={[
            styles.td,
            { backgroundColor: GROUP_COLORS[col.group] + '22', borderBottomColor: GROUP_COLORS[col.group], borderBottomWidth: 3 },
          ]}
        >
          <Text style={[styles.thText, { color: GROUP_COLORS[col.group] }]}>{col.label}</Text>
        </View>
      ))}
    </View>
  );

  const renderTableRow = (row: ReportRow, idx: number) => {
    const bg = idx % 2 === 0 ? dyn.tableRow : dyn.tableAlt;
    return (
      <View key={row.emp_id} style={[styles.tableRow, { backgroundColor: bg }]}>
        <View style={[styles.tdFixed, styles.thNo, { backgroundColor: bg }]}>
          <Text style={[styles.tdText, dyn.sub]}>{row.no}</Text>
        </View>
        <View style={[styles.tdFixed, styles.thEmpNo, { backgroundColor: bg }]}>
          <Text style={[styles.tdText, dyn.text]}>{row.emp_id}</Text>
        </View>
        <View style={[styles.tdFixed, styles.thName, { backgroundColor: bg }]}>
          <Text style={[styles.tdName, dyn.text]} numberOfLines={1}>{row.name}</Text>
        </View>
        <View style={[styles.tdFixed, styles.thPosition, { backgroundColor: bg }]}>
          <Text style={[styles.tdText, dyn.sub]} numberOfLines={2}>{row.position}</Text>
        </View>
        <View style={[styles.tdFixed, styles.thLocation, { backgroundColor: bg }]}>
          <Text style={[styles.tdText, dyn.sub]} numberOfLines={2}>{row.work_location}</Text>
        </View>
        {COLUMNS.map(col => {
          const val = (row as any)[col.key] as number;
          const highlight = val > 0;
          return (
            <View key={col.key} style={[styles.td, { backgroundColor: bg }]}>
              <Text style={[
                styles.tdText,
                highlight ? { color: GROUP_COLORS[col.group], fontWeight: '700' } : dyn.sub,
              ]}>
                {val}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, dyn.bg]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Attendance Report</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Employee */}
        <Text style={[styles.label, dyn.sub]}>Employee</Text>
        <TouchableOpacity
          style={[styles.inputContainer, dyn.input]}
          onPress={() => setEmpModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Ionicons name="people-outline" size={18} color={dyn.sub.color} />
            {empLoading
              ? <ActivityIndicator size="small" color="#F48B29" />
              : <Text style={[styles.inputText, dyn.text]}>
                  {selectedEmpIds.size === deptEmployees.length && deptEmployees.length > 0
                    ? `All (${deptEmployees.length}) Employees`
                    : selectedEmpIds.size === 0
                    ? 'No Employee Selected'
                    : `${selectedEmpIds.size} of ${deptEmployees.length} Selected`}
                </Text>
            }
          </View>
          <Feather name="chevron-down" size={20} color={dyn.sub.color} />
        </TouchableOpacity>

        {/* Work Location */}
        <Text style={[styles.label, dyn.sub]}>Work Location</Text>
        <View style={[styles.inputContainer, dyn.input]}>
          <Text style={[styles.inputText, dyn.text]}>Head Office</Text>
          <Feather name="chevron-down" size={20} color={dyn.sub.color} />
        </View>

        {/* Date Range */}
        <Text style={[styles.label, dyn.sub]}>Date Range</Text>
        <TouchableOpacity style={[styles.inputContainer, dyn.input]} onPress={() => setDateOptionModalVisible(true)} activeOpacity={0.7}>
          <Text style={[styles.inputText, dyn.text]}>{formatDate(startDate)} – {formatDate(endDate)}</Text>
          <Feather name="calendar" size={20} color={dyn.sub.color} />
        </TouchableOpacity>

        {/* Checkboxes */}
        <View style={styles.checkboxesContainer}>
          {[
            { label: 'Show Unknown Status', val: showUnknownStatus, set: setShowUnknownStatus },
            { label: 'Show Detail Location', val: showDetailLocation, set: setShowDetailLocation },
          ].map(({ label, val, set }) => (
            <TouchableOpacity key={label} style={styles.checkboxRow} onPress={() => set(!val)} activeOpacity={0.7}>
              <View style={[styles.checkboxSquare, {
                borderColor: val ? '#F48B29' : dyn.checkboxEmpty,
                backgroundColor: val ? '#F48B29' : 'transparent',
              }]}>
                {val && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={[styles.checkboxLabel, dyn.sub]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Generate Button */}
        <TouchableOpacity style={styles.generateBtn} onPress={fetchReport} activeOpacity={0.85} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <>
                <Feather name="bar-chart-2" size={18} color="#FFF" />
                <Text style={styles.generateBtnText}>Generate Report</Text>
              </>
          }
        </TouchableOpacity>

        {/* Download Button */}
        <TouchableOpacity
          style={[styles.downloadBtn, { opacity: report.length === 0 ? 0.5 : 1 }]}
          onPress={() => report.length > 0 ? setDownloadModalVisible(true) : null}
          activeOpacity={0.8}
        >
          <Text style={styles.downloadBtnText}>Download</Text>
          <Feather name="chevron-down" size={20} color="#FFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* ── Report Preview Table ── */}
        {report.length > 0 && (
          <View style={styles.tableWrapper}>
            {/* Meta */}
            <View style={styles.tableMeta}>
              <Text style={[styles.tableMetaTitle, dyn.text]}>Report Preview</Text>
              <Text style={[styles.tableMetaSub, dyn.sub]}>
                {formatDate(startDate)} – {formatDate(endDate)} · {report.length} employees
              </Text>
              {generated && <Text style={[dyn.sub, { fontSize: 11, marginTop: 2 }]}>Generated: {generated}</Text>}
            </View>

            {/* Horizontally scrollable table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
              <View>
                {renderTableHeader()}
                {report.map((row, idx) => renderTableRow(row, idx))}
              </View>
            </ScrollView>
          </View>
        )}

        {!loading && report.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={isDark ? '#555' : '#CBD5E1'} />
            <Text style={[styles.emptyText, dyn.sub]}>No report generated yet.</Text>
            <Text style={[styles.emptyHint, dyn.sub]}>Set your date range and tap Generate Report.</Text>
          </View>
        )}

      </ScrollView>

      {/* ── Employee List Modal (GreatDay-style full screen) ── */}
      <Modal visible={isEmpModalVisible} animationType="slide" onRequestClose={() => setEmpModalVisible(false)}>
        <SafeAreaView style={[{ flex: 1 }, dyn.bg]} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

          {/* Header */}
          <View style={[styles.empHeader, { borderBottomColor: dyn.input.borderColor }]}>
            <TouchableOpacity onPress={() => setEmpModalVisible(false)} style={styles.empHeaderBack}>
              <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
            </TouchableOpacity>
            <Text style={[styles.empHeaderTitle, dyn.text]}>Employee List</Text>
          </View>

          {/* Search bar */}
          <View style={styles.empSearchRow}>
            <View style={[styles.empSearchBox, dyn.input, { flex: 1 }]}>
              <Feather name="search" size={18} color={dyn.sub.color} />
              <TextInput
                style={[styles.empSearchInput, dyn.text]}
                placeholder="Search"
                placeholderTextColor={dyn.sub.color}
                value={empSearch}
                onChangeText={setEmpSearch}
              />
            </View>
            <TouchableOpacity style={[styles.empFilterBtn, dyn.input]}>
              <Feather name="sliders" size={20} color={dyn.sub.color} />
            </TouchableOpacity>
          </View>

          {/* Selectable Employee / Move All row */}
          <View style={styles.empSelectableRow}>
            <Text style={[styles.empSelectableLabel, dyn.sub]}>Selectable Employee</Text>
            <TouchableOpacity onPress={() => setSelectedEmpIds(new Set(deptEmployees.map(e => e.emp_id)))}>
              <Text style={styles.empMoveAll}>Move All</Text>
            </TouchableOpacity>
          </View>

          {/* Employee list */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {deptEmployees
              .filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()))
              .map(emp => {
                const isSelected = selectedEmpIds.has(emp.emp_id);
                // Get initials for avatar
                const parts = emp.name.trim().split(' ');
                const initials = parts.length >= 2
                  ? parts[0][0] + parts[parts.length - 1][0]
                  : parts[0]?.slice(0, 2) ?? '?';
                return (
                  <TouchableOpacity
                    key={emp.emp_id}
                    style={[
                      styles.empListRow,
                      { borderBottomColor: dyn.input.borderColor },
                      isSelected && { backgroundColor: isDark ? '#2A2A1A' : '#FFF8F0' },
                    ]}
                    onPress={() => {
                      const next = new Set(selectedEmpIds);
                      if (isSelected) next.delete(emp.emp_id);
                      else next.add(emp.emp_id);
                      setSelectedEmpIds(next);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Avatar */}
                    <View style={[styles.empAvatar, { backgroundColor: isSelected ? '#F48B29' : (isDark ? '#3A3A4A' : '#E2E8F0') }]}>
                      <Text style={[styles.empAvatarText, { color: isSelected ? '#FFF' : dyn.sub.color }]}>
                        {initials.toUpperCase()}
                      </Text>
                    </View>
                    {/* Name + sub */}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empListName, dyn.text]}>{emp.name.toUpperCase()}</Text>
                      <Text style={[styles.empListSub, dyn.sub]} numberOfLines={1}>
                        {emp.emp_id} - {emp.role}
                      </Text>
                    </View>
                    {/* Selection indicator */}
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#F48B29" />
                    )}
                  </TouchableOpacity>
                );
              })
            }
          </ScrollView>

          {/* Add Selected button */}
          <View style={styles.empAddRow}>
            <TouchableOpacity
              style={[styles.empAddBtn, { opacity: selectedEmpIds.size === 0 ? 0.5 : 1 }]}
              onPress={() => setEmpModalVisible(false)}
              disabled={selectedEmpIds.size === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.empAddBtnText}>
                Add Selected ({selectedEmpIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Custom Calendar Modal ── */}
      <Modal visible={pickerStep > 0} transparent animationType="fade" onRequestClose={() => setPickerStep(0)}>
        <View style={styles.centeredModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setPickerStep(0)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.calendarBox, dyn.card]}>
            <Text style={[styles.mTitle, dyn.text, { marginBottom: 12 }]}>
              {pickerStep === 1 ? 'Select Start Date' : 'Select End Date'}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setPickerStep(0)}>
                <Text style={[dyn.sub, { fontWeight: '600' }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[dyn.text, { fontWeight: 'bold' }]}>
                {pickerStep === 1 ? formatDate(startDate) : formatDate(endDate)}
              </Text>
            </View>

            {/* Nav */}
            <View style={styles.calendarHeader}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <TouchableOpacity onPress={() => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} style={styles.navBtn}>
                  <Feather name="chevrons-left" size={22} color={dyn.text.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={styles.navBtn}>
                  <Feather name="chevron-left" size={22} color={dyn.text.color} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.monthYearText, dyn.text]}>
                {viewDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <TouchableOpacity onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={styles.navBtn}>
                  <Feather name="chevron-right" size={22} color={dyn.text.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} style={styles.navBtn}>
                  <Feather name="chevrons-right" size={22} color={dyn.text.color} />
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
                  ? d.getTime() === startDate.getTime()
                  : d.getTime() === endDate.getTime();
                const isValid = pickerStep === 1 ? d <= endDate : d >= startDate;
                return (
                  <TouchableOpacity
                    key={i}
                    disabled={!isValid}
                    style={[styles.dayCell, isSel && { backgroundColor: '#F48B29' }, !isValid && { opacity: 0.2 }]}
                    onPress={() => handleDateChange({ type: 'set' }, d)}
                  >
                    <Text style={[styles.dayText, isSel ? { color: '#FFF' } : dyn.text]}>{i + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Date Range Selector Modal ── */}
      <Modal visible={isDateOptionModalVisible} transparent animationType="fade" onRequestClose={() => setDateOptionModalVisible(false)}>
        <View style={styles.centeredModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setDateOptionModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.centeredModalBox, dyn.card]}>
            <Text style={[styles.mTitle, dyn.text]}>Select Date to Edit</Text>
            <Text style={[styles.mSubtitle, dyn.sub]}>Which boundary of the date range do you want to modify?</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity style={[styles.dateOptionBtn, dyn.border]} onPress={() => pickSpecificDate(1)}>
                <Feather name="calendar" size={18} color="#FF8A00" />
                <Text style={[styles.dateOptionBtnText, dyn.text]}>Start Date</Text>
                <Text style={[dyn.sub, { fontSize: 12, marginTop: 4 }]}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dateOptionBtn, dyn.border]} onPress={() => pickSpecificDate(2)}>
                <Feather name="calendar" size={18} color="#FF8A00" />
                <Text style={[styles.dateOptionBtnText, dyn.text]}>End Date</Text>
                <Text style={[dyn.sub, { fontSize: 12, marginTop: 4 }]}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={() => setDateOptionModalVisible(false)}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Download Modal ── */}
      <Modal visible={isDownloadModalVisible} transparent animationType="slide" onRequestClose={() => setDownloadModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setDownloadModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.bottomSheet, dyn.card]}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetContent}>
              <TouchableOpacity
                style={[styles.sheetItem, { borderBottomColor: dyn.input.borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={exportCSV}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="file-excel" size={26} color="#34A853" style={styles.sheetIcon} />
                <Text style={[styles.sheetItemText, dyn.text]}>Download as Excel (CSV)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetItem, { borderBottomColor: dyn.input.borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}
                onPress={() => {
                  setDownloadModalVisible(false);
                  showAlert({ type: 'info', title: 'Coming Soon', message: 'Send to Email feature will be available soon.' });
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="email-outline" size={26} color={dyn.sub.color} style={styles.sheetIcon} />
                <Text style={[styles.sheetItemText, dyn.text]}>Send to Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        {...alertConfig}
        onClose={hideAlert}
        onConfirm={alertConfig.onClose || alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 14 },
  backBtn:     { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  // Content
  content: { padding: 20, paddingTop: 10, paddingBottom: 60 },
  label:   { fontSize: 13, fontWeight: '500', marginBottom: 8 },

  // Inputs
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
  },
  inputText: { fontSize: 15 },

  // Checkboxes
  checkboxesContainer: { marginTop: 4, marginBottom: 24, gap: 16 },
  checkboxRow:  { flexDirection: 'row', alignItems: 'center' },
  checkboxSquare: {
    width: 20, height: 20, borderWidth: 1.5, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxLabel: { marginLeft: 12, fontSize: 14 },

  // Buttons
  generateBtn: {
    backgroundColor: '#2563EB', flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 14, borderRadius: 8, gap: 8, marginBottom: 12,
  },
  generateBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  downloadBtn: {
    backgroundColor: '#F48B29', flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 13, borderRadius: 8, marginBottom: 24,
  },
  downloadBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // Table
  tableWrapper: { marginTop: 4 },
  tableMeta:    { marginBottom: 12 },
  tableMetaTitle: { fontSize: 16, fontWeight: '700' },
  tableMetaSub:   { fontSize: 13, marginTop: 2 },
  tableScroll:    { borderRadius: 10, overflow: 'hidden' },

  tableHeaderRow: { flexDirection: 'row' },
  tableRow:       { flexDirection: 'row' },

  thFixed: { justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tdFixed: { justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },

  thNo:   { width: 44 },
  thEmpNo:{ width: 70 },
  thName: { width: 140 },
  thPosition: { width: 130 },
  thLocation: { width: 100 },

  td: {
    width: 90, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0',
  },
  thText: { fontSize: 11, fontWeight: '700', textAlign: 'center', flexWrap: 'wrap' },
  tdText: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  tdName: { fontSize: 13, fontWeight: '600' },
  tdSub:  { fontSize: 11, marginTop: 2 },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  emptyText:  { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyHint:  { fontSize: 13, marginTop: 6, textAlign: 'center', maxWidth: 260 },

  // Calendar Modal
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

  // Date Range Selector Modal
  centeredModalBox: {
    width: '100%', maxWidth: 340, borderRadius: 16, padding: 24,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
  mTitle:    { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  mSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  dateOptionBtn:     { flex: 1, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
  dateOptionBtnText: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  cancelActionBtn:   { marginTop: 16, padding: 12, alignItems: 'center' },
  cancelActionText:  { fontSize: 15, fontWeight: '600', color: '#94a3b8' },

  // Download Sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet:  { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 40 },
  dragHandle:   { width: 40, height: 4, backgroundColor: '#CCC', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  sheetContent: { paddingHorizontal: 20 },
  sheetItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  sheetIcon:    { marginRight: 16, width: 28, textAlign: 'center' },
  sheetItemText:{ fontSize: 15, fontWeight: '500' },

  // Employee List Modal (GreatDay style)
  empHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empHeaderBack: { padding: 4, marginRight: 12 },
  empHeaderTitle: { fontSize: 20, fontWeight: '700' },

  empSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  empSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  empSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  empFilterBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empSelectableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  empSelectableLabel: { fontSize: 13, fontWeight: '500' },
  empMoveAll: { fontSize: 13, fontWeight: '700', color: '#F48B29' },

  empListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  empAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: { fontSize: 16, fontWeight: '700' },
  empListName:  { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  empListSub:   { fontSize: 12, marginTop: 3 },

  empAddRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'flex-end',
  },
  empAddBtn: {
    backgroundColor: '#F48B29',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  empAddBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});


