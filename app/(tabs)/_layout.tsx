import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './ThemeContext'; // <--- IMPORT THE BRAIN

export default function RootLayout() {
  return (
    // WRAP EVERYTHING IN THEME PROVIDER
    <ThemeProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" /> 
        <Stack.Screen name="userlogin" />
        <Stack.Screen name="userdashboard" />
        <Stack.Screen name="userattendance" />
        <Stack.Screen name="useractivity" />
        <Stack.Screen name="userleave" />
        <Stack.Screen name="userchat" />
        <Stack.Screen name="userpayslip" />
        <Stack.Screen name="userovertime" />
        <Stack.Screen name="usermenu" />
      </Stack>
    </ThemeProvider>
  );
}