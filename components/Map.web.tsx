import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = (props: any) => (
  <View style={[styles.container, props.style]}>
    <Text style={styles.text}>Map relies on native modules and is not supported on Web.</Text>
  </View>
);

export const Marker = (props: any) => null;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  }
});

export default MapView;
