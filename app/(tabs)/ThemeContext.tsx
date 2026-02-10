import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

// 1. DEFINE OUR COLORS
export const Colors = {
  dark: {
    background: '#1A1A1A',
    card: '#252525',
    text: '#FFFFFF',
    subText: '#888888',
    icon: '#FFFFFF',
    border: '#333333'
  },
  light: {
    background: '#F5F5F5',
    card: '#FFFFFF',
    text: '#1A1A1A',
    subText: '#666666',
    icon: '#333333',
    border: '#E0E0E0'
  }
};

// 2. CREATE THE CONTEXT
const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState('dark'); // Default to dark

  // Load saved theme on startup
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('userTheme');
      if (savedTheme) setTheme(savedTheme);
    };
    loadTheme();
  }, []);

  // Toggle function
  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await AsyncStorage.setItem('userTheme', newTheme);
  };

  // Helper to get current colors
  const colors = theme === 'dark' ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom Hook to use the theme easily
export const useTheme = () => useContext(ThemeContext);