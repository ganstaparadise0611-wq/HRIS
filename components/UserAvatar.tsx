/**
 * UserAvatar - Displays user profile picture or initial fallback (like Messenger)
 * Fetches profile_picture from Supabase accounts table when userId is provided.
 * The `face` column is reserved for face recognition data only.
 */

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/backend-config';

function faceToUri(faceData: unknown): string | null {
  if (!faceData || typeof faceData !== 'string') return null;
  if (faceData.startsWith('data:image')) return faceData;
  if (faceData.startsWith('/9j') || faceData.startsWith('iVBOR') || faceData.startsWith('R0lG')) {
    return `data:image/jpeg;base64,${faceData}`;
  }
  if (faceData.startsWith('\\x')) return null; // PostgreSQL hex - skip
  return `data:image/jpeg;base64,${faceData}`;
}

interface UserAvatarProps {
  userId?: string | null;
  displayName: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
  backgroundColor?: string;
  onlineDotBorderColor?: string; // For dark/light theme blend
}

export default function UserAvatar({
  userId,
  displayName,
  size = 50,
  showOnline = false,
  isOnline = false,
  backgroundColor = '#F27121',
  onlineDotBorderColor = '#FFF',
}: UserAvatarProps) {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/accounts?log_id=eq.${userId}&select=profile_picture`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );
        const data = await response.json();
        if (cancelled) return;
        if (data && data.length > 0 && data[0].profile_picture) {
          const uri = faceToUri(data[0].profile_picture);
          if (uri) setAvatarUri(uri);
        }
      } catch {
        // Ignore errors - fallback to initial
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const radius = size / 2;
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {avatarUri && loaded ? (
        <Image
          source={{ uri: avatarUri }}
          style={[styles.image, { width: size, height: size, borderRadius: radius }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.initial, { width: size, height: size, borderRadius: radius, backgroundColor }]}>
          <Text style={[styles.initialText, { fontSize: size * 0.4 }]}>{initial}</Text>
        </View>
      )}
      {showOnline && isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.24,
              height: size * 0.24,
              borderRadius: size * 0.12,
              right: 0,
              bottom: 0,
              borderColor: onlineDotBorderColor,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  image: {},
  initial: { justifyContent: 'center', alignItems: 'center' },
  initialText: { color: '#FFF', fontWeight: 'bold' },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#2ecc71',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
