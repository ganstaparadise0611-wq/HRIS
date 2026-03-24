import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import BottomNav from '../../components/BottomNav';
import { ThemeProvider } from './ThemeContext'; // <--- IMPORT THE BRAIN

export default function RootLayout() {
  const pathname = usePathname();
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

  return (
    // WRAP EVERYTHING IN THEME PROVIDER
    <ThemeProvider>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
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
          <Stack.Screen name="useractivity" />
          <Stack.Screen name="userleave" />
          <Stack.Screen name="userchat" />
          <Stack.Screen name="userpayslip" />
          <Stack.Screen name="userovertime" />
          <Stack.Screen name="useronduty" />
          <Stack.Screen name="usermenu" />
          <Stack.Screen name="usertasks" />
        </Stack>
        {!hideBottomNav && <BottomNav />}
      </View>
    </ThemeProvider>
  );
}