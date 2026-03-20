import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, Modal, Share, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#1D4ED8';
const { width: SCREEN_W } = Dimensions.get('window');

type Article = {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string | null;
  source: string;
  published: string;
};

type Category = { key: string; label: string; icon: string };

const CATEGORIES: Category[] = [
  { key: 'general', label: 'Top', icon: 'flame-outline' },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' },
  { key: 'technology', label: 'Tech', icon: 'hardware-chip-outline' },
  { key: 'science', label: 'Science', icon: 'flask-outline' },
  { key: 'health', label: 'Health', icon: 'fitness-outline' },
  { key: 'sports', label: 'Sports', icon: 'football-outline' },
  { key: 'entertainment', label: 'Fun', icon: 'film-outline' },
];

const COUNTRIES = [
  { code: 'us', label: 'US' },
  { code: 'gb', label: 'UK' },
  { code: 'in', label: 'India' },
  { code: 'au', label: 'AU' },
  { code: 'ca', label: 'CA' },
  { code: 'de', label: 'DE' },
  { code: 'fr', label: 'FR' },
];

function buildFallbackUrl(category: string): string {
  const topic = category === 'general' ? 'WORLD' : category.toUpperCase();
  return `https://api.rss2json.com/v1/api.json?rss_url=https://news.google.com/rss/headlines/section/topic/${topic}?hl=en`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

// ─── Article Detail View ────────────────────────────────────────────────────

function ArticleDetail({
  article, colors, onClose,
}: {
  article: Article;
  colors: ReturnType<typeof useAppTheme>['colors'];
  onClose: () => void;
}) {
  const styles = useMemo(() => createDetailStyles(colors), [colors]);

  const openFull = async () => {
    if (article.url) {
      await WebBrowser.openBrowserAsync(article.url, {
        toolbarColor: ACCENT,
        controlsColor: '#ffffff',
      });
    }
  };

  const shareArticle = async () => {
    try {
      await Share.share({ message: `${article.title}\n\n${article.url}` });
    } catch {}
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.sourceBadge, { backgroundColor: ACCENT }]}>
            <Text style={styles.sourceBadgeText} numberOfLines={1}>{article.source}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={shareArticle} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openFull} style={styles.headerBtn}>
            <Ionicons name="open-outline" size={20} color={ACCENT} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        {article.image && (
          <Image source={{ uri: article.image }} style={styles.heroImage} resizeMode="cover" />
        )}

        <View style={styles.body}>
          {/* Category & time */}
          <View style={styles.metaRow}>
            {article.published ? (
              <>
                <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>{timeAgo(article.published)}</Text>
                <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
              </>
            ) : null}
            <Text style={[styles.metaText, { color: ACCENT }]}>{article.source}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{article.title}</Text>

          {/* Published date */}
          {article.published ? (
            <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDate(article.published)}</Text>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Content */}
          {article.content ? (
            <Text style={[styles.contentText, { color: colors.text }]}>{article.content}</Text>
          ) : null}

          {article.description && article.description !== article.content ? (
            <Text style={[styles.contentText, { color: colors.text }]}>{article.description}</Text>
          ) : null}

          {/* Read more CTA */}
          <TouchableOpacity style={[styles.readMoreBtn, { backgroundColor: ACCENT }]} onPress={openFull}>
            <Ionicons name="reader-outline" size={18} color="#fff" />
            <Text style={styles.readMoreText}>Read Full Article</Text>
            <Ionicons name="open-outline" size={14} color="#ffffffcc" />
          </TouchableOpacity>

          {/* Source info */}
          <View style={[styles.sourceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.sourceIcon, { backgroundColor: ACCENT + '20' }]}>
              <Ionicons name="newspaper" size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sourceCardName, { color: colors.text }]}>{article.source}</Text>
              <Text style={[styles.sourceCardUrl, { color: colors.textMuted }]} numberOfLines={1}>{article.url}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main News Screen ───────────────────────────────────────────────────────

export default function NewsReaderScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [category, setCategory] = useState('general');
  const [country, setCountry] = useState('us');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = buildFallbackUrl(category);
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'ok' && data.items?.length > 0) {
        setArticles(
          data.items.map((item: any) => {
            const rawDesc = item.description || '';
            const cleanDesc = stripHtml(rawDesc);
            // Extract more content from description (RSS often has full content in description)
            const fullContent = item.content ? stripHtml(item.content) : cleanDesc;
            return {
              title: item.title || '',
              description: cleanDesc.slice(0, 200),
              content: fullContent,
              url: item.link || '',
              image: item.thumbnail || item.enclosure?.link || null,
              source: item.author || 'Google News',
              published: item.pubDate || '',
            };
          })
        );
        setLoading(false);
        return;
      }
    } catch {}

    try {
      const fallbackUrl = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=20&apiKey=demo`;
      const res2 = await fetch(fallbackUrl);
      const data2 = await res2.json();

      if (data2.articles?.length > 0) {
        setArticles(
          data2.articles
            .filter((a: any) => a.title && a.title !== '[Removed]')
            .map((a: any) => ({
              title: a.title,
              description: a.description || '',
              content: a.content ? stripHtml(a.content) : a.description || '',
              url: a.url,
              image: a.urlToImage,
              source: a.source?.name || '',
              published: a.publishedAt || '',
            }))
        );
        setLoading(false);
        return;
      }
    } catch {}

    setError('Unable to fetch news right now. Pull down to try again.');
    setLoading(false);
  }, [category, country]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <>
      <ScreenShell
        title="News Reader"
        accentColor={ACCENT}
        rightAction={
          <TouchableOpacity onPress={fetchNews}>
            <Ionicons name="refresh" size={24} color={ACCENT} />
          </TouchableOpacity>
        }
      >
        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catBtn, category === c.key && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => setCategory(c.key)}
            >
              <Ionicons name={c.icon as any} size={14} color={category === c.key ? '#fff' : colors.textMuted} />
              <Text style={[styles.catBtnText, { color: category === c.key ? '#fff' : colors.textMuted }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Country selector */}
        <View style={styles.countryRow}>
          {COUNTRIES.map(c => (
            <TouchableOpacity
              key={c.code}
              style={[styles.countryBtn, country === c.code && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
              onPress={() => setCountry(c.code)}
            >
              <Text style={[styles.countryBtnText, { color: country === c.code ? ACCENT : colors.textMuted }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Fetching headlines...</Text>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: ACCENT }]} onPress={fetchNews}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty */}
        {!loading && !error && articles.length === 0 && (
          <View style={styles.center}>
            <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No articles found.</Text>
          </View>
        )}

        {/* Featured article */}
        {!loading && articles.length > 0 && (
          <>
            <TouchableOpacity
              style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setSelectedArticle(articles[0])}
              activeOpacity={0.7}
            >
              {articles[0].image && (
                <Image source={{ uri: articles[0].image }} style={styles.featuredImage} resizeMode="cover" />
              )}
              <View style={styles.featuredBody}>
                <View style={styles.sourceRow}>
                  <View style={[styles.sourceDot, { backgroundColor: ACCENT }]} />
                  <Text style={[styles.sourceText, { color: ACCENT }]}>{articles[0].source}</Text>
                  {articles[0].published ? (
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo(articles[0].published)}</Text>
                  ) : null}
                </View>
                <Text style={[styles.featuredTitle, { color: colors.text }]} numberOfLines={3}>
                  {articles[0].title}
                </Text>
                {articles[0].description ? (
                  <Text style={[styles.featuredDesc, { color: colors.textMuted }]} numberOfLines={2}>
                    {articles[0].description}
                  </Text>
                ) : null}
                <View style={styles.readIndicator}>
                  <Text style={[styles.readIndicatorText, { color: ACCENT }]}>Tap to read</Text>
                  <Ionicons name="chevron-forward" size={14} color={ACCENT} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Rest of articles */}
            {articles.slice(1).map((article, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.articleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedArticle(article)}
                activeOpacity={0.7}
              >
                <View style={styles.articleBody}>
                  <View style={styles.sourceRow}>
                    <Text style={[styles.sourceText, { color: ACCENT }]}>{article.source}</Text>
                    {article.published ? (
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo(article.published)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
                    {article.title}
                  </Text>
                  {article.description ? (
                    <Text style={[styles.articleDesc, { color: colors.textMuted }]} numberOfLines={2}>
                      {article.description}
                    </Text>
                  ) : null}
                </View>
                {article.image && (
                  <Image source={{ uri: article.image }} style={styles.articleThumb} resizeMode="cover" />
                )}
              </TouchableOpacity>
            ))}

            <Text style={[styles.footer, { color: colors.textMuted }]}>
              {articles.length} articles loaded
            </Text>
          </>
        )}
      </ScreenShell>

      {/* Article detail modal */}
      <Modal
        visible={selectedArticle !== null}
        animationType="slide"
        onRequestClose={() => setSelectedArticle(null)}
      >
        {selectedArticle && (
          <ArticleDetail
            article={selectedArticle}
            colors={colors}
            onClose={() => setSelectedArticle(null)}
          />
        )}
      </Modal>
    </>
  );
}

// ─── Feed Styles ────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    catScroll: { marginBottom: Spacing.sm, flexGrow: 0 },
    catContent: { gap: 6, paddingRight: Spacing.md },
    catBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border },
    catBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    countryRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    countryBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1, borderColor: c.border },
    countryBtnText: { fontSize: 11, fontFamily: Fonts.bold },
    center: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    loadingText: { fontSize: 13, fontFamily: Fonts.medium },
    errorText: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', paddingHorizontal: Spacing.xl },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radii.md },
    retryBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular },
    featuredCard: { borderRadius: Radii.xl, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.md },
    featuredImage: { width: '100%', height: 180 },
    featuredBody: { padding: Spacing.lg },
    sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    sourceDot: { width: 6, height: 6, borderRadius: 3 },
    sourceText: { fontSize: 11, fontFamily: Fonts.bold },
    timeText: { fontSize: 11, fontFamily: Fonts.regular },
    featuredTitle: { fontSize: 18, fontFamily: Fonts.bold, lineHeight: 24, marginBottom: 6 },
    featuredDesc: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 19, marginBottom: 8 },
    readIndicator: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    readIndicatorText: { fontSize: 12, fontFamily: Fonts.semibold },
    articleCard: { flexDirection: 'row', borderRadius: Radii.lg, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.sm },
    articleBody: { flex: 1, padding: Spacing.md },
    articleTitle: { fontSize: 14, fontFamily: Fonts.bold, lineHeight: 20, marginBottom: 4 },
    articleDesc: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 17 },
    articleThumb: { width: 100, height: '100%' },
    footer: { fontSize: 11, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
  });

// ─── Detail Styles ──────────────────────────────────────────────────────────

const createDetailStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: Spacing.md, borderBottomWidth: 1 },
    backBtn: { padding: 6 },
    headerCenter: { flex: 1, alignItems: 'center' },
    sourceBadge: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: Radii.pill },
    sourceBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerBtn: { padding: 6 },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    heroImage: { width: SCREEN_W, height: SCREEN_W * 0.56 },
    body: { padding: Spacing.xl },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.md },
    metaText: { fontSize: 12, fontFamily: Fonts.medium },
    metaDot: { width: 3, height: 3, borderRadius: 1.5 },
    title: { fontSize: 24, fontFamily: Fonts.bold, lineHeight: 32, marginBottom: Spacing.sm },
    dateText: { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.lg },
    divider: { height: 1.5, borderRadius: 1, marginBottom: Spacing.lg },
    contentText: { fontSize: 16, fontFamily: Fonts.regular, lineHeight: 26, marginBottom: Spacing.lg },
    readMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radii.xl, marginBottom: Spacing.xl },
    readMoreText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
    sourceCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1 },
    sourceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sourceCardName: { fontSize: 14, fontFamily: Fonts.bold },
    sourceCardUrl: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
  });
