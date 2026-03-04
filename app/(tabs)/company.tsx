import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export default function CompanyScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

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

      <View style={styles.header}>
        <Text style={[styles.headerTitle, dyn.text]}>Company</Text>
        <Text style={[styles.headerSubtitle, dyn.sub]}>
          Learn about the company and connect with your team.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.companyCard, dyn.card, dyn.border]}>
          <Text style={[styles.companyName, dyn.text]}>TDT Powersteel</Text>
          <Text style={[styles.companyTagline, dyn.sub]}>
            Great day starts with great people.
          </Text>
          <Text style={[styles.companyDescription, dyn.sub]}>
            This is your hub for announcements, culture, and quick links to internal tools. Stay
            connected with HR, your department, and company-wide updates.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, dyn.text]}>Quick Links</Text>
        <View style={styles.gridContainer}>
          {[
            {
              label: 'Company Chat',
              icon: 'chatbubbles-outline',
              route: '/userchat',
              lib: Ionicons,
            },
            {
              label: 'Payslip Center',
              icon: 'file-document-outline',
              route: '/userpayslip',
              lib: MaterialCommunityIcons,
            },
            {
              label: 'On Duty',
              icon: 'airplane-outline',
              route: '/useronduty',
              lib: Ionicons,
            },
            {
              label: 'HR Requests',
              icon: 'account-group-outline',
              route: '/userleave',
              lib: MaterialCommunityIcons,
            },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.gridItem, dyn.card, dyn.border]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.iconCircle}>
                <item.lib
                  name={item.icon as any}
                  size={22}
                  color={isDark ? '#FFF' : '#333'}
                />
              </View>
              <Text style={[styles.gridLabel, dyn.text]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { marginTop: 4, fontSize: 13 },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  companyCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
  },
  companyTagline: {
    marginTop: 4,
    fontSize: 13,
    fontStyle: 'italic',
  },
  companyDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '47%',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(242,113,33,0.12)',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});

