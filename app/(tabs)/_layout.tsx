import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import BottomNav from '../../components/BottomNav';
import { ThemeProvider, useTheme } from './ThemeContext'; // <--- IMPORT THE BRAIN
import React from 'react';

import ModernSidebar from '../../components/ModernSidebar';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate } from 'react-native-reanimated';
import { Dimensions, TouchableOpacity, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function RootLayoutContent() {
  const pathname = usePathname();
  const { colors, theme, sidebarVisible, setSidebarVisible } = useTheme();
  
  // Expo Router may return '/userlogin' or '/(tabs)/userlogin' depending on config.
  // Signup UI is inside the same screen, so hiding on userlogin covers both.
  // Also hide bottom nav for password reset flow
  const hideBottomNav = pathname === '/userlogin' || 
                        pathname === '/(tabs)/userlogin' || 
                        pathname.endsWith('/userlogin') ||
                        pathname === '/forgotpassword' ||
                        pathname === '/(tabs)/forgotpassword' ||
                        pathname.endsWith('/forgotpassword') ||
                        pathname === '/verifycode' ||
                        pathname === '/(tabs)/verifycode' ||
                        pathname.endsWith('/verifycode') ||
                        pathname === '/resetpassword' ||
                        pathname === '/(tabs)/resetpassword' ||
                        pathname.endsWith('/resetpassword');

  // Slide animation for entire app interface
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(sidebarVisible ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [sidebarVisible]);

  const animatedAppStyle = useAnimatedStyle(() => {
    // Drop the scale to avoid the awkward vertical gap above the bottom tab navigator
    const translateX = interpolate(progress.value, [0, 1], [0, SCREEN_WIDTH * 0.82]);
    const borderRadius = interpolate(progress.value, [0, 1], [0, 20]);
    
    return {
      flex: 1,
      transform: [{ translateX }],
      borderRadius,
      overflow: 'hidden',
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme === 'dark' ? "light" : "dark"} />
      
      {/* Global sliding wrapper for entire content including Bottom Nav */}
      <Animated.View style={[animatedAppStyle, { backgroundColor: colors.background }]}>
        {sidebarVisible && (
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => setSidebarVisible(false)} 
            style={[{ zIndex: 9999 }, StyleSheet.absoluteFillObject]} 
          />
        )}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" /> 
          <Stack.Screen name="userlogin" />
          <Stack.Screen name="forgotpassword" />
          <Stack.Screen name="verifycode" />
          <Stack.Screen name="resetpassword" />
          <Stack.Screen name="userdashboard" />
          <Stack.Screen name="features" />
          <Stack.Screen name="feeds" />
          <Stack.Screen name="company" />
          <Stack.Screen name="request" />
          <Stack.Screen name="userattendance" />
          <Stack.Screen name="attendancehistory" />
          <Stack.Screen name="userattendancecorrection" />
          <Stack.Screen name="useractivity" />
          <Stack.Screen name="userleave" />
          <Stack.Screen name="userchat" />
          <Stack.Screen name="userpayslip" />
          <Stack.Screen name="userovertime" />
          <Stack.Screen name="useronduty" />
          <Stack.Screen name="usermenu" />
          <Stack.Screen name="usertasks" />
          <Stack.Screen name="shiftschedule" />
          <Stack.Screen name="usertimesheet" />
          <Stack.Screen name="attendancereport" />
          <Stack.Screen name="attendancelocationreport" />
        </Stack>
        {!hideBottomNav && <BottomNav />}
      </Animated.View>

      {/* Modern Sidebar sits at root level beneath sliding content */}
      <ModernSidebar />
    </View>
  );
}

export default function RootLayout() {
  return (
    // WRAP EVERYTHING IN THEME PROVIDER
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}