import { useRouter } from 'expo-router'; // <--- ADD THIS IMPORT
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function UserLogin() { // <--- Renamed function
  const router = useRouter(); // <--- Initialize Router
  const [keepLogged, setKeepLogged] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        
        {/* LOGO AREA */}
        <View style={styles.logoContainer}>
          <View style={styles.logoTextContainer}>
             <Text style={styles.logoTDT}>TDT</Text>
             <Text style={styles.logoPowersteel}>POWERSTEEL</Text>
          </View>
          <Text style={styles.tagline}>THE NO.1 STEEL SUPPLIER</Text>
        </View>

        {/* LOGIN FORM */}
        <View style={styles.formContainer}>
          
          <Text style={styles.headerTitle}>Welcome Back</Text>
          <Text style={styles.headerSubtitle}>Sign in to access HR Portal</Text>

          <Text style={styles.label}>Username / Email</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter your username"
            placeholderTextColor="#666"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter your password"
            placeholderTextColor="#666"
            secureTextEntry={true} 
          />

          <View style={styles.toggleContainer}>
            <View style={styles.switchWrapper}>
              <Switch 
                trackColor={{ false: "#555", true: "#F27121" }} 
                thumbColor={keepLogged ? "#fff" : "#ccc"}
                onValueChange={() => setKeepLogged(!keepLogged)}
                value={keepLogged}
              />
              <Text style={styles.toggleText}>Keep me logged in</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* LOGIN BUTTON - NOW WORKS */}
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={() => router.push('/userdashboard')} // <--- Navigate to Dashboard
          >
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>We Empower Development</Text>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 50 },
  logoTextContainer: { flexDirection: 'row', alignItems: 'center' },
  logoTDT: { color: '#D3D3D3', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  logoPowersteel: { color: '#F27121', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  tagline: { color: '#888', fontSize: 12, marginTop: 5, letterSpacing: 2, fontWeight: '600', textTransform: 'uppercase' },
  formContainer: { width: '100%', backgroundColor: '#252525', padding: 25, borderRadius: 15, elevation: 8 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  headerSubtitle: { color: '#888', fontSize: 14, marginBottom: 25 },
  label: { color: '#ccc', fontWeight: '600', marginBottom: 8, marginTop: 10, fontSize: 14 },
  input: { height: 55, backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 15, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#333' },
  toggleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 25 },
  switchWrapper: { flexDirection: 'row', alignItems: 'center' },
  toggleText: { marginLeft: 8, color: '#ccc', fontSize: 13 },
  loginButton: { backgroundColor: '#F27121', height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: "#F27121", shadowOpacity: 0.4, shadowRadius: 5, elevation: 5 },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  forgotPassword: { color: '#F27121', fontSize: 13, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center', alignSelf: 'center' },
  footerText: { color: '#555', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
});