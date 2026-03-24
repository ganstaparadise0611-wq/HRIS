import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUPABASE_ANON_KEY, SUPABASE_URL, getBackendUrl } from '../../constants/backend-config';
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

function guessFileExtFromMime(mime: string | null | undefined) {
  const m = (mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  if (m === 'video/quicktime') return 'mov';
  if (m.startsWith('video/')) return 'mp4';
  if (m.startsWith('image/')) return 'jpg';
  return 'bin';
}

async function uploadToSupabasePublicBucket(params: {
  bucket: string;
  fileUri: string;
  fileName: string;
  contentType: string;
}) {
  const { bucket, fileUri, fileName, contentType } = params;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

  const uploadRes = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadRes.status < 200 || uploadRes.status >= 300) {
    throw new Error(
      `Failed to upload file (${uploadRes.status}): ${uploadRes.body?.slice(0, 120)}`
    );
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}

// Video Player Component with loading state
function VideoPlayer({ videoUrl, postId }: { videoUrl: string; postId: number }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<Video>(null);

  // Cleanup: pause and unload video when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  return (
    <View style={styles.feedVideoWrapper}>
      {!shouldLoad && !hasError && (
        <TouchableOpacity
          style={styles.videoTapToLoadOverlay}
          onPress={() => setShouldLoad(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="play-circle-outline" size={56} color="#FFF" />
          <Text style={styles.videoLoadingText}>Tap to load video</Text>
        </TouchableOpacity>
      )}
      {shouldLoad && isLoading && !hasError && (
        <View style={styles.videoLoadingOverlay}>
          <ActivityIndicator size="large" color="#F27121" />
          <Text style={styles.videoLoadingText}>Loading video...</Text>
        </View>
      )}
      {hasError && (
        <View style={styles.videoErrorOverlay}>
          <Ionicons name="alert-circle-outline" size={48} color="#999" />
          <Text style={styles.videoErrorText}>Video unavailable</Text>
        </View>
      )}
      {shouldLoad && (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.feedVideo}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isMuted={false}
          onLoadStart={() => {
            setIsLoading(true);
            setHasError(false);
          }}
          onReadyForDisplay={() => {
            setIsLoading(false);
          }}
          onLoad={() => {
            setIsLoading(false);
          }}
          onError={(error) => {
            console.log('Video load error for post', postId, ':', error);
            setIsLoading(false);
            setHasError(true);
          }}
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (status.isLoaded && isLoading) {
              setIsLoading(false);
            }
          }}
        />
      )}
    </View>
  );
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
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
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

  // Load shared feeds from Supabase so all users see the same posts
  useEffect(() => {
    const loadFeeds = async () => {
      try {
        setLoading(true);
        setError(null);

        const base = `${SUPABASE_URL}/rest/v1/feeds_posts`;
        const select =
          'post_id,emp_id,caption,image_url,is_achievement,kind,created_at,activity_id,media_type,video_url,video_duration_seconds,employees(name)';
        // Only show posts that were created via the Feeds interface itself
        const query =
          `${base}?select=${encodeURIComponent(select)}` +
          `&kind=in.(post,announcement)` +
          `&order=created_at.desc`;

        const res = await fetch(query, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Failed to load feeds (${res.status}): ${txt.slice(0, 120)}`);
        }

        const data = (await res.json()) as FeedPost[];
        setFeeds(data || []);
      } catch (_e) {
        setError('Could not load feeds right now.');
      } finally {
        setLoading(false);
      }
    };

    loadFeeds();
  }, []);

  const getImageSource = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    
    const raw = imageUrl.trim();
    
    // Valid URLs
    if (raw.startsWith('https://')) return raw;
    if (raw.startsWith('data:')) return raw;
    // Stored as Supabase Storage object path (older/alternate format)
    if (raw.startsWith('Posts/')) {
      return `${SUPABASE_URL}/storage/v1/object/public/${raw}`;
    }
    
    // HTTP URLs - might not work on different networks
    if (raw.startsWith('http://')) {
      console.warn('HTTP URL found in feeds - may not work on different networks:', raw.slice(0, 50));
      return raw;
    }
    
    // Local file paths - won't work across devices
    if (raw.startsWith('file://')) {
      console.warn('Local file path found - cannot display across devices:', raw.slice(0, 50));
      return null; // Don't show broken images
    }
    
    // Assume raw base64
    return `data:image/jpeg;base64,${raw}`;
  };

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
        base64: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setImagePreviewUri(asset.uri ?? null);
      setImageMimeType((asset as any)?.mimeType ?? null);
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
      setImageMimeType(null);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo/video access to attach a video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.5, // Increased compression for faster loading
        videoMaxDuration: 60, // Limit to 60 seconds for reasonable file sizes
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      
      // Check file size (rough estimate)
      const fileSize = asset.fileSize || 0;
      if (fileSize > 30 * 1024 * 1024) { // 30MB recommended for faster playback
        Alert.alert(
          'Video too large',
          'This video may take a long time to start. Please pick a shorter/smaller one (recommended under 30MB).'
        );
        return;
      }
      
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
      // Resolve emp_id from stored userId (log_id)
      const logId = await AsyncStorage.getItem('userId');
      if (!logId) {
        Alert.alert('Not logged in', 'Please log in again to post.');
        setPosting(false);
        return;
      }

      const empRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employees?log_id=eq.${encodeURIComponent(
          logId
        )}&select=emp_id&limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!empRes.ok) {
        throw new Error('Failed to resolve employee ID.');
      }
      const empRows = (await empRes.json()) as { emp_id: number }[];
      if (!empRows || empRows.length === 0) {
        throw new Error('No employee record linked to this account.');
      }
      const empId = empRows[0].emp_id;

      // Optional: upload image to Supabase Storage if one is selected
      let imageUrl: string | null = null;

      // Optional: upload video to Supabase Storage if one is selected
      let videoUrl: string | null = null;
      let mediaType: string | null = null;
      let durationSeconds: number | null = null;

      // Use the existing public bucket from Supabase Storage.
      const bucket = 'Posts';

      if (imagePreviewUri) {
        const contentType = imageMimeType || 'image/jpeg';
        const ext = guessFileExtFromMime(contentType);
        const fileName = `${empId}_${Date.now()}.${ext}`;
        imageUrl = await uploadToSupabasePublicBucket({
          bucket,
          fileUri: imagePreviewUri,
          fileName,
          contentType,
        });
      }

      if (videoUri) {
        const fileName = `${empId}_${Date.now()}.mp4`;
        videoUrl = await uploadToSupabasePublicBucket({
          bucket,
          fileUri: videoUri,
          fileName,
          contentType: 'video/mp4',
        });
        mediaType = 'video/mp4';
        durationSeconds = videoDurationSeconds != null ? Math.round(videoDurationSeconds) : null;
      }

      const body: any = {
        emp_id: empId,
        caption,
        is_achievement: newIsAchievement,
        kind: newKind,
      };

      // Only attach one media type per post
      if (videoUrl) {
        body.media_type = mediaType;
        body.video_url = videoUrl;
        if (durationSeconds != null) {
          body.video_duration_seconds = durationSeconds;
        }
      } else if (imageUrl) {
        body.image_url = imageUrl;
        body.media_type = imageMimeType || 'image/jpeg';
      }

      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/feeds_posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      });

      if (!postRes.ok) {
        const txt = await postRes.text();
        throw new Error(`Failed to create post (${postRes.status}): ${txt.slice(0, 120)}`);
      }

      const created = (await postRes.json()) as FeedPost[];
      const row = created && created[0] ? created[0] : null;
      if (row) {
        setFeeds((prev) => [row, ...prev]);
      }
      setNewCaption('');
      setNewIsAchievement(false);
      setNewKind('post');
      setImagePreviewUri(null);
      setImageMimeType(null);
      setVideoUri(null);
      setVideoDurationSeconds(null);

      // Broadcast push notification to all users about the new post
      try {
        const notifTitle = newKind === 'announcement'
          ? '📣 New Announcement'
          : newIsAchievement
            ? '🏆 New Achievement'
            : '📰 New Post';
        const notifBody = caption.length > 80 ? caption.slice(0, 77) + '...' : caption;
        await fetch(`${getBackendUrl()}/notify-broadcast.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ title: notifTitle, body: notifBody, type: 'feeds' }),
        });
      } catch (_notifErr) {
        // Notification failure should not block the post success
      }
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

                {feed.image_url && (() => {
                  const imageSource = getImageSource(feed.image_url);
                  if (!imageSource) return null; // Skip broken images
                  
                  return (
                    <View style={styles.feedImageWrapper}>
                      <Image
                        source={{ uri: imageSource }}
                        style={styles.feedImage}
                        resizeMode="cover"
                        fadeDuration={120}
                        onError={(error) => {
                          console.log('Image load error for post', feed.post_id, ':', error.nativeEvent.error);
                        }}
                      />
                    </View>
                  );
                })()}

                {feed.media_type?.startsWith('video') && feed.video_url && (
                  <VideoPlayer videoUrl={feed.video_url} postId={feed.post_id} />
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
    position: 'relative',
    backgroundColor: '#000',
    height: 220,
  },
  feedVideo: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
  videoTapToLoadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  videoLoadingText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 13,
  },
  videoErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  videoErrorText: {
    color: '#999',
    marginTop: 12,
    fontSize: 13,
  },
});

