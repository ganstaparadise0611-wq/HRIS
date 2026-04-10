import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getBackendUrl } from '../../constants/backend-config';
import { useTheme } from './ThemeContext';

const { width, height } = Dimensions.get('window');

// ─── Policy Data ─────────────────────────────────────────────────────
export const POLICIES = [
  {
    id: 'cancer',
    title: 'Cancer Prevention & Control',
    icon: 'medkit-outline' as const,
    color: '#E74C3C',
    gradient: ['#E74C3C', '#C0392B'],
    docNo: 'PLC-HRD-16',
    effectivityDate: '28 JAN 2026',
    sections: [
      {
        heading: 'I. Policy Statement and Legal Basis',
        content:
          'TDT POWERSTEEL CORP., is committed to promoting the health, safety, and well-being of all employees by adopting a comprehensive Workplace Policy and Program on Cancer Prevention and Control. This policy is aligned with Labor Advisory No. 20, Series of 2023, otherwise known as the Guidelines in the Implementation of the Workplace Policy and Program on Cancer Prevention and Control in the Private Sector, and relevant issuances of the Department of Labor and Employment (DOLE).\n\nThe Company recognizes cancer as a major health concern that may affect productivity, employee welfare, and quality of life. This policy ensures a supportive, non-discriminatory, and employee-centered approach to cancer prevention, early detection, treatment, return-to-work, and access to statutory benefits.',
      },
      {
        heading: 'II. Objectives',
        content:
          'This policy aims to:\n\n1. Promote cancer prevention through education and risk reduction strategies;\n2. Facilitate access to cancer screening, diagnosis, and treatment;\n3. Ensure non-discrimination and reasonable accommodation for employees with cancer;\n4. Support employees in returning to work and reintegrating into the workplace;\n5. Provide guidance on compensation, benefits, and social protection mechanisms; and\n6. Establish an employee-centric and supportive workplace environment.',
      },
      {
        heading: 'III. Scope and Coverage',
        content:
          'This policy applies to all employees of TDT POWERSTEEL CORP., regardless of employment status, position, or length of service, subject to existing company rules and applicable laws.',
      },
      {
        heading: 'IV. Guiding Principles',
        content:
          'a) Non-Discrimination: Employees diagnosed with cancer shall not be discriminated against in any aspect of employment.\n\nb) Confidentiality: Medical information shall be treated with utmost confidentiality.\n\nc) Reasonable Accommodation: Work adjustments shall be provided when medically necessary and feasible.\n\nd) Shared Responsibility: Cancer prevention and control is a shared responsibility of the employer and employees.',
      },
      {
        heading: 'V. Program Components',
        content:
          'A. Cancer Prevention and Health Promotion\nTDT POWERSTEEL CORP., shall implement preventive measures to reduce cancer risk in the workplace, including:\n• Information and education campaigns on healthy lifestyle practices\n• Promotion of a smoke-free workplace and compliance with occupational safety and health standards\n• Reduction of exposure to occupational carcinogens through engineering controls, proper PPE, and safe work practices\n• Integration of cancer awareness activities in company wellness and health programs\n\nB. Access to Cancer Screening and Early Detection\nTDT POWERSTEEL CORP., shall encourage early detection of cancer by:\n• Providing employees with information on available cancer screening tests\n• Coordinating with company-accredited clinics, HMOs, or government health facilities for screening referrals\n• Allowing reasonable time off for employees to undergo recommended screening procedures\n\nC. Diagnosis and Referral Mechanism\n• Employees who exhibit symptoms or receive abnormal screening results shall be advised to consult licensed medical professionals\n• The Company Clinic, HMO, or HR Department may assist in referrals to appropriate hospitals or specialists\n• All medical consultations and diagnoses shall remain the personal decision of the employee\n\nD. Access to Treatment and Medical Support\n• Employees diagnosed with cancer shall be encouraged to avail of treatment options through accredited hospitals, HMOs, PhilHealth, and other providers\n• The Company shall facilitate flexible work arrangements, leave benefits, or temporary work adjustments upon submission of medical certification\n• No employee shall be terminated solely on the basis of a cancer diagnosis\n\nE. Return-to-Work and Workplace Reintegration Program\nTDT POWERSTEEL shall support employees returning to work after cancer treatment through:\n• A medically guided return-to-work plan, in coordination with the employee, attending physician, and management\n• Reasonable accommodations such as modified duties, adjusted work schedules, or gradual workload increase\n• Continuous monitoring and dialogue to ensure the employee\'s health, safety, and productivity\n\nF. Compensation, Benefits, and Financial Assistance\n• Employees diagnosed with cancer may avail of applicable benefits under PhilHealth, SSS, ECC, and company-provided benefits\n• Work-related cancer cases shall be processed in accordance with ECC rules and regulations\n• The Company shall provide access to information for filing compensation claims',
      },
      {
        heading: 'VI. Roles and Responsibilities',
        content:
          'Management\n• Ensure implementation and continuous improvement of this policy\n• Allocate reasonable resources to support cancer prevention and control programs\n\nHuman Resources Department\n• Lead policy implementation, information dissemination, and coordination with healthcare providers\n• Ensure confidentiality and non-discriminatory practices\n\nEmployees\n• Actively participate in cancer prevention and wellness activities\n• Practice healthy lifestyles and comply with safety and health policies',
      },
      {
        heading: 'VII. Data Privacy and Confidentiality',
        content:
          'In compliance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, TDT POWERSTEEL CORP., commits to protecting the privacy, confidentiality, and security of all personal and sensitive personal information related to employees\' health and cancer-related data.\n\n• All medical records, diagnoses, treatment information, and related documents shall be collected, processed, stored, and retained strictly for legitimate employment, occupational health, and legal purposes\n• Access to such information shall be limited only to authorized personnel on a need-to-know basis\n• Disclosure of medical information shall only be made with the employee\'s written consent or when required by law\n• Employees shall be informed of their rights as data subjects',
      },
      {
        heading: 'VIII. Monitoring & Effectivity',
        content:
          'This policy shall be reviewed periodically to ensure alignment with DOLE issuances, existing laws, and company practices. Amendments may be made as necessary to enhance effectiveness and compliance.\n\nThis Workplace Policy and Program on Cancer Prevention and Control shall take effect immediately upon approval and shall remain in force unless amended or revoked by Management.',
      },
    ],
  },
  {
    id: 'alcohol',
    title: 'Alcohol-Free Workplace Policy',
    icon: 'wine-outline' as const,
    color: '#3498DB',
    gradient: ['#3498DB', '#2980B9'],
    docNo: 'PLC-HRD-14',
    effectivityDate: '28 JAN 2026',
    sections: [
      {
        heading: '1. Purpose',
        content:
          'TDT POWERSTEEL CORP. is committed to maintaining a safe, healthy, and productive workplace. This Alcohol-Free Workplace Policy and Program aims to prevent alcohol-related risks that may compromise employee safety, performance, and well-being, and to ensure compliance with applicable Department of Labor and Employment (DOLE) guidelines, occupational safety standards, and Philippine labor laws.',
      },
      {
        heading: '2. Scope',
        content:
          'This policy applies to all employees of TDT POWERSTEEL CORP., including officers, probationary and regular employees, contractual and agency-hired personnel, consultants, contractors, and visitors, across all company premises, project sites, and during all work-related activities, whether conducted on-site or off-site.',
      },
      {
        heading: '3. Policy Statement',
        content:
          'TDT POWERSTEEL CORP. strictly enforces an Alcohol-Free Workplace. The Company prohibits any act involving the use or influence of alcohol that may impair an employee\'s ability to safely and effectively perform work duties or endanger others in the workplace.',
      },
      {
        heading: '4. Prohibited Acts',
        content:
          'The following are strictly prohibited:\n\n• Reporting for work or performing official duties under the influence of alcohol\n• Possession, consumption, sale, or distribution of alcoholic beverages during working hours or within company premises\n• Bringing alcoholic beverages into company premises without proper authorization\n• Engaging in off-duty alcohol consumption that results in workplace impairment, safety risk, or misconduct',
      },
      {
        heading: '5. Prevention, Education & Awareness',
        content:
          'TDT POWERSTEEL CORP. shall implement preventive and educational initiatives to promote awareness and responsible behavior, including:\n\n• Information, education, and advocacy programs on the effects of alcohol on health, safety, and work performance\n• Orientation for newly hired employees regarding this policy\n• Periodic safety briefings, wellness talks, and toolbox meetings\n• Posting of policy reminders and informational materials in conspicuous places',
      },
      {
        heading: '6. Assessment and Fitness-for-Duty',
        content:
          'When there is reasonable suspicion that an employee is under the influence of alcohol and poses a safety risk, the Company may conduct for-cause assessment or fitness-for-duty evaluation, subject to due process, confidentiality, and applicable company procedures.\n\nPost-incident or post-accident assessments may also be required to determine contributing factors and ensure workplace safety.',
      },
      {
        heading: '7. Treatment, Referral & Support',
        content:
          'TDT POWERSTEEL CORP. recognizes that alcohol-related concerns may be associated with health, personal, or social factors.\n\n• Employees who voluntarily disclose alcohol-related concerns and request assistance may be referred to appropriate counseling, medical, or support services\n• Any referral or support provided shall be non-punitive in nature, subject to company policies, and handled with strict confidentiality\n• Participation in counseling or support programs shall not exempt an employee from compliance with workplace rules\n• Return-to-work arrangements shall be subject to fitness-for-duty assessment',
      },
      {
        heading: '8. Roles, Rights & Responsibilities',
        content:
          'Employer Responsibilities:\n• Develop, communicate, and consistently enforce this policy\n• Provide education, prevention, and awareness programs\n• Ensure confidentiality of related medical or assessment records\n• Observe due process in investigations and disciplinary actions\n• Promote a supportive and safe work environment\n\nEmployee Responsibilities:\n• Comply with this policy at all times\n• Report to work fit for duty and free from alcohol impairment\n• Participate in education and awareness activities\n• Seek voluntary assistance when experiencing alcohol-related concerns',
      },
      {
        heading: '9. Disciplinary Action',
        content:
          'Any violation of this policy shall be addressed in accordance with the Company\'s Code of Conduct and disciplinary procedures, subject to due process. Disciplinary action may include:\n\n• Written warning\n• Suspension\n• Mandatory counseling or referral\n• Termination of employment, depending on the gravity and recurrence of the offense',
      },
      {
        heading: '10. Monitoring, Evaluation & Effectivity',
        content:
          'The implementation and effectiveness of this policy shall be monitored by the Human Resources Department, Safety Committee, or other designated body. Periodic reviews shall be conducted to ensure continuous improvement and compliance with labor and safety standards.\n\nThis policy shall be disseminated to all employees through orientations, memoranda, and postings in conspicuous places. It shall take effect upon approval by Management.',
      },
    ],
  },
  {
    id: 'mental',
    title: 'Mental Health Awareness & Support',
    icon: 'heart-outline' as const,
    color: '#9B59B6',
    gradient: ['#9B59B6', '#8E44AD'],
    docNo: 'PLC-HRD-15',
    effectivityDate: '28 JAN 2026',
    sections: [
      {
        heading: '1. Purpose',
        content:
          'TDT POWERSTEEL CORP. is committed to promoting a safe, respectful, and mentally healthy workplace. This Policy aims to:\n\n• Raise awareness on mental health and well-being\n• Encourage early intervention and support\n• Prevent stigma, discrimination, and harassment\n• Ensure compliance with Republic Act No. 11036 (Mental Health Act), the Labor Code of the Philippines, and applicable DOLE issuances\n\nThis Policy supports employee welfare while upholding workplace safety, productivity, and management prerogative.',
      },
      {
        heading: '2. Scope',
        content:
          'This Policy applies to all employees of TDT POWERSTEEL CORP., regardless of employment status, position, or work location, including officers, supervisors, rank-and-file employees, and contractual personnel where applicable.',
      },
      {
        heading: '3. Policy Statement',
        content:
          'TDT POWERSTEEL CORP. recognizes mental health as an important component of overall employee well-being. The Company shall:\n\n• Foster a workplace culture that is respectful, inclusive, and supportive\n• Promote awareness and education on mental health\n• Provide reasonable support mechanisms within the scope of company resources\n• Ensure that employees are not discriminated against on the basis of mental health conditions\n\nNothing in this Policy shall diminish the Company\'s right to enforce workplace rules, performance standards, or disciplinary measures in accordance with due process.',
      },
      {
        heading: '4. Awareness & Preventive Programs',
        content:
          'The Company may implement the following initiatives, subject to operational feasibility:\n\n• Mental health awareness orientations or briefings\n• Information dissemination on stress management and well-being\n• Promotion of work-life balance and healthy coping strategies\n• Supervisor orientation on recognizing signs of distress and proper referral\n\nThese programs are preventive and educational in nature and do not constitute medical or psychological treatment.',
      },
      {
        heading: '5. Treatment, Referral & Support',
        content:
          'TDT POWERSTEEL CORP. acknowledges that mental health concerns may arise due to personal, social, or work-related factors. While the Company is not a medical provider, it may offer support through:\n\n• Voluntary referral to licensed mental health professionals, medical practitioners, or counseling services\n• Coordination with available healthcare benefits or external providers\n• Non-punitive assistance for employees who voluntarily seek help\n\nParticipation in treatment or counseling is voluntary and shall not excuse non-compliance with company rules or performance standards.',
      },
      {
        heading: '6. Mental Health Focal Person / Committee',
        content:
          'To support the effective implementation of this Policy, TDT POWERSTEEL CORP. may designate a Mental Health Focal Person or establish a Mental Health Committee, composed of representatives from:\n\n• Human Resources\n• Management\n• Safety or Health personnel\n• Other personnel as Management may determine\n\nFunctions may include:\n• Support the implementation of this Policy\n• Coordinate mental health awareness and preventive activities\n• Receive and facilitate concerns or referrals\n• Assist in crisis or emergency referral procedures\n• Ensure confidentiality and proper handling of information\n• Recommend policy or program improvements to Management',
      },
      {
        heading: '7. Crisis or Emergency Referral Protocol',
        content:
          'Indicators of a Mental Health Crisis:\n• Expressions of self-harm, suicidal thoughts, or hopelessness\n• Severe emotional distress, panic, or breakdown\n• Sudden drastic behavioral changes affecting safety\n• Actions posing an immediate risk to self or others\n\nImmediate Response Measures:\n• Ensure safety: priority given to employee and others\n• Notify proper representatives: Mental Health Focal Person, HR, or Management\n• Provide calm and respectful intervention\n• Facilitate referral to licensed mental health professional or medical facility\n• Contact emergency services or crisis hotlines\n• Temporary leave, modified duties, or work restrictions may be applied for safety\n• Return-to-work may require fitness-for-duty or medical clearance',
      },
      {
        heading: '8. Roles & Responsibilities',
        content:
          'Employer:\n• Provide supportive, non-discriminatory workplace\n• Implement Policy consistently\n• Ensure due process and confidentiality\n\nEmployees:\n• Treat colleagues with respect\n• Seek assistance when experiencing distress\n• Comply with company rules and safety standards',
      },
      {
        heading: '9. Non-Discrimination & Confidentiality',
        content:
          'No employee shall be discriminated against, harassed, or retaliated against due to mental health conditions or for seeking assistance. Confidentiality shall be strictly observed.',
      },
      {
        heading: '10. Policy Violations & Effectivity',
        content:
          'This Policy does not shield employees from disciplinary action arising from violations of company rules, misconduct, or performance issues, provided that due process is observed.\n\nThe Policy shall be reviewed periodically by Management and Human Resources to ensure continued compliance with applicable laws and relevance to company operations.\n\nThis Policy shall be disseminated to all employees through orientations, memoranda, and postings in conspicuous places. It shall take effect upon approval by Management.',
      },
    ],
  },
];

// ─── Policy Modal Component ─────────────────────────────────────────
export function PolicyModal({
  visible,
  policy,
  onClose,
  colors,
  isDark,
}: {
  visible: boolean;
  policy: (typeof POLICIES)[0] | null;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (visible && policy) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, policy]);

  const handleDownload = async () => {
    if (!policy) return;

    try {
      setIsDownloading(true);
      const pdfUrl = `${getBackendUrl()}/policies/${policy.id}.pdf`;
      const safeTitle = policy.title.replace(/[^a-zA-Z0-9]/g, '_');
      const fileUri = `${FileSystem.documentDirectory}${safeTitle}.pdf`;

      const downloadRes = await FileSystem.downloadAsync(pdfUrl, fileUri);

      if (downloadRes.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(downloadRes.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Download ${policy.title}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Notice', 'Sharing/Saving is not available on this device emulator.');
        }
      } else {
        Alert.alert('Download Failed', 'Could not fetch the document from the server.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while trying to download the file.');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!policy) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalContainer,
            { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#333' : '#EEE' }]}>
            <View style={[styles.modalHeaderIcon, { backgroundColor: policy.color + '18' }]}>
              <Ionicons name={policy.icon} size={28} color={policy.color} />
            </View>
            <View style={styles.modalHeaderText}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>
                {policy.title}
              </Text>
              <Text style={[styles.modalDocInfo, { color: colors.subText }]}>
                {policy.docNo} • Effective: {policy.effectivityDate}
              </Text>
            </View>
            
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity
                onPress={handleDownload}
                style={[styles.modalActionBtn, { backgroundColor: policy.color + '18' }]}
                activeOpacity={0.7}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color={policy.color} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={20} color={policy.color} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={[styles.modalActionBtn, { backgroundColor: isDark ? '#333' : '#F0F0F0' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Modal Body - PDF Viewer */}
          <View style={styles.modalBody}>
            <WebView
              source={{ uri: `${getBackendUrl()}/pdfjs/web/viewer.html?file=${encodeURIComponent(`/policies/${policy.id}.pdf`)}` }}
              style={{ flex: 1, backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingContainer}>
                  <Text style={{ color: colors.subText }}>Loading document...</Text>
                </View>
              )}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────
export default function CompanyScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedPolicy, setSelectedPolicy] = useState<(typeof POLICIES)[0] | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const openPolicy = (policy: (typeof POLICIES)[0]) => {
    setSelectedPolicy(policy);
    setModalVisible(true);
  };

  const closePolicy = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedPolicy(null), 300);
  };

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompanyInnerContent 
          fadeAnim={fadeAnim} 
          slideAnim={slideAnim} 
          dyn={dyn} 
          colors={colors} 
          isDark={isDark} 
          openPolicy={openPolicy} 
        />
      </ScrollView>

      {/* Policy Detail Modal */}
      <PolicyModal
        visible={modalVisible}
        policy={selectedPolicy}
        onClose={closePolicy}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

// ─── Extracted Inner Content for reuse in Sidebar ────────────────────
export function CompanyInnerContent({ fadeAnim, slideAnim, dyn, colors, isDark, openPolicy }: any) {
  return (
    <>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Image
            source={require('../../assets/images/NEW_LOGO.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* About Us Section */}
        <Animated.View style={[styles.sectionCard, dyn.card, { opacity: fadeAnim }]}>
          <Text style={[styles.sectionHeaderTitle, dyn.text]}>About Us</Text>
          
          <Text style={[styles.tagline, { color: '#F27121' }]}>
            STEEL SUPPLIER IN THE{'\n'}PHILIPPINES
          </Text>

          <Text style={[styles.paragraph, dyn.text]}>
            TDT Powersteel Corporation is one of the most reliable and trusted brands in the Philippine steel supply and distribution industry.
          </Text>

          <Text style={[styles.paragraph, dyn.text]}>
            It has continuously proven its commitment to provide premium quality construction solutions with its over 1,000 steel products, tailored-fit professional services, and nationwide distribution hubs – making TDT Powersteel Corporation the preferred partner of many contractors, architects, and developers of major landmark projects in the country today.
          </Text>

          <Text style={[styles.paragraph, dyn.text]}>
            The knowledge and expertise in the steel and construction distribution business has earned TDT Powersteel Corporation the recognition of being a frontrunner in the industry.
          </Text>
        </Animated.View>

        {/* Vision Section */}
        <Animated.View style={[styles.sectionCard, dyn.card, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={24} color="#F27121" />
            <Text style={[styles.sectionTitle, dyn.text]}>VISION</Text>
          </View>
          <Text style={[styles.paragraph, dyn.text]}>
            Our vision is to be the most trusted and preferred steel and construction solution partner in South East Asia and the Pacific.
          </Text>
        </Animated.View>

        {/* Mission Section */}
        <Animated.View style={[styles.sectionCard, dyn.card, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="rocket-outline" size={24} color="#F27121" />
            <Text style={[styles.sectionTitle, dyn.text]}>MISSION</Text>
          </View>
          
          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: '#F27121' }]}>•</Text>
            <Text style={[styles.paragraph, dyn.text, styles.bulletText]}>
              We value our innovation and growth to all of our stakeholders through market leadership and strategic partnership.
            </Text>
          </View>

          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: '#F27121' }]}>•</Text>
            <Text style={[styles.paragraph, dyn.text, styles.bulletText]}>
              We develop trusted, premium quality and innovative construction solutions at reasonable prices, under flexible terms and fastest delivery period that best suit our clients' needs.
            </Text>
          </View>

          <View style={styles.bulletPoint}>
            <Text style={[styles.bullet, { color: '#F27121' }]}>•</Text>
            <Text style={[styles.paragraph, dyn.text, styles.bulletText]}>
              We empower our people to be the leaders and catalysts of innovation.
            </Text>
          </View>
        </Animated.View>

        {/* Commitment Section */}
        <Animated.View style={[styles.sectionCard, dyn.card, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={24} color="#F27121" />
            <Text style={[styles.sectionTitle, dyn.text]}>COMMITMENT OF THE PRESIDENT</Text>
          </View>
          <View style={styles.quoteContainer}>
            <Text style={[styles.quote, dyn.text]}>
              "Let's harp on good service and relationship and complete business solution as our value and benefits to customer."
            </Text>
            <Text style={[styles.quoteAuthor, dyn.sub]}>– the President</Text>
          </View>
        </Animated.View>

        {/* ─── Company Policies Section ─── */}
        <Animated.View style={[styles.sectionCard, dyn.card, { opacity: fadeAnim }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={24} color="#F27121" />
            <Text style={[styles.sectionTitle, dyn.text]}>COMPANY POLICIES</Text>
          </View>
          <Text style={[styles.policiesSubtitle, dyn.sub]}>
            Tap on a policy to view the full document
          </Text>

          {POLICIES.map((policy, index) => (
            <TouchableOpacity
              key={policy.id}
              style={[styles.policyCard, { borderLeftColor: policy.color, backgroundColor: isDark ? '#2A2A2A' : '#FAFAFA' }]}
              onPress={() => openPolicy(policy)}
              activeOpacity={0.7}
            >
              <View style={[styles.policyIconContainer, { backgroundColor: policy.color + '18' }]}>
                <Ionicons name={policy.icon} size={26} color={policy.color} />
              </View>
              <View style={styles.policyTextContainer}>
                <Text style={[styles.policyTitle, { color: colors.text }]}>{policy.title}</Text>
                <Text style={[styles.policyMeta, { color: colors.subText }]}>
                  {policy.docNo} • Effective: {policy.effectivityDate}
                </Text>
              </View>
              <View style={[styles.policyArrow, { backgroundColor: policy.color + '15' }]}>
                <Ionicons name="chevron-forward" size={18} color={policy.color} />
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    width: width * 0.85,
    height: 160,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  sectionHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'justify',
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bullet: {
    fontSize: 20,
    marginRight: 10,
    marginTop: -2,
  },
  bulletText: {
    flex: 1,
    marginBottom: 0,
  },
  quoteContainer: {
    backgroundColor: 'rgba(242, 113, 33, 0.08)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F27121',
    marginTop: 8,
  },
  quote: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },

  // ─ Policies Section ─
  policiesSubtitle: {
    fontSize: 13,
    marginBottom: 16,
    marginTop: -4,
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  policyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  policyTextContainer: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  policyMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  policyArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ─ Modal Styles ─
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: height * 0.92,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalDocInfo: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  modalActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
  },
  modalBody: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
