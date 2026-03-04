import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

type FeedKind = 'post' | 'announcement' | 'activity';

interface FeedPost {
  post_id: number;
  emp_id: number;
  caption: string;
  image_url?: string | null;
  is_achievement: boolean;
  kind: FeedKind;
  created_at: string;
  activity_id?: number | null;
   media_type?: string | null;
   video_url?: string | null;
   video_duration_seconds?: number | null;
  employees?: { name?: string | null } | null;
}

export default function FeedsScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [feeds, setFeeds] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newKind, setNewKind] = useState<FeedKind>('post');
  const [newIsAchievement, setNewIsAchievement] = useState(false);
  const [posting, setPosting] = useState(false);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [pickingVideo, setPickingVideo] = useState(false);

  const dyn = {
    bg: { backgroundColor: colors.background },
    text: { color: colors.text },
    sub: { color: colors.subText },
    card: { backgroundColor: colors.card },
    border: { borderColor: colors.border },
  };

  useEffect(() => {
    // Public repo build: feeds are local-only (no Supabase / external DB)
    setFeeds([]);
    setError(null);
    setLoading(false);
  }, []);

  const formatWhen = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  };

  const getKindConfig = (kind: FeedKind) => {
    switch (kind) {
      case 'announcement':
        return {
          icon: 'megaphone-outline' as const,
          label: 'Announcement',
        };
      case 'activity':
        return {
          icon: 'time-outline' as const,
          label: 'Activity',
        };
      default:
        return {
          icon: 'chatbubbles-outline' as const,
          label: 'Post',
        };
    }
  };

  const handlePickImage = async () => {
    try {
      setPickingImage(true);
      // If switching to image, clear any selected video
      setVideoUri(null);
      setVideoDurationSeconds(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to attach a picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setImagePreviewUri(asset.uri ?? null);
      setImageBase64(asset.base64 ?? null);
    } catch (e) {
      Alert.alert('Error', 'Could not open photo library.');
    } finally {
      setPickingImage(false);
    }
  };

  const handlePickVideo = async () => {
    try {
      setPickingVideo(true);
      // If switching to video, clear any selected image
      setImagePreviewUri(null);
      setImageBase64(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo/video access to attach a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      // Normalise duration to seconds when available (for display only, not strict validation)
      let durationSec: number | null =
        typeof asset.duration === 'number' ? asset.duration : null;
      if (durationSec != null && durationSec > 1000) {
        durationSec = durationSec / 1000;
      }
      setVideoUri(asset.uri ?? null);
      setVideoDurationSeconds(durationSec);
    } catch (e) {
      Alert.alert('Error', 'Could not open video picker.');
    } finally {
      setPickingVideo(false);
    }
  };

  const handleCreatePost = async () => {
    const caption = newCaption.trim();
    if (!caption) {
      Alert.alert('Missing text', 'Please enter something to post.');
      return;
    }
    try {
      setPosting(true);
      const username = (await AsyncStorage.getItem('username')) || 'You';
      const now = new Date().toISOString();

      const row: FeedPost = {
        post_id: Date.now(),
        emp_id: 0,
        caption,
        is_achievement: newIsAchievement,
        kind: newKind,
        created_at: now,
        image_url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
        media_type: videoUri ? 'video/mp4' : null,
        video_url: videoUri ? videoUri : null,
        video_duration_seconds:
          videoDurationSeconds != null ? Math.round(videoDurationSeconds) : null,
        employees: { name: username },
      };

      setFeeds((prev) => [row, ...prev]);
      setNewCaption('');
      setNewIsAchievement(false);
      setNewKind('post');
      setImagePreviewUri(null);
      setImageBase64(null);
      setVideoUri(null);
      setVideoDurationSeconds(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create post.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, dyn.bg]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, dyn.text]}>Feeds</Text>
        <Text style={[styles.headerSubtitle, dyn.sub]}>
          Company announcements, posts, and activity highlights.
        </Text>
      </View>

      {/* Composer */}
      <View style={[styles.composeCard, dyn.card, dyn.border]}>
        <Text style={[styles.composeTitle, dyn.text]}>Create a post</Text>
        <View style={styles.composeKindRow}>
          {(['post', 'announcement'] as FeedKind[]).map((k) => {
            const active = newKind === k;
            return (
              <TouchableOpacity
                key={k}
                style={[
                  styles.composeChip,
                  active && { backgroundColor: '#F27121' },
                  { borderColor: active ? '#F27121' : colors.border },
                ]}
                onPress={() => setNewKind(k)}
              >
                <Text
                  style={[
                    styles.composeChipText,
                    { color: active ? '#FFF' : colors.text },
                  ]}
                >
                  {k === 'post' ? 'Post' : 'Announcement'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={[styles.composeInput, dyn.text]}
          placeholder={
            newKind === 'announcement'
              ? 'Share an announcement with everyone...'
              : 'What would you like to share?'
          }
          placeholderTextColor={colors.subText}
          multiline
          value={newCaption}
          onChangeText={setNewCaption}
        />
        {imagePreviewUri && (
          <View style={styles.composeImageWrapper}>
            <Image source={{ uri: imagePreviewUri }} style={styles.composeImage} resizeMode="cover" />
          </View>
        )}
        <View style={styles.composeFooter}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickImage}
            disabled={pickingImage}
          >
            <Ionicons
              name="image-outline"
              size={16}
              color={pickingImage ? '#999' : colors.subText}
            />
            <Text style={[styles.imageButtonText, dyn.sub]}>
              {imagePreviewUri ? 'Change photo' : 'Add photo'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.imageButton, { marginLeft: 4 }]}
            onPress={handlePickVideo}
            disabled={pickingVideo}
          >
            <Ionicons
              name="videocam-outline"
              size={16}
              color={pickingVideo ? '#999' : colors.subText}
            />
            <Text style={[styles.imageButtonText, dyn.sub]}>
              {videoUri
                ? `Change video${videoDurationSeconds ? ` (${Math.round(videoDurationSeconds)}s)` : ''}`
                : 'Add video'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.achievementToggle}
            onPress={() => setNewIsAchievement((v) => !v)}
          >
            <MaterialCommunityIcons
              name={newIsAchievement ? 'star-circle' : 'star-circle-outline'}
              size={18}
              color={newIsAchievement ? '#F27121' : colors.subText}
            />
            <Text
              style={[
                styles.achievementText,
                { color: newIsAchievement ? '#F27121' : colors.subText },
              ]}
            >
              Mark as achievement
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.composePostButton,
              { backgroundColor: posting ? '#999' : '#F27121' },
            ]}
            onPress={handleCreatePost}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.composePostButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F27121" />
          <Text style={[styles.loadingText, dyn.sub]}>Loading feeds...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={[styles.feedCard, dyn.card, dyn.border]}>
              <Text style={[styles.feedDescription, dyn.sub]}>{error}</Text>
            </View>
          )}

          {!error && feeds.length === 0 && (
            <View style={[styles.feedCard, dyn.card, dyn.border]}>
              <Text style={[styles.feedDescription, dyn.sub]}>
                No feeds yet. New activities, announcements, and posts will appear here.
              </Text>
            </View>
          )}

          {feeds.map((feed) => {
            const cfg = getKindConfig(feed.kind || 'post');
            const author = feed.employees?.name || 'Someone';
            const when = formatWhen(feed.created_at);

            return (
              <View key={feed.post_id} style={[styles.feedCard, dyn.card, dyn.border]}>
                <View style={styles.feedHeader}>
                  <View style={styles.feedIconCircle}>
                    <Ionicons name={cfg.icon} size={20} color="#F27121" />
                  </View>
                  <View style={styles.feedHeaderText}>
                    <Text style={[styles.feedTitle, dyn.text]} numberOfLines={1}>
                      {author}
                    </Text>
                    <Text style={[styles.feedMeta, dyn.sub]} numberOfLines={1}>
                      {cfg.label}
                      {when ? ` • ${when}` : ''}
                    </Text>
                  </View>
                  {feed.is_achievement && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Achievement</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.feedDescription, dyn.text]}>{feed.caption}</Text>

                {feed.image_url && (
                  <View style={styles.feedImageWrapper}>
                    <Image
                      source={{
                        uri: (() => {
                          const raw = feed.image_url || '';
                          if (
                            raw.startsWith('http://') ||
                            raw.startsWith('https://') ||
                            raw.startsWith('file://')
                          ) {
                            return raw;
                          }
                          if (raw.startsWith('data:')) return raw;
                          return `data:image/jpeg;base64,${raw}`;
                        })(),
                      }}
                      style={styles.feedImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                {feed.media_type?.startsWith('video') && feed.video_url && (
                  <View style={styles.feedVideoWrapper}>
                    <Video
                      source={{ uri: feed.video_url }}
                      style={styles.feedVideo}
                      useNativeControls
                      resizeMode="cover"
                    />
                  </View>
                )}

                {feed.kind === 'activity' && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.push('/useractivity' as any)}
                  >
                    <Text style={styles.primaryButtonText}>View Activity</Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color="#FFF"
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
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
  composeCard: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  composeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  composeKindRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  composeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  composeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  composeInput: {
    minHeight: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginTop: 4,
  },
  composeImageWrapper: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  composeImage: {
    width: '100%',
    height: 160,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  achievementToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  imageButtonText: {
    fontSize: 11,
    marginLeft: 4,
  },
  achievementText: {
    fontSize: 11,
    marginLeft: 4,
  },
  composePostButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  composePostButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  feedCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,113,33,0.12)',
  },
  feedHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  feedTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  feedMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(242,113,33,0.12)',
  },
  badgeText: {
    color: '#F27121',
    fontSize: 11,
    fontWeight: '600',
  },
  feedDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#F27121',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
  },
  feedImageWrapper: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  feedImage: {
    width: '100%',
    height: 200,
  },
  feedVideoWrapper: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  feedVideo: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
});

