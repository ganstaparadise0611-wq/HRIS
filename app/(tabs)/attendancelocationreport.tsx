import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from './ThemeContext';
import CustomAlert from '../../components/CustomAlert';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { getBackendUrl } from '../../constants/backend-config';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DeptEmployee {
  emp_id: number;
  name: string;
  role: string;
}

interface LocationRow {
  no: number;
  emp_id: number;
  emp_number: string;
  name: string;
  date: string;
  date_raw: string;
  timein: string | null;
  timeout: string | null;
  actual_radius_in: string;
  actual_radius_out: string;
  coords_in: string;
  coords_out: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AttendanceLocationReportScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const dyn = {
    bg:     { backgroundColor: colors.background },
    text:   { color: colors.text },
    sub:    { color: isDark ? '#AAA' : '#666' },
    card:   { backgroundColor: colors.card },
    border: { borderColor: colors.border },
    input:  { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? '#444' : '#D1D1D6' },
  };

  // ── State ───────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);

  const now = new Date();
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [endDate,   setEndDate]   = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [pickerStep, setPickerStep] = useState<0 | 1 | 2>(0);
  const [viewDate,   setViewDate]   = useState(new Date());

  const [isDateOptionModalVisible, setDateOptionModalVisible] = useState(false);
  const [isEmpModalVisible,        setEmpModalVisible]        = useState(false);
  const [isRecordsModalVisible,    setRecordsModalVisible]    = useState(false);

  const [deptEmployees,  setDeptEmployees]  = useState<DeptEmployee[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<number>>(new Set());
  const [empSearch,      setEmpSearch]      = useState('');
  const [empLoading,     setEmpLoading]     = useState(false);

  const [report,      setReport]      = useState<LocationRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewed,   setPreviewed]   = useState(false);  // true once Preview clicked
  const [isMapModalVisible, setMapModalVisible] = useState(false);

  const { visible: alertVisible, config: alertConfig, showAlert, hideAlert } = useCustomAlert();

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => {
      setUserId(id);
      if (id) loadDeptEmployees(id);
    });
  }, []);

  // Reset preview state whenever filters change
  useEffect(() => {
    setPreviewed(false);
    setReport([]);
    setMapModalVisible(false);
  }, [startDate, endDate, selectedEmpIds]);

  const loadDeptEmployees = async (uid: string) => {
    setEmpLoading(true);
    try {
      const base = getBackendUrl();
      const res  = await fetch(`${base}/get-department-employees.php?user_id=${uid}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.employees)) {
        setDeptEmployees(json.employees);
        setSelectedEmpIds(new Set());
      } else {
        showAlert({ type: 'error', title: 'Error', message: json.message || 'Failed to load employees from server.' });
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Network Error', message: `Could not connect to server: ${e.message}` });
    } finally {
      setEmpLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const toISODate = (d: Date) => d.toISOString().slice(0, 10);

  const empLabel = empLoading
    ? 'Loading…'
    : selectedEmpIds.size === 0
      ? 'No Employee Selected'
      : selectedEmpIds.size === deptEmployees.length && deptEmployees.length > 0
        ? `All (${deptEmployees.length}) Employees`
        : `${selectedEmpIds.size} Selected`;

  // ── Fetch Report ─────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async (): Promise<LocationRow[] | null> => {
    if (!userId) {
      showAlert({ type: 'warning', title: 'Not Logged In', message: 'Please log in first.' });
      return null;
    }
    if (selectedEmpIds.size === 0) {
      showAlert({ type: 'warning', title: 'No Employee Selected', message: 'Please select at least one employee.' });
      return null;
    }
    setLoading(true);
    try {
      const base = getBackendUrl();
      const ids  = Array.from(selectedEmpIds).join(',');
      const url  = `${base}/attendance-location-report.php?user_id=${userId}&emp_ids=${ids}&start_date=${toISODate(startDate)}&end_date=${toISODate(endDate)}`;
      const res  = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      const json = await res.json();
      if (json.ok) {
        const rows: LocationRow[] = json.report ?? [];
        setReport(rows);
        return rows;
      } else {
        setReport([]);
        showAlert({ type: 'error', title: 'Failed', message: json.message ?? 'Could not load report.' });
        return null;
      }
    } catch (e: any) {
      setReport([]);
      showAlert({ type: 'error', title: 'Network Error', message: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, selectedEmpIds]);

  // ── Handle Preview Button ─────────────────────────────────────────────────
  const handlePreview = async () => {
    setMapModalVisible(false);
    const rows = await fetchReport();
    if (rows !== null) {
      setPreviewed(true);
    }
  };

  // ── Generate & Download PDF ──────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      let rows = await fetchReport();
      if (!rows || rows.length === 0) {
        showAlert({ type: 'warning', title: 'No Data', message: 'No attendance records found for the selected range.' });
        return;
      }

      const html = buildPdfHtml(rows, startDate, endDate);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const fileName = `AttendanceLocationReport_${toISODate(startDate)}_${toISODate(endDate)}.pdf`;
      const destUri  = (FileSystem.documentDirectory ?? '') + fileName;
      await FileSystem.copyAsync({ from: uri, to: destUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Download Attendance Location Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        showAlert({ type: 'info', title: 'PDF Saved', message: `Saved to: ${destUri}` });
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Download Failed', message: e.message });
    } finally {
      setDownloading(false);
    }
  };

  // ── Build Map HTML ────────────────────────────────────────────────────────────
  const buildMapHtml = (rows: LocationRow[]): string => {
    const pins: { lat: number; lng: number; label: string; color: string }[] = [];

    // Office pin
    pins.push({ lat: 14.613002, lng: 120.9935661, label: 'Office (TDT PowerSteel)', color: '#4CAF50' });

    rows.forEach(r => {
      if (r.coords_in !== 'No Data') {
        const [lat, lng] = r.coords_in.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          pins.push({ lat, lng, label: `${r.name} – IN (${r.date})`, color: '#3B82F6' });
        }
      }
      if (r.coords_out !== 'No Data') {
        const [lat, lng] = r.coords_out.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          pins.push({ lat, lng, label: `${r.name} – OUT (${r.date})`, color: '#EF4444' });
        }
      }
    });

    const center = pins.length > 1 ? pins[1] : pins[0];
    const markersJs = pins.map((p, i) => `
      var m${i} = L.marker([${p.lat}, ${p.lng}], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:${p.color};width:${i === 0 ? 18 : 14}px;height:${i === 0 ? 18 : 14}px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>',
          iconSize: [${i === 0 ? 18 : 14}, ${i === 0 ? 18 : 14}],
          iconAnchor: [${i === 0 ? 9 : 7}, ${i === 0 ? 9 : 7}]
        })
      }).addTo(map).bindPopup('${p.label.replace(/'/g, "\\'")}');
    `).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    .legend { position: absolute; bottom: 20px; left: 10px; background: white; border-radius: 8px; padding: 8px 12px; font-size: 11px; z-index: 1000; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
    .legend-item { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="legend">
    <div class="legend-item"><div class="dot" style="background:#4CAF50"></div> Office</div>
    <div class="legend-item"><div class="dot" style="background:#3B82F6"></div> Clock In</div>
    <div class="legend-item"><div class="dot" style="background:#EF4444"></div> Clock Out</div>
  </div>
  <script>
    var map = L.map('map').setView([${center.lat}, ${center.lng}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    ${markersJs}
  </script>
</body>
</html>`;
  };

  // ── PDF HTML Builder ─────────────────────────────────────────────────────────
  const buildPdfHtml = (rows: LocationRow[], start: Date, end: Date): string => {
    const logoObj = require('../../assets/images/NEW_LOGO.png');
    const logoUri = Image.resolveAssetSource(logoObj).uri;

    const tableRows = rows.map(r => `
      <tr>
        <td>${r.no}</td>
        <td>${escHtml(r.emp_number)}</td>
        <td>${escHtml(r.name)}</td>
        <td>${escHtml(r.date)}</td>
        <td>${escHtml(r.coords_in)}</td>
        <td>${escHtml(r.actual_radius_in)}</td>
        <td>${escHtml(r.coords_out)}</td>
        <td>${escHtml(r.actual_radius_out)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 30px; }
    .header-container { text-align: center; margin-bottom: 20px; }
    .logo { width: 220px; height: 220px; object-fit: contain; margin-bottom: 5px; }
    h2 { font-size: 15px; margin: 0; margin-bottom: 4px; }
    .sub { font-size: 11px; color: #555; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #4a4a4a; color: #fff; padding: 5px 7px; text-align: left; font-size: 10px; }
    td { padding: 4px 7px; border: 1px solid #ccc; font-size: 10px; }
    tr:nth-child(even) td { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header-container">
    <img src="${logoUri}" alt="Logo" class="logo" />
    <h2>TDT PowerSteel Corporation</h2>
    <h2>Attendance Location Report</h2>
    <p class="sub">${formatDate(start)} – ${formatDate(end)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>Emp No.</th>
        <th>Employee Name</th>
        <th>Date</th>
        <th>Coords In</th>
        <th>Actual Radius In</th>
        <th>Coords Out</th>
        <th>Actual Radius Out</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;
  };

  const escHtml = (s: string): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ── Date Picker ──────────────────────────────────────────────────────────────
  const handleDateChange = (_event: any, selectedDate?: Date, step?: 1 | 2) => {
    const target = step ?? pickerStep;
    setPickerStep(0);
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    if (target === 1) {
      if (d > endDate) {
        showAlert({ type: 'warning', title: 'Invalid Date', message: 'Start date cannot be after end date.' });
      } else {
        setStartDate(d);
      }
    } else {
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

  const mapHtml = previewed && report.length > 0 ? buildMapHtml(report) : '';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, dyn.bg]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>Attendance Location Report</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Employee ── */}
        <Text style={[styles.label, dyn.sub]}>Employee</Text>
        <TouchableOpacity
          style={[styles.inputContainer, dyn.input]}
          onPress={() => setEmpModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.inputText, dyn.text]}>{empLabel}</Text>
          <Ionicons name="people-outline" size={20} color={dyn.sub.color} />
        </TouchableOpacity>

        {/* ── Date Range ── */}
        <Text style={[styles.label, dyn.sub]}>Date Range</Text>
        <TouchableOpacity
          style={[styles.inputContainer, dyn.input]}
          onPress={() => setDateOptionModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.inputText, dyn.text]}>
            {formatDate(startDate)} - {formatDate(endDate)}
          </Text>
          <Feather name="calendar" size={20} color={dyn.sub.color} />
        </TouchableOpacity>

        {/* ── Preview Button ── */}
        <TouchableOpacity
          style={[styles.previewBtn, loading && { opacity: 0.7 }]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <>
                <Feather name="eye" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.previewBtnText}>Preview</Text>
              </>
          }
        </TouchableOpacity>

        {/* ── Action Buttons (appear after preview) ── */}
        {previewed && (
          <View style={styles.actionRow}>
            {/* View Records */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? '#2D2D44' : '#F1F5F9' }]}
              onPress={() => setRecordsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="list" size={18} color="#F48B29" />
              <Text style={[styles.actionBtnText, dyn.text]}>View Records</Text>
              {report.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{report.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* View Map */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? '#2D2D44' : '#F1F5F9' }]}
              onPress={() => setMapModalVisible(true)}
              activeOpacity={0.8}
            >
              <Feather name="map-pin" size={18} color="#F48B29" />
              <Text style={[styles.actionBtnText, dyn.text]}>View Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Download Button (only shown after preview) ── */}
        {previewed && (
          <TouchableOpacity
            style={[styles.downloadBtn, downloading && { opacity: 0.7 }]}
            onPress={handleDownload}
            activeOpacity={0.85}
            disabled={downloading}
          >
            {downloading
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Feather name="download" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.downloadBtnText}>Download PDF</Text>
                </>
            }
          </TouchableOpacity>
        )}


      </ScrollView>

      {/* ── Map Modal ── */}
      <Modal visible={isMapModalVisible} animationType="slide" onRequestClose={() => setMapModalVisible(false)}>
        <SafeAreaView style={[{ flex: 1 }, dyn.bg]} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.empHeader, { borderBottomColor: dyn.input.borderColor }]}>
            <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.empHeaderBack}>
              <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.empHeaderTitle, dyn.text]}>Location Map</Text>
              <Text style={[{ fontSize: 12 }, dyn.sub]}>🔵 Clock In · 🔴 Clock Out · 🟢 Office</Text>
            </View>
          </View>
          {report.some(r => r.coords_in !== 'No Data' || r.coords_out !== 'No Data') ? (
            <WebView
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentMode="always"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <Feather name="map-pin" size={48} color={dyn.sub.color} />
              <Text style={[{ marginTop: 16, fontSize: 16, textAlign: 'center' }, dyn.sub]}>
                No coordinates available for this date range.{`\n`}Clock in from the mobile app to capture location data.
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Records Modal ── */}
      <Modal visible={isRecordsModalVisible} animationType="slide" onRequestClose={() => setRecordsModalVisible(false)}>
        <SafeAreaView style={[{ flex: 1 }, dyn.bg]} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

          <View style={[styles.empHeader, { borderBottomColor: dyn.input.borderColor }]}>
            <TouchableOpacity onPress={() => setRecordsModalVisible(false)} style={styles.empHeaderBack}>
              <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.empHeaderTitle, dyn.text]}>Attendance Records</Text>
              <Text style={[{ fontSize: 12 }, dyn.sub]}>{formatDate(startDate)} – {formatDate(endDate)} · {report.length} records</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Table Header */}
                <View style={[styles.tableHeaderRow, { backgroundColor: isDark ? '#2D2D44' : '#E2E8F0' }]}>
                  {['No.', 'Emp No.', 'Employee Name', 'Date', 'Coords In', 'Radius In', 'Coords Out', 'Radius Out'].map(h => (
                    <View key={h} style={[styles.th, (h === 'Employee Name' || h.includes('Coords')) && styles.thWide]}>
                      <Text style={[styles.thText, { color: isDark ? '#FFF' : '#1E293B' }]}>{h}</Text>
                    </View>
                  ))}
                </View>
                {/* Table Rows */}
                {report.map((row, idx) => {
                  const bg = idx % 2 === 0
                    ? (isDark ? '#1E1E30' : '#FFF')
                    : (isDark ? '#252540' : '#F8FAFC');
                  return (
                    <View key={`${row.emp_id}-${row.date_raw}-${idx}`} style={[styles.tableRow, { backgroundColor: bg }]}>
                      <View style={styles.th}><Text style={[styles.tdText, dyn.sub]}>{row.no}</Text></View>
                      <View style={styles.th}><Text style={[styles.tdText, dyn.text]}>{row.emp_number}</Text></View>
                      <View style={[styles.th, styles.thWide]}><Text style={[styles.tdText, dyn.text]} numberOfLines={2}>{row.name}</Text></View>
                      <View style={styles.th}><Text style={[styles.tdText, dyn.text]}>{row.date}</Text></View>
                      <View style={[styles.th, styles.thWide]}>
                        {row.coords_in === 'No Data' ? (
                          <Text style={[styles.tdText, dyn.sub]}>{row.coords_in}</Text>
                        ) : (
                          <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.coords_in)}`)}>
                            <Text style={[styles.tdText, { color: '#3B82F6', textDecorationLine: 'underline' }]}>{row.coords_in}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.th}>
                        <Text style={[styles.tdText, row.actual_radius_in === 'No Data' ? dyn.sub : dyn.text]}>
                          {row.actual_radius_in}
                        </Text>
                      </View>
                      <View style={[styles.th, styles.thWide]}>
                        {row.coords_out === 'No Data' ? (
                          <Text style={[styles.tdText, dyn.sub]}>{row.coords_out}</Text>
                        ) : (
                          <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.coords_out)}`)}>
                            <Text style={[styles.tdText, { color: '#3B82F6', textDecorationLine: 'underline' }]}>{row.coords_out}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.th}>
                        <Text style={[styles.tdText, row.actual_radius_out === 'No Data' ? dyn.sub : dyn.text]}>
                          {row.actual_radius_out}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Employee List Modal ── */}
      <Modal visible={isEmpModalVisible} animationType="slide" onRequestClose={() => setEmpModalVisible(false)}>
        <SafeAreaView style={[{ flex: 1 }, dyn.bg]} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.empHeader, { borderBottomColor: dyn.input.borderColor }]}>
            <TouchableOpacity onPress={() => setEmpModalVisible(false)} style={styles.empHeaderBack}>
              <Ionicons name="arrow-back" size={24} color={dyn.text.color} />
            </TouchableOpacity>
            <Text style={[styles.empHeaderTitle, dyn.text]}>Employee List</Text>
          </View>
          <View style={styles.empSearchRow}>
            <View style={[styles.empSearchBox, dyn.input, { flex: 1 }]}>
              <Feather name="search" size={18} color={dyn.sub.color} />
              <TextInput
                style={[styles.empSearchInput, dyn.text]}
                placeholder="Search employee"
                placeholderTextColor={dyn.sub.color}
                value={empSearch}
                onChangeText={setEmpSearch}
              />
            </View>
          </View>
          <View style={styles.empSelectableRow}>
            <Text style={[styles.empSelectableLabel, dyn.sub]}>
              {deptEmployees.length} employees in your department
            </Text>
            <TouchableOpacity onPress={() => setSelectedEmpIds(new Set(deptEmployees.map(e => e.emp_id)))}>
              <Text style={styles.empMoveAll}>Select All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {deptEmployees
              .filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()))
              .map(emp => {
                const isSelected = selectedEmpIds.has(emp.emp_id);
                const parts    = emp.name.trim().split(' ');
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
                    <View style={[styles.empAvatar, { backgroundColor: isSelected ? '#F48B29' : (isDark ? '#3A3A4A' : '#E2E8F0') }]}>
                      <Text style={[styles.empAvatarText, { color: isSelected ? '#FFF' : dyn.sub.color }]}>
                        {initials.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empListName, dyn.text]}>{emp.name.toUpperCase()}</Text>
                      <Text style={[styles.empListSub, dyn.sub]} numberOfLines={1}>
                        {emp.emp_id} · {emp.role}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#F48B29" />}
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
          <View style={styles.empAddRow}>
            <TouchableOpacity
              style={[styles.empAddBtn, { opacity: selectedEmpIds.size === 0 ? 0.5 : 1 }]}
              onPress={() => setEmpModalVisible(false)}
              disabled={selectedEmpIds.size === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.empAddBtnText}>Confirm ({selectedEmpIds.size})</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
                <Feather name="calendar" size={18} color="#F48B29" />
                <Text style={[styles.dateOptionBtnText, dyn.text]}>Start Date</Text>
                <Text style={[dyn.sub, { fontSize: 12, marginTop: 4 }]}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dateOptionBtn, dyn.border]} onPress={() => pickSpecificDate(2)}>
                <Feather name="calendar" size={18} color="#F48B29" />
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
                    onPress={() => handleDateChange({}, d, pickerStep as 1 | 2)}
                  >
                    <Text style={[styles.dayText, isSel ? { color: '#FFF' } : dyn.text]}>{i + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

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

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 14 },
  backBtn:     { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  content: { padding: 20, paddingTop: 10, paddingBottom: 60 },
  label:   { fontSize: 13, fontWeight: '500', marginBottom: 8 },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 20,
  },
  inputText: { fontSize: 15, flex: 1 },

  // Preview Button
  previewBtn: {
    backgroundColor: '#F48B29', flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 14, borderRadius: 8, marginBottom: 16,
  },
  previewBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Action Buttons Row
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, gap: 8,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  badge: { backgroundColor: '#F48B29', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Download Button
  downloadBtn: {
    backgroundColor: '#1E293B', flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 14, borderRadius: 8, marginBottom: 24,
  },
  downloadBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Map
  mapContainer: { marginTop: 4, borderRadius: 12, overflow: 'hidden' },
  mapTitle:     { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  mapSub:       { fontSize: 12, marginBottom: 10 },
  mapWebView:   { width: SCREEN_W - 40, height: 340, borderRadius: 12 },
  mapEmpty:     { height: 180, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 20 },

  // Table
  tableHeaderRow: { flexDirection: 'row' },
  tableRow:       { flexDirection: 'row' },
  th: {
    width: 100, paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0',
    justifyContent: 'center',
  },
  thWide: { width: 160 },
  thText: { fontSize: 11, fontWeight: '700' },
  tdText: { fontSize: 12, fontWeight: '500' },

  // Calendar Modal
  centeredModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
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
  navBtn:        { padding: 4 },
  weekDaysRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDayText:   { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  daysGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:       { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginVertical: 3 },
  dayText:       { fontSize: 14, fontWeight: '500' },

  centeredModalBox: {
    width: '100%', maxWidth: 340, borderRadius: 16, padding: 24,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
  mTitle:            { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  mSubtitle:         { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  dateOptionBtn:     { flex: 1, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
  dateOptionBtnText: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  cancelActionBtn:   { marginTop: 16, padding: 12, alignItems: 'center' },
  cancelActionText:  { fontSize: 15, fontWeight: '600', color: '#94a3b8' },

  // Employee Modal
  empHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empHeaderBack:  { padding: 4, marginRight: 12 },
  empHeaderTitle: { fontSize: 20, fontWeight: '700' },

  empSearchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  empSearchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, gap: 8,
  },
  empSearchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  empSelectableRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  empSelectableLabel: { fontSize: 13, fontWeight: '500' },
  empMoveAll:         { fontSize: 13, fontWeight: '700', color: '#F48B29' },

  empListRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 14,
  },
  empAvatar:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  empAvatarText: { fontSize: 16, fontWeight: '700' },
  empListName:   { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  empListSub:    { fontSize: 12, marginTop: 3 },

  empAddRow: { paddingHorizontal: 20, paddingVertical: 16, alignItems: 'flex-end' },
  empAddBtn: { backgroundColor: '#F48B29', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 14 },
  empAddBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
