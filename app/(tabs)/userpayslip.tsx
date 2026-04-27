import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export default function UserPayslip() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [showDetails, setShowDetails] = useState(false);

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    iconBg: { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dyn.text]}>My Payslip</Text>
        <TouchableOpacity style={styles.iconBtn}>
           <Ionicons name="download-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* SUMMARY CARD - Fixed to use Theme Colors */}
        <View style={[styles.summaryCard, dyn.card]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>TOTAL NET PAY</Text>
                <FontAwesome5 name="sim-card" size={24} color="#F27121" />
            </View>
            {/* Added dyn.text to override hardcoded white */}
            <Text style={[styles.netPay, dyn.text]}>₱ 8,500.00</Text>
            <View style={styles.cardFooter}>
                <View>
                    <Text style={styles.periodLabel}>PAY PERIOD</Text>
                    {/* Added dyn.text to override hardcoded gray */}
                    <Text style={[styles.periodDate, dyn.text]}>Jan 16 - Jan 31, 2026</Text>
                </View>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>CREDITED</Text>
                </View>
            </View>
        </View>

        <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowDetails(!showDetails)}>
            <Text style={styles.toggleText}>{showDetails ? "HIDE BREAKDOWN" : "VIEW BREAKDOWN"}</Text>
            <Ionicons name={showDetails ? "chevron-up" : "chevron-down"} size={20} color="#F27121" />
        </TouchableOpacity>

        {showDetails && (
            <View style={[styles.detailsContainer, dyn.card]}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>EARNINGS</Text>
                    <View style={styles.row}><Text style={dyn.sub}>Basic Pay</Text><Text style={[styles.rowValue, dyn.text]}>₱ 9,000.00</Text></View>
                    <View style={styles.row}><Text style={dyn.sub}>Overtime (4 hrs)</Text><Text style={[styles.rowValue, dyn.text]}>₱ 540.00</Text></View>
                    <View style={[styles.row, styles.totalRow, { borderTopColor: colors.border }]}><Text style={[styles.totalLabel, dyn.text]}>Gross Pay</Text><Text style={[styles.totalValue, dyn.text]}>₱ 10,540.00</Text></View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#C0392B' }]}>DEDUCTIONS</Text>
                    <View style={styles.row}><Text style={dyn.sub}>SSS</Text><Text style={[styles.rowValue, dyn.text]}>- ₱ 580.00</Text></View>
                    <View style={styles.row}><Text style={dyn.sub}>Tax</Text><Text style={[styles.rowValue, dyn.text]}>- ₱ 960.00</Text></View>
                    <View style={[styles.row, styles.totalRow, { borderTopColor: colors.border }]}><Text style={[styles.totalLabel, dyn.text]}>Total Deductions</Text><Text style={[styles.totalValue, { color: '#C0392B' }]}>- ₱ 2,040.00</Text></View>
                </View>
            </View>
        )}

        <Text style={[styles.historyTitle, dyn.sub]}>RECENT SLIPS</Text>
        
        {['Jan 01 - Jan 15, 2026', 'Dec 16 - Dec 31, 2025'].map((date, i) => (
            <TouchableOpacity key={i} style={[styles.historyItem, dyn.card]}>
                <View style={[styles.iconBox, dyn.iconBg]}>
                    <FontAwesome5 name="file-invoice" size={20} color={colors.subText} />
                </View>
                <View style={styles.historyInfo}>
                    <Text style={[styles.historyDate, dyn.text]}>{date}</Text>
                    <Text style={[styles.historyAmount, dyn.sub]}>₱ 8,500.00</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.subText} />
            </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  iconBtn: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.04)' },
  content: { padding: 24, paddingBottom: 120 },
  summaryCard: {
    borderRadius: 28,
    padding: 28,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#F27121',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    borderTopWidth: 4,
    borderTopColor: '#F27121',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardLabel: { color: '#888', fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  netPay: { fontSize: 38, fontWeight: '800', marginBottom: 20, letterSpacing: -1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  periodLabel: { color: '#888', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  periodDate: { fontSize: 14, fontWeight: '600' },
  statusBadge: { backgroundColor: '#27AE60', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  toggleBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, marginBottom: 20, gap: 6 },
  toggleText: { color: '#F27121', fontWeight: '800', fontSize: 14 },
  detailsContainer: { borderRadius: 28, padding: 24, marginBottom: 30, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12 },
  section: { marginBottom: 25 },
  sectionTitle: { color: '#27AE60', fontSize: 11, fontWeight: '800', marginBottom: 16, letterSpacing: 1.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 6 },
  totalLabel: { fontWeight: '700', fontSize: 15 },
  totalValue: { fontWeight: '800', fontSize: 16 },
  historyTitle: { fontSize: 11, fontWeight: '800', marginBottom: 16, letterSpacing: 1.5, opacity: 0.5 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 28,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  historyInfo: { flex: 1 },
  historyDate: { fontWeight: '700', fontSize: 15 },
  historyAmount: { fontSize: 13, opacity: 0.6, marginTop: 3 },
});