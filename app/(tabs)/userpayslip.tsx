import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

interface AttendanceRow { date: string; timein: string|null; timeout: string|null; status: string; lateH: number; utH: number; }
interface DeductionItem { label: string; amount: number; }
interface Payslip {
  emp_id: number; emp_name: string; position: string; department: string;
  pay_period: { start: string; end: string }; hourly_rate: number;
  working_days: number; basic_pay: number; overtime_pay: number; overtime_hours: number; gross_pay: number;
  deductions: DeductionItem[]; total_deductions: number;
  late_hours: number; undertime_hours: number; late_ut_deduction: number; net_pay: number;
  attendance: AttendanceRow[];
}

const fmt = (n: number) => '₱ ' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtH = (h: number) => `${h.toFixed(2)}h`;

const fmtDate = (d: Date) => d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function buildPdf(ps: Payslip, period: string, logoB64?: string): string {
  const logoSrc = logoB64
    ? `data:image/png;base64,${logoB64}`
    : null;
  const dow = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const aRows = ps.attendance.map(a => {
    const day = dow[(new Date(a.date).getDay()+6)%7]??'';
    const p = a.lateH>0||a.utH>0;
    return `<tr${p?' class="pr"':''}><td>${a.date}</td><td>${day}</td><td>${a.timein??'—'}</td><td>${a.timeout??'—'}</td><td>${a.status}</td><td>${a.lateH>0?`<b style="color:#8b0000">${fmtH(a.lateH)}</b>`:'—'}</td><td>${a.utH>0?`<b style="color:#8b0000">${fmtH(a.utH)}</b>`:'—'}</td></tr>`;
  }).join('');
  const today = new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'});
  const tardinessMins = Math.round((ps.late_hours + ps.undertime_hours) * 60);
  const getSS  = (label: string) => ps.deductions.find(d => d.label === label)?.amount ?? 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#333;padding:28px 32px;background:#fff}
.slip-lbl{font-size:16px;font-weight:900;color:#1a5fa8;margin-bottom:6px}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.logo-img{height:54px;object-fit:contain}
.logo-tdt{font-size:22px;font-weight:900;color:#1a5fa8;letter-spacing:2px;line-height:1}
.logo-power{font-size:11px;font-weight:900;letter-spacing:2px}
.logo-power span{color:#f47920}.logo-power b{color:#1a1a1a}
.logo-sub{font-size:7px;color:#888;letter-spacing:.5px;margin-top:1px}
.co-name{font-size:24px;font-weight:900;color:#1a1a1a;text-align:right}
.co-addr{font-size:10px;color:#555;text-align:right;margin-top:4px}
hr{border:none;border-top:1.5px solid #ccc;margin:12px 0}
.igrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 20px;margin-bottom:18px}
.ib{display:flex;flex-direction:column;gap:2px}
.il{font-size:9px;color:#1a5fa8;font-weight:600}
.iv{font-size:11px;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px;min-height:16px}
.tables{display:flex;gap:16px;margin-bottom:14px}
.box{flex:1;border:1px solid #555;padding:10px 12px}
.bttl{font-size:12px;font-weight:900;color:#1a1a1a;margin-bottom:8px}
.bt{width:100%;border-collapse:collapse}
.bt td{padding:3px 4px;font-size:10.5px}
.bt td:last-child{text-align:right}
.bt .hi{color:#f47920}
.dr td{border-top:1.5px solid #555;padding-top:6px;font-weight:800;font-size:11px}
.net{border:1px solid #555;padding:10px 16px;text-align:center;font-size:13px;font-weight:900;margin-bottom:16px}
.ah{font-size:9px;font-weight:800;text-transform:uppercase;color:#888;margin:14px 0 6px}
.at{width:100%;border-collapse:collapse;border:1px solid #ccc;font-size:10px}
.at th{background:#f5f5f5;padding:4px 7px;border:1px solid #ccc;font-size:9px;font-weight:800;text-transform:uppercase;color:#555}
.at td{padding:4px 7px;border:1px solid #eee}
.pr{background:#fff0ee}
.sr{display:flex;gap:28px;margin-top:32px}
.sb{flex:1;text-align:center}
.sl{border-top:1px solid #333;margin-bottom:4px;margin-top:32px}
.slb{font-size:9px;color:#555;text-transform:uppercase}
.ft{margin-top:14px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:8px;color:#aaa}
</style></head><body>
<div class="slip-lbl">Payslip</div>
<div class="hdr">
  <div>
    ${logoSrc
      ? `<img src="${logoSrc}" class="logo-img" alt="TDT PowerSteel Logo"/>`
      : `<div class="logo-tdt">TDT</div><div class="logo-power"><span>POWER</span><b>STEEL</b></div><div class="logo-sub">THE NO.1 STEEL SUPPLIER</div>`
    }
  </div>
  <div>
    <div class="co-name">TDT Powersteel Corp.</div>
    <div class="co-addr">1017 - A, 2/F Vicente Cruz St., Sampaloc, Zone 047, Brgy. 476, Manila</div>
  </div>
</div>
<hr/>
<div class="igrid">
  <div class="ib"><span class="il">Name</span><span class="iv">${ps.emp_name}</span></div>
  <div class="ib"><span class="il">Payroll Date</span><span class="iv">${today}</span></div>
  <div class="ib"><span class="il">Date Covered</span><span class="iv">${period}</span></div>
  <div class="ib"><span class="il">Position</span><span class="iv">${ps.position}</span></div>
  <div class="ib"><span class="il">SSS No.</span><span class="iv"></span></div>
  <div class="ib"><span class="il">Tax Ref No.</span><span class="iv"></span></div>
  <div class="ib"><span class="il">Department</span><span class="iv">${ps.department}</span></div>
  <div class="ib"><span class="il">Employment Status</span><span class="iv">Regular</span></div>
  <div class="ib"></div>
  <div class="ib"><span class="il">Cost Center</span><span class="iv"></span></div>
</div>
<div class="tables">
  <div class="box">
    <div class="bttl">Earnings</div>
    <table class="bt">
      <tr><td>Salary</td><td>${fmt(ps.basic_pay)}</td></tr>
      ${ps.overtime_hours>0?`<tr><td class="hi">Overtime (${fmtH(ps.overtime_hours)} @ 1.25x)</td><td>${fmt(ps.overtime_pay)}</td></tr>`:''}
      <tr class="dr"><td>Total Earnings</td><td>${fmt(ps.gross_pay)}</td></tr>
    </table>
  </div>
  <div class="box">
    <div class="bttl">Deductions</div>
    <table class="bt">
      <tr><td>HDMF Employee Contribution</td><td>${fmt(getSS('Pag-IBIG'))}</td></tr>
      <tr><td>Tardiness (${tardinessMins} min/s)</td><td>${fmt(ps.late_ut_deduction)}</td></tr>
      <tr><td>PhilHealth Employee Contributn</td><td>${fmt(getSS('PhilHealth'))}</td></tr>
      <tr><td>SSS Employee Contribution</td><td>${fmt(getSS('SSS'))}</td></tr>
      <tr><td>Tax</td><td>${fmt(getSS('Withholding Tax'))}</td></tr>
      <tr class="dr"><td>Total Deductions</td><td>${fmt(ps.total_deductions)}</td></tr>
    </table>
  </div>
</div>
<div class="net">NET PAY : ${fmt(ps.net_pay)}</div>
${ps.attendance.length>0?`<div class="ah">Attendance Detail — Late &amp; Undertime Breakdown</div>
<table class="at">
  <tr><th>Date</th><th>Day</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Late (h)</th><th>Undertime (h)</th></tr>
  ${aRows}
</table>`:''}
<div class="sr">
  <div class="sb"><div class="sl"></div><div class="slb">Employee's Signature</div></div>
  <div class="sb"><div class="sl"></div><div class="slb">Prepared By (HR)</div></div>
  <div class="sb"><div class="sl"></div><div class="slb">Noted By</div></div>
  <div class="sb"><div class="sl"></div><div class="slb">Approved By</div></div>
</div>
<div class="ft"><span>TDT PowerSteel Corp. — HRIS System-Generated Payslip</span><span>Generated: ${new Date().toLocaleString('en-PH')} | ${period}</span></div>
</body></html>`;
}

export default function UserPayslip() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to 1st of current month
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [payslip, setPayslip] = useState<Payslip|null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showAtt, setShowAtt] = useState(false);
  const [dl, setDl] = useState(false);

  const dyn = { bg:{backgroundColor:colors.background}, text:{color:colors.text}, sub:{color:colors.subText}, card:{backgroundColor:colors.card}, border:{borderColor:colors.border} };

  const fetchData = useCallback(async (sDate: Date, eDate: Date) => {
    try {
      const uid = await AsyncStorage.getItem('userId');
      if (!uid) return;
      const sStr = toYMD(sDate);
      const eStr = toYMD(eDate);
      const res = await fetch(`${getBackendUrl()}/get-payslip.php?user_id=${uid}&start_date=${sStr}&end_date=${eStr}`, { headers:{'ngrok-skip-browser-warning':'true'} });
      const json = await res.json();
      if (json.ok) setPayslip(json.payslip);
      else Alert.alert('Error', json.message||'Failed to load payslip');
    } catch (e:any) { Alert.alert('Error', e?.message||'Could not reach server'); }
  }, []);

  const load = async (sDate: Date, eDate: Date) => { setLoading(true); setPayslip(null); await fetchData(sDate, eDate); setLoading(false); };
  const onRefresh = async () => { setRefreshing(true); await fetchData(startDate, endDate); setRefreshing(false); };
  useEffect(() => { load(startDate, endDate); }, []);

  const download = async () => {
    if (!payslip) return;
    setDl(true);
    try {
      // Load the logo as base64 to embed in the PDF
      let logoB64: string | undefined;
      try {
        const asset = Asset.fromModule(require('../../assets/images/NEW_LOGO.png'));
        await asset.downloadAsync();
        if (asset.localUri) {
          logoB64 = await FileSystem.readAsStringAsync(asset.localUri, {
            encoding: 'base64' as any,
          });
        }
      } catch (_) { /* logo load failed — PDF will use text fallback */ }

      const { uri } = await Print.printToFileAsync({ html: buildPdf(payslip, `${fmtDate(startDate)} – ${fmtDate(endDate)}`, logoB64), base64: false });
      await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:'Save / Share Payslip' });
    } catch (e:any) { Alert.alert('Failed', e?.message||'Could not generate PDF'); }
    finally { setDl(false); }
  };


  return (
    <SafeAreaView style={[s.container, dyn.bg]} edges={['top','left','right']}>
      <StatusBar barStyle={isDark?'light-content':'dark-content'} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.title, dyn.text]}>My Payslip</Text>
        <TouchableOpacity style={s.iconBtn} onPress={download} disabled={!payslip||dl}>
          {dl ? <ActivityIndicator size="small" color="#F27121"/> : <Ionicons name="download-outline" size={24} color={payslip?'#F27121':colors.subText}/>}
        </TouchableOpacity>
      </View>

      <View style={s.datePickerContainer}>
        <View style={s.dateBtnWrapper}>
          <Text style={[s.dateLbl, dyn.sub]}>Start Date</Text>
          <TouchableOpacity style={[s.dateBtn, dyn.card, dyn.border]} onPress={() => setShowStartPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color={colors.text} />
            <Text style={[s.dateTxt, dyn.text]}>{fmtDate(startDate)}</Text>
          </TouchableOpacity>
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.subText} style={{marginTop: 18}} />
        <View style={s.dateBtnWrapper}>
          <Text style={[s.dateLbl, dyn.sub]}>End Date</Text>
          <TouchableOpacity style={[s.dateBtn, dyn.card, dyn.border]} onPress={() => setShowEndPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color={colors.text} />
            <Text style={[s.dateTxt, dyn.text]}>{fmtDate(endDate)}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.searchBtn} onPress={() => load(startDate, endDate)}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) setStartDate(selectedDate);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) setEndDate(selectedDate);
          }}
        />
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#F27121"/><Text style={[s.centerTxt,dyn.sub]}>Loading payslip…</Text></View>
      ) : !payslip ? (
        <View style={s.center}>
          <MaterialCommunityIcons name="file-document-outline" size={48} color={colors.subText}/>
          <Text style={[s.centerTxt,dyn.sub]}>No payslip data for this period.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load(startDate, endDate)}>
            <Ionicons name="refresh" size={16} color="#fff"/>
            <Text style={s.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F27121"/>}>

          {/* NET PAY CARD */}
          <View style={s.netCard}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:14}}>
              <Text style={s.netLabel}>TOTAL NET PAY</Text>
              <FontAwesome5 name="file-invoice-dollar" size={22} color="rgba(255,255,255,0.7)"/>
            </View>
            <Text style={s.netAmt}>{fmt(payslip.net_pay)}</Text>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'}}>
              <View>
                <Text style={s.netPeriodLabel}>PAY PERIOD</Text>
                <Text style={s.netPeriodDate}>{`${fmtDate(startDate)} – ${fmtDate(endDate)}`}</Text>
              </View>
              <View style={s.badge}><Text style={s.badgeTxt}>GENERATED</Text></View>
            </View>
          </View>

          {/* LATE/UT ALERT */}
          {payslip.late_ut_deduction > 0 && (
            <View style={s.alertBox}>
              <Ionicons name="warning-outline" size={18} color="#C0392B"/>
              <Text style={s.alertTxt}>
                <Text style={{fontWeight:'800'}}>Late/Undertime Deduction: </Text>
                {fmt(payslip.late_ut_deduction)}{'  '}
                ({fmtH(payslip.late_hours)} late + {fmtH(payslip.undertime_hours)} undertime)
              </Text>
            </View>
          )}

          {/* BREAKDOWN */}
          <TouchableOpacity style={s.toggle} onPress={() => setShowBreak(!showBreak)}>
            <Text style={s.toggleTxt}>{showBreak?'HIDE BREAKDOWN':'VIEW BREAKDOWN'}</Text>
            <Ionicons name={showBreak?'chevron-up':'chevron-down'} size={20} color="#F27121"/>
          </TouchableOpacity>
          {showBreak && (
            <View style={[s.card, dyn.card]}>
              <Text style={[s.secTitle,{color:'#27AE60'}]}>EARNINGS</Text>
              <View style={s.row}><Text style={dyn.sub}>Basic Pay ({payslip.working_days} days)</Text><Text style={[s.rowVal,dyn.text]}>{fmt(payslip.basic_pay)}</Text></View>
              {payslip.overtime_hours>0&&<View style={s.row}><Text style={dyn.sub}>Overtime ({fmtH(payslip.overtime_hours)})</Text><Text style={[s.rowVal,dyn.text]}>{fmt(payslip.overtime_pay)}</Text></View>}
              <View style={[s.row,s.totalRow,dyn.border]}><Text style={[s.totalLbl,dyn.text]}>Gross Pay</Text><Text style={[s.totalVal,dyn.text]}>{fmt(payslip.gross_pay)}</Text></View>
              <View style={[s.divider,dyn.border]}/>
              <Text style={[s.secTitle,{color:'#C0392B',marginTop:4}]}>DEDUCTIONS</Text>
              {payslip.deductions.map((d,i) => (
                <View key={i} style={s.row}>
                  <Text style={[dyn.sub,d.label.startsWith('Late')&&{color:'#C0392B'}]}>{d.label}</Text>
                  <Text style={[s.rowVal,d.label.startsWith('Late')?{color:'#C0392B'}:dyn.text]}>- {fmt(d.amount)}</Text>
                </View>
              ))}
              <View style={[s.row,s.totalRow,dyn.border]}><Text style={[s.totalLbl,dyn.text]}>Total Deductions</Text><Text style={[s.totalVal,{color:'#C0392B'}]}>- {fmt(payslip.total_deductions)}</Text></View>
              <View style={[s.divider,dyn.border]}/>
              <View style={s.row}><Text style={[s.totalLbl,{fontSize:17},dyn.text]}>NET PAY</Text><Text style={[s.totalVal,{fontSize:18,color:'#F27121'}]}>{fmt(payslip.net_pay)}</Text></View>
            </View>
          )}

          {/* ATTENDANCE */}
          {payslip.attendance.length>0&&(
            <>
              <TouchableOpacity style={s.toggle} onPress={() => setShowAtt(!showAtt)}>
                <Text style={s.toggleTxt}>{showAtt?'HIDE ATTENDANCE':'VIEW ATTENDANCE RECORDS'}</Text>
                <Ionicons name={showAtt?'chevron-up':'chevron-down'} size={20} color="#F27121"/>
              </TouchableOpacity>
              {showAtt&&(
                <View style={[s.card,dyn.card]}>
                  <Text style={[s.secTitle,{color:'#888',marginBottom:14}]}>ATTENDANCE DETAIL</Text>
                  {payslip.attendance.map((a,i) => {
                    const pen = a.lateH>0||a.utH>0;
                    return (
                      <View key={i} style={[s.attRow,pen&&s.attPenalty,i>0&&[s.attBorder,dyn.border]]}>
                        <View style={{flex:1}}>
                          <Text style={[{fontSize:13,fontWeight:'700'},dyn.text]}>{a.date}</Text>
                          <Text style={[{fontSize:12,opacity:.6,marginTop:2},dyn.sub]}>{a.timein??'—'} → {a.timeout??'—'}</Text>
                        </View>
                        <View style={{alignItems:'flex-end',gap:3}}>
                          {pen ? (
                            <>
                              {a.lateH>0&&<Text style={s.penTag}>Late: {fmtH(a.lateH)}</Text>}
                              {a.utH>0&&<Text style={s.penTag}>UT: {fmtH(a.utH)}</Text>}
                            </>
                          ) : <Text style={s.okTag}>✓ OK</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* DOWNLOAD */}
          <TouchableOpacity style={[s.dlBtn,dl&&{opacity:.6}]} onPress={download} disabled={dl}>
            {dl?<ActivityIndicator size="small" color="#fff"/>:<Ionicons name="download-outline" size={20} color="#fff"/>}
            <Text style={s.dlTxt}>{dl?'Generating PDF…':'Download Payslip PDF'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   {flex:1},
  header:      {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:24,paddingTop:20,paddingBottom:12},
  title:       {fontSize:20,fontWeight:'800',letterSpacing:-0.5},
  iconBtn:     {padding:8,borderRadius:20,backgroundColor:'rgba(0,0,0,0.04)'},
  datePickerContainer: {flexDirection:'row', paddingHorizontal:20, paddingBottom:12, gap:12, alignItems:'flex-end'},
  dateBtnWrapper: {flex:1},
  dateLbl: {fontSize:11, fontWeight:'700', marginBottom:4, marginLeft:4},
  dateBtn: {flexDirection:'row', alignItems:'center', gap:8, borderWidth:1, borderRadius:12, paddingHorizontal:12, height:44},
  dateTxt: {fontSize:13, fontWeight:'600'},
  searchBtn: {width:44, height:44, borderRadius:12, backgroundColor:'#F27121', justifyContent:'center', alignItems:'center'},
  center:      {flex:1,justifyContent:'center',alignItems:'center',gap:12},
  centerTxt:   {fontSize:14,marginTop:4,textAlign:'center',paddingHorizontal:32},
  retryBtn:    {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#F27121',paddingHorizontal:20,paddingVertical:10,borderRadius:20,marginTop:8},
  retryTxt:    {color:'#fff',fontWeight:'700',fontSize:14},
  content:     {padding:20,paddingBottom:120},
  netCard:     {borderRadius:28,padding:28,marginBottom:16,backgroundColor:'#F27121',shadowColor:'#F27121',shadowOpacity:.4,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:8},
  netLabel:    {color:'rgba(255,255,255,0.85)',fontSize:11,fontWeight:'800',letterSpacing:1.5},
  netAmt:      {fontSize:38,fontWeight:'800',color:'#fff',marginBottom:20,letterSpacing:-1},
  netPeriodLabel:{color:'rgba(255,255,255,0.7)',fontSize:10,fontWeight:'800',letterSpacing:1,marginBottom:4},
  netPeriodDate: {color:'#fff',fontSize:13,fontWeight:'700'},
  badge:       {backgroundColor:'rgba(255,255,255,0.25)',paddingHorizontal:14,paddingVertical:7,borderRadius:20},
  badgeTxt:    {color:'#fff',fontSize:10,fontWeight:'800',letterSpacing:.5},
  alertBox:    {flexDirection:'row',alignItems:'flex-start',gap:8,backgroundColor:'#fff3f0',borderRadius:16,padding:14,marginBottom:12,borderLeftWidth:3,borderLeftColor:'#C0392B'},
  alertTxt:    {flex:1,fontSize:13,color:'#C0392B',lineHeight:18},
  toggle:      {flexDirection:'row',justifyContent:'center',alignItems:'center',padding:18,gap:6},
  toggleTxt:   {color:'#F27121',fontWeight:'800',fontSize:14},
  card:        {borderRadius:28,padding:24,marginBottom:8,elevation:2,shadowColor:'#000',shadowOpacity:.04,shadowRadius:12},
  secTitle:    {fontSize:11,fontWeight:'800',marginBottom:14,letterSpacing:1.5},
  row:         {flexDirection:'row',justifyContent:'space-between',marginBottom:12,alignItems:'center'},
  rowVal:      {fontSize:14,fontWeight:'600'},
  totalRow:    {borderTopWidth:StyleSheet.hairlineWidth,paddingTop:12,marginTop:4,marginBottom:0},
  totalLbl:    {fontWeight:'700',fontSize:15},
  totalVal:    {fontWeight:'800',fontSize:16},
  divider:     {borderTopWidth:StyleSheet.hairlineWidth,marginVertical:18},
  attRow:      {paddingVertical:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  attPenalty:  {backgroundColor:'rgba(192,57,43,0.06)',borderRadius:10,paddingHorizontal:8},
  attBorder:   {borderTopWidth:StyleSheet.hairlineWidth},
  penTag:      {fontSize:11,fontWeight:'800',color:'#C0392B',backgroundColor:'rgba(192,57,43,0.1)',paddingHorizontal:8,paddingVertical:2,borderRadius:8},
  okTag:       {fontSize:11,fontWeight:'800',color:'#27AE60'},
  dlBtn:       {flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10,backgroundColor:'#F27121',borderRadius:28,paddingVertical:18,marginTop:20,shadowColor:'#F27121',shadowOpacity:.3,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:5},
  dlTxt:       {color:'#fff',fontWeight:'800',fontSize:16},
});