import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

const { width } = Dimensions.get('window');

export default function CompanyScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';

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
      </ScrollView>
    </SafeAreaView>
  );
}

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
});

