import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext'; // <--- IMPORT HOOK

export default function UserMenu() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme(); // <--- GET THEME DATA
  const isDark = theme === 'dark';

  // MENU ITEMS
  const menuItems = [
    { icon: 'person-outline', label: 'My Profile', sub: 'Edit details' },
    { icon: 'notifications-outline', label: 'Notifications', sub: 'Manage alerts' },
    { icon: 'lock-closed-outline', label: 'Security', sub: 'Change password' },
    { icon: 'help-circle-outline', label: 'Help & Support', sub: 'FAQs' },
  ];

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => router.push('/userlogin') }
    ]);
  };

  // DYNAMIC STYLES
  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.background },
    text: { color: colors.text },
    subText: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderBottomColor: colors.border },
    iconBox: { backgroundColor: isDark ? '#333' : '#F0F0F0' },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.text]}>More Options</Text>
        <View style={{width: 30}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* PROFILE CARD */}
        <View style={[styles.profileCard, dynamicStyles.card]}>
            <View style={[styles.avatarCircle, dynamicStyles.iconBox]}>
                <Ionicons name="person" size={40} color={colors.text} />
            </View>
            <View style={styles.profileInfo}>
                <Text style={[styles.profileName, dynamicStyles.text]}>IT Intern</Text>
                <Text style={[styles.profileRole, dynamicStyles.subText]}>Information Technology Dept.</Text>
                <Text style={styles.profileId}>ID: TDT-2026-001</Text>
            </View>
            <TouchableOpacity style={styles.editBtn}>
                <MaterialCommunityIcons name="pencil" size={20} color="#F27121" />
            </TouchableOpacity>
        </View>

        {/* SETTINGS GROUP */}
        <Text style={[styles.sectionTitle, dynamicStyles.subText]}>GENERAL</Text>
        <View style={[styles.menuGroup, dynamicStyles.card]}>
            {menuItems.map((item, index) => (
                <TouchableOpacity key={index} style={[styles.menuItem, dynamicStyles.border]}>
                    <View style={[styles.menuIconBox, dynamicStyles.iconBox]}>
                        <Ionicons name={item.icon as any} size={22} color={colors.text} />
                    </View>
                    <View style={styles.menuText}>
                        <Text style={[styles.menuLabel, dynamicStyles.text]}>{item.label}</Text>
                        <Text style={[styles.menuSub, dynamicStyles.subText]}>{item.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.subText} />
                </TouchableOpacity>
            ))}
        </View>

        {/* PREFERENCES (THE SWITCH) */}
        <Text style={[styles.sectionTitle, dynamicStyles.subText]}>PREFERENCES</Text>
        <View style={[styles.menuGroup, dynamicStyles.card]}>
            <View style={styles.menuItem}>
                <View style={[styles.menuIconBox, dynamicStyles.iconBox]}>
                    <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={22} color={colors.text} />
                </View>
                <View style={styles.menuText}>
                    <Text style={[styles.menuLabel, dynamicStyles.text]}>Dark Mode</Text>
                </View>
                
                {/* THE WORKING SWITCH */}
                <Switch 
                    value={isDark} 
                    onValueChange={toggleTheme} 
                    trackColor={{false: '#767577', true: '#F27121'}} 
                    thumbColor="#f4f3f4" 
                />
            
            </View>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: '#C0392B' }]} onPress={handleLogout}>
            <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>
        
        <Text style={[styles.versionText, dynamicStyles.subText]}>TDT Powersteel App v1.0.0 (Beta)</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// STATIC LAYOUT STYLES
const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  content: { padding: 20 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 15, marginBottom: 30 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold' },
  profileRole: { fontSize: 12, marginBottom: 4 },
  profileId: { color: '#F27121', fontSize: 12, fontWeight: 'bold' },
  editBtn: { padding: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginLeft: 5, letterSpacing: 1 },
  menuGroup: { borderRadius: 15, marginBottom: 25, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  menuIconBox: { width: 35, height: 35, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '500' },
  menuSub: { fontSize: 11 },
  logoutBtn: { borderWidth: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  logoutText: { color: '#C0392B', fontWeight: 'bold', fontSize: 16 },
  versionText: { textAlign: 'center', fontSize: 12, marginBottom: 30 },
});