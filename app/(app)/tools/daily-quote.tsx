import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F59E0B';
const STORAGE_KEY = 'uk_favorite_quotes';

type Quote = { text: string; author: string; category: string };

const QUOTES: Quote[] = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', category: 'Motivation' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein', category: 'Wisdom' },
  { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde', category: 'Life' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt', category: 'Dreams' },
  { text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle', category: 'Wisdom' },
  { text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama', category: 'Happiness' },
  { text: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt', category: 'Motivation' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb', category: 'Wisdom' },
  { text: 'Your time is limited, so don\'t waste it living someone else\'s life.', author: 'Steve Jobs', category: 'Life' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins', category: 'Motivation' },
  { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon', category: 'Life' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt', category: 'Motivation' },
  { text: 'Everything you can imagine is real.', author: 'Pablo Picasso', category: 'Dreams' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha', category: 'Wisdom' },
  { text: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein', category: 'Wisdom' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney', category: 'Motivation' },
  { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky', category: 'Motivation' },
  { text: 'Whether you think you can or you think you can\'t, you\'re right.', author: 'Henry Ford', category: 'Motivation' },
  { text: 'I have not failed. I\'ve just found 10,000 ways that won\'t work.', author: 'Thomas Edison', category: 'Wisdom' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela', category: 'Motivation' },
  { text: 'The greatest glory in living lies not in never falling, but in rising every time we fall.', author: 'Nelson Mandela', category: 'Life' },
  { text: 'In three words I can sum up everything I\'ve learned about life: it goes on.', author: 'Robert Frost', category: 'Life' },
  { text: 'If you want to live a happy life, tie it to a goal, not to people or things.', author: 'Albert Einstein', category: 'Happiness' },
  { text: 'Spread love everywhere you go. Let no one ever come to you without leaving happier.', author: 'Mother Teresa', category: 'Love' },
  { text: 'The purpose of our lives is to be happy.', author: 'Dalai Lama', category: 'Happiness' },
  { text: 'Get busy living or get busy dying.', author: 'Stephen King', category: 'Life' },
  { text: 'You only live once, but if you do it right, once is enough.', author: 'Mae West', category: 'Life' },
  { text: 'Many of life\'s failures are people who did not realize how close they were to success when they gave up.', author: 'Thomas Edison', category: 'Motivation' },
  { text: 'If you look at what you have in life, you\'ll always have more.', author: 'Oprah Winfrey', category: 'Happiness' },
  { text: 'Life is really simple, but we insist on making it complicated.', author: 'Confucius', category: 'Wisdom' },
  { text: 'Keep your face always toward the sunshine — and shadows will fall behind you.', author: 'Walt Whitman', category: 'Motivation' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill', category: 'Motivation' },
  { text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson', category: 'Life' },
  { text: 'Act as if what you do makes a difference. It does.', author: 'William James', category: 'Motivation' },
  { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson', category: 'Wisdom' },
  { text: 'Happiness depends upon ourselves.', author: 'Aristotle', category: 'Happiness' },
  { text: 'We become what we think about.', author: 'Earl Nightingale', category: 'Wisdom' },
  { text: 'The best revenge is massive success.', author: 'Frank Sinatra', category: 'Motivation' },
  { text: 'Life shrinks or expands in proportion to one\'s courage.', author: 'Anais Nin', category: 'Life' },
  { text: 'What we achieve inwardly will change outer reality.', author: 'Plutarch', category: 'Wisdom' },
];

const CATEGORIES = ['All', ...Array.from(new Set(QUOTES.map(q => q.category)))];

function getDailyIndex(): number {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return seed % QUOTES.length;
}

export default function DailyQuoteScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [favorites, setFavorites] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(getDailyIndex());
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState<'today' | 'browse' | 'favorites'>('today');

  useEffect(() => {
    loadJSON<number[]>(STORAGE_KEY, []).then(setFavorites);
  }, []);

  const persist = useCallback((f: number[]) => {
    setFavorites(f);
    saveJSON(STORAGE_KEY, f);
  }, []);

  const toggleFavorite = (idx: number) => {
    persist(favorites.includes(idx) ? favorites.filter(i => i !== idx) : [...favorites, idx]);
  };

  const quote = QUOTES[currentIdx];

  const filtered = useMemo(() => {
    return QUOTES.map((q, i) => ({ ...q, idx: i }))
      .filter(q => filter === 'All' || q.category === filter);
  }, [filter]);

  const favQuotes = useMemo(() => {
    return favorites.map(i => ({ ...QUOTES[i], idx: i })).filter(Boolean);
  }, [favorites]);

  const nextRandom = () => {
    let next = Math.floor(Math.random() * QUOTES.length);
    while (next === currentIdx && QUOTES.length > 1) {
      next = Math.floor(Math.random() * QUOTES.length);
    }
    setCurrentIdx(next);
  };

  return (
    <ScreenShell title="Daily Quote" accentColor={ACCENT}>
      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(['today', 'browse', 'favorites'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === 'today' ? 'sunny-outline' : t === 'browse' ? 'list-outline' : 'heart-outline'}
              size={15}
              color={tab === t ? ACCENT : colors.textMuted}
            />
            <Text style={[styles.tabLabel, { color: tab === t ? ACCENT : colors.textMuted }]}>
              {t === 'today' ? 'Today' : t === 'browse' ? 'Browse' : 'Saved'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Today */}
      {tab === 'today' && (
        <>
          <View style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="chatbubble-outline" size={28} color={ACCENT + '40'} style={{ alignSelf: 'flex-start' }} />
            <Text style={[styles.quoteText, { color: colors.text }]}>{quote.text}</Text>
            <Text style={[styles.quoteAuthor, { color: ACCENT }]}>— {quote.author}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: ACCENT + '18' }]}>
              <Text style={[styles.categoryText, { color: ACCENT }]}>{quote.category}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: favorites.includes(currentIdx) ? ACCENT + '22' : colors.card, borderColor: colors.border }]}
              onPress={() => toggleFavorite(currentIdx)}
            >
              <Ionicons name={favorites.includes(currentIdx) ? 'heart' : 'heart-outline'} size={20} color={favorites.includes(currentIdx) ? ACCENT : colors.textMuted} />
              <Text style={[styles.actionText, { color: favorites.includes(currentIdx) ? ACCENT : colors.textMuted }]}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, flex: 2 }]}
              onPress={nextRandom}
            >
              <Ionicons name="shuffle-outline" size={20} color={ACCENT} />
              <Text style={[styles.actionText, { color: ACCENT }]}>Random Quote</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{QUOTES.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Quotes</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{CATEGORIES.length - 1}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Categories</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{favorites.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Saved</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Browse */}
      {tab === 'browse' && (
        <>
          <View style={styles.filterRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, { backgroundColor: filter === cat ? ACCENT + '22' : colors.glass, borderColor: filter === cat ? ACCENT : colors.border }]}
                onPress={() => setFilter(cat)}
              >
                <Text style={[styles.filterText, { color: filter === cat ? ACCENT : colors.textMuted }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {filtered.map(q => (
            <View key={q.idx} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listQuote, { color: colors.text }]}>{q.text}</Text>
                <Text style={[styles.listAuthor, { color: ACCENT }]}>— {q.author}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleFavorite(q.idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={favorites.includes(q.idx) ? 'heart' : 'heart-outline'} size={18} color={favorites.includes(q.idx) ? ACCENT : colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Favorites */}
      {tab === 'favorites' && (
        <>
          {favQuotes.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color={ACCENT + '40'} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No saved quotes yet. Tap the heart to save your favorites.</Text>
            </View>
          )}
          {favQuotes.map(q => (
            <View key={q.idx} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listQuote, { color: colors.text }]}>{q.text}</Text>
                <Text style={[styles.listAuthor, { color: ACCENT }]}>— {q.author}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleFavorite(q.idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="heart" size={18} color={ACCENT} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    tabBar: { flexDirection: 'row', borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.lg, overflow: 'hidden' },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radii.xl, borderWidth: 1.5, borderColor: 'transparent', margin: 3 },
    tabLabel: { fontSize: 12, fontFamily: Fonts.semibold },
    quoteCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.md },
    quoteText: { fontSize: 20, fontFamily: Fonts.medium, lineHeight: 32, fontStyle: 'italic' },
    quoteAuthor: { fontSize: 14, fontFamily: Fonts.semibold },
    categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radii.pill },
    categoryText: { fontSize: 11, fontFamily: Fonts.medium },
    actionRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1 },
    actionText: { fontSize: 13, fontFamily: Fonts.semibold },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 22, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    filterText: { fontSize: 12, fontFamily: Fonts.medium },
    listCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    listQuote: { fontSize: 14, fontFamily: Fonts.regular, lineHeight: 22, fontStyle: 'italic' },
    listAuthor: { fontSize: 12, fontFamily: Fonts.semibold, marginTop: Spacing.sm },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
