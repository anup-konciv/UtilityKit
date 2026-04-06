import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, FlatList,
  ActivityIndicator, Animated, Linking, Share, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#E11D48';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;
const CARD_H = CARD_W * 1.3;

type Photo = {
  id: string;
  author: string;
  width: number;
  height: number;
  url: string;
  download_url: string;
};

type Category = { key: string; label: string; icon: string };

const CATEGORIES: Category[] = [
  { key: 'curated', label: 'Curated', icon: 'sparkles-outline' },
  { key: 'nature', label: 'Nature', icon: 'leaf-outline' },
  { key: 'architecture', label: 'Architecture', icon: 'business-outline' },
  { key: 'people', label: 'People', icon: 'people-outline' },
  { key: 'abstract', label: 'Abstract', icon: 'color-palette-outline' },
  { key: 'travel', label: 'Travel', icon: 'airplane-outline' },
];

// Picsum gives curated photos (no key needed)
function picsumUrl(page: number): string {
  return `https://picsum.photos/v2/list?page=${page}&limit=20`;
}

// For category browsing, we use Unsplash source URLs with keywords
function categoryImageUrl(keyword: string, id: number, w: number, h: number): string {
  if (keyword === 'curated') {
    return `https://picsum.photos/id/${id}/${w}/${h}`;
  }
  // Use picsum with seed for consistent results per category
  return `https://picsum.photos/seed/${keyword}${id}/${w}/${h}`;
}

export default function WallpaperBrowseScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [category, setCategory] = useState('curated');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const fetchPhotos = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(picsumUrl(category === 'curated' ? pageNum : pageNum + CATEGORIES.findIndex(c => c.key === category) * 10));
      const data: Photo[] = await res.json();

      if (Array.isArray(data)) {
        const processed = data.map(p => ({
          ...p,
          download_url: `https://picsum.photos/id/${p.id}/${Math.min(p.width, 1080)}/${Math.min(p.height, 1920)}`,
        }));
        setPhotos(prev => append ? [...prev, ...processed] : processed);
      }
    } catch {
      // silent fail
    }

    setLoading(false);
    setLoadingMore(false);
  }, [category]);

  useEffect(() => {
    setPage(1);
    setPhotos([]);
    fetchPhotos(1);
  }, [category, fetchPhotos]);

  const loadMore = () => {
    if (loadingMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPhotos(next, true);
  };

  const toggleLike = (id: string) => {
    setLiked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sharePhoto = async (photo: Photo) => {
    try {
      await Share.share({
        message: `Check out this photo by ${photo.author}: ${photo.url}`,
        url: photo.url,
      });
    } catch {}
  };

  const openInBrowser = (url: string) => {
    Linking.openURL(url);
  };

  const renderCard = ({ item, index }: { item: Photo; index: number }) => {
    const isLiked = liked.has(item.id);
    const imageUri = `https://picsum.photos/id/${item.id}/${Math.round(CARD_W * 2)}/${Math.round(CARD_H * 2)}`;
    const thumbUri = `https://picsum.photos/id/${item.id}/${Math.round(CARD_W)}/${Math.round(CARD_H)}`;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setSelectedPhoto(item)}
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        <Image
          source={{ uri: thumbUri }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        {/* Gradient overlay at bottom */}
        <View style={styles.cardOverlay}>
          <View style={styles.cardInfo}>
            <View style={styles.authorRow}>
              <View style={[styles.authorAvatar, { backgroundColor: ACCENT }]}>
                <Text style={styles.authorInitial}>{item.author.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authorName} numberOfLines={1}>{item.author}</Text>
                <Text style={styles.photoSize}>{item.width} x {item.height}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.actionBtn}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? '#EF4444' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => sharePhoto(item)} style={styles.actionBtn}>
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openInBrowser(item.url)} style={styles.actionBtn}>
                <Ionicons name="open-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Card number badge */}
        <View style={[styles.numBadge, { backgroundColor: '#00000066' }]}>
          <Text style={styles.numBadgeText}>#{index + 1}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenShell title="Wallpapers" accentColor={ACCENT} scrollable={false}>
      <View style={styles.container}>
        {/* Category pills */}
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={c => c.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catContent}
          style={styles.catList}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[styles.catBtn, category === c.key && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => setCategory(c.key)}
            >
              <Ionicons name={c.icon as any} size={14} color={category === c.key ? '#fff' : colors.textMuted} />
              <Text style={[styles.catBtnText, { color: category === c.key ? '#fff' : colors.textMuted }]}>{c.label}</Text>
            </TouchableOpacity>
          )}
        />

        {/* Photo count & likes */}
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            {photos.length} photos loaded
          </Text>
          {liked.size > 0 && (
            <View style={styles.likeCount}>
              <Ionicons name="heart" size={12} color="#EF4444" />
              <Text style={[styles.statusText, { color: '#EF4444' }]}>{liked.size} liked</Text>
            </View>
          )}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading beautiful photos...</Text>
          </View>
        )}

        {/* Photo feed (Flipboard-style vertical cards) */}
        {!loading && (
          <FlatList
            data={photos}
            keyExtractor={item => item.id}
            renderItem={renderCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feedContent}
            snapToInterval={CARD_H + Spacing.md}
            decelerationRate="fast"
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading more...</Text>
                </View>
              ) : photos.length > 0 ? (
                <TouchableOpacity style={[styles.loadMoreBtn, { borderColor: ACCENT }]} onPress={loadMore}>
                  <Text style={[styles.loadMoreText, { color: ACCENT }]}>Load More</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.center}>
                  <Ionicons name="images-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No photos found.</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Full-screen preview modal */}
        <Modal visible={selectedPhoto !== null} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <View style={styles.modalBg}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedPhoto(null)}>
              <Ionicons name="close-circle" size={36} color="#fff" />
            </TouchableOpacity>
            {selectedPhoto && (
              <View style={styles.modalContent}>
                <Image
                  source={{ uri: `https://picsum.photos/id/${selectedPhoto.id}/${Math.min(selectedPhoto.width, 1080)}/${Math.min(selectedPhoto.height, 1920)}` }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <View style={styles.modalInfo}>
                  <Text style={styles.modalAuthor}>{selectedPhoto.author}</Text>
                  <Text style={styles.modalSize}>{selectedPhoto.width} x {selectedPhoto.height}</Text>
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => toggleLike(selectedPhoto.id)}
                    >
                      <Ionicons name={liked.has(selectedPhoto.id) ? 'heart' : 'heart-outline'} size={18} color="#fff" />
                      <Text style={styles.modalActionText}>{liked.has(selectedPhoto.id) ? 'Liked' : 'Like'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: ACCENT }]}
                      onPress={() => sharePhoto(selectedPhoto)}
                    >
                      <Ionicons name="share-outline" size={18} color="#fff" />
                      <Text style={styles.modalActionText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: '#3B82F6' }]}
                      onPress={() => openInBrowser(selectedPhoto.url)}
                    >
                      <Ionicons name="open-outline" size={18} color="#fff" />
                      <Text style={styles.modalActionText}>Open</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1 },
    catList: { flexGrow: 0, marginBottom: Spacing.sm },
    catContent: { gap: 6, paddingRight: Spacing.md },
    catBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border },
    catBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm, paddingHorizontal: 2 },
    statusText: { fontSize: 11, fontFamily: Fonts.medium },
    likeCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: Spacing.md },
    loadingText: { fontSize: 13, fontFamily: Fonts.medium },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular },
    feedContent: { paddingBottom: 40 },
    card: { width: CARD_W, height: CARD_H, borderRadius: Radii.xl, overflow: 'hidden', marginBottom: Spacing.md, alignSelf: 'center' },
    cardImage: { width: '100%', height: '100%' },
    cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 60, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
    cardInfo: { backgroundColor: '#000000AA', borderRadius: Radii.lg, padding: Spacing.md },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    authorAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    authorInitial: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    authorName: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    photoSize: { fontSize: 11, fontFamily: Fonts.regular, color: '#ffffff99' },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
    actionBtn: { padding: 4 },
    numBadge: { position: 'absolute', top: Spacing.md, left: Spacing.md, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
    numBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
    footerLoader: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    loadMoreBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: Radii.lg, borderWidth: 1.5, marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
    loadMoreText: { fontSize: 14, fontFamily: Fonts.bold },
    modalBg: { flex: 1, backgroundColor: '#000000EE', justifyContent: 'center' },
    modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
    modalContent: { flex: 1, justifyContent: 'center', paddingTop: 80 },
    modalImage: { width: '100%', flex: 1 },
    modalInfo: { padding: Spacing.xl },
    modalAuthor: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff', marginBottom: 2 },
    modalSize: { fontSize: 12, fontFamily: Fonts.regular, color: '#ffffff99', marginBottom: Spacing.lg },
    modalActions: { flexDirection: 'row', gap: Spacing.md },
    modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radii.md },
    modalActionText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
  });
