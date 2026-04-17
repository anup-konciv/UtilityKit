import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#8B5CF6';
const STORAGE_KEY = 'uk_books';

type BookStatus = 'want' | 'reading' | 'finished';
type SortMode = 'recent' | 'title' | 'rating';

type Book = {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  genre: string;
  rating: number; // 0 = unrated, 1–5
  notes: string;
  totalPages: number; // 0 = not set
  currentPage: number;
  createdAt: number;
};

const STATUS_CONFIG: Record<BookStatus, { label: string; icon: string; color: string }> = {
  want: { label: 'Want to Read', icon: 'bookmark-outline', color: '#F59E0B' },
  reading: { label: 'Reading', icon: 'book-outline', color: '#3B82F6' },
  finished: { label: 'Finished', icon: 'checkmark-circle-outline', color: '#10B981' },
};

const GENRES = [
  'Fiction', 'Non-Fiction', 'Sci-Fi', 'Mystery', 'Self-Help',
  'Biography', 'Fantasy', 'History', 'Romance', 'Horror', 'Other',
];

const GENRE_COLORS: Record<string, string> = {
  Fiction: '#8B5CF6',
  'Non-Fiction': '#3B82F6',
  'Sci-Fi': '#06B6D4',
  Mystery: '#6366F1',
  'Self-Help': '#10B981',
  Biography: '#F59E0B',
  Fantasy: '#EC4899',
  History: '#D97706',
  Romance: '#F43F5E',
  Horror: '#EF4444',
  Other: '#64748B',
};

const FILTER_TABS: { key: BookStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'want', label: 'Want to Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
];

const SORT_OPTIONS: { key: SortMode; label: string; icon: string }[] = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'title', label: 'A-Z', icon: 'text-outline' },
  { key: 'rating', label: 'Rating', icon: 'star-outline' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? '#64748B';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ─── State ────────────────────────────────────────────────────────────
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<BookStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Form state
  const [fTitle, setFTitle] = useState('');
  const [fAuthor, setFAuthor] = useState('');
  const [fStatus, setFStatus] = useState<BookStatus>('want');
  const [fGenre, setFGenre] = useState('Fiction');
  const [fRating, setFRating] = useState(0);
  const [fNotes, setFNotes] = useState('');
  const [fTotalPages, setFTotalPages] = useState('');
  const [fCurrentPage, setFCurrentPage] = useState('');

  // ─── Persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    loadJSON<Book[]>(STORAGE_KEY, []).then(setBooks);
  }, []);

  const persist = useCallback((next: Book[]) => {
    setBooks(next);
    saveJSON(STORAGE_KEY, next);
  }, []);

  // ─── Form helpers ─────────────────────────────────────────────────────
  const resetForm = () => {
    setEditId(null);
    setFTitle('');
    setFAuthor('');
    setFStatus('want');
    setFGenre('Fiction');
    setFRating(0);
    setFNotes('');
    setFTotalPages('');
    setFCurrentPage('');
  };

  const openAdd = (book?: Book) => {
    if (book) {
      setEditId(book.id);
      setFTitle(book.title);
      setFAuthor(book.author);
      setFStatus(book.status);
      setFGenre(book.genre);
      setFRating(book.rating);
      setFNotes(book.notes);
      setFTotalPages(book.totalPages > 0 ? String(book.totalPages) : '');
      setFCurrentPage(book.currentPage > 0 ? String(book.currentPage) : '');
    } else {
      resetForm();
    }
    setShowAdd(true);
  };

  const saveBook = () => {
    if (!fTitle.trim()) return;
    const totalPages = parseInt(fTotalPages, 10) || 0;
    const currentPage = parseInt(fCurrentPage, 10) || 0;
    const rating = fStatus === 'finished' ? fRating : 0;

    if (editId) {
      const existing = books.find(b => b.id === editId);
      persist(books.map(b =>
        b.id === editId
          ? {
              ...b,
              title: fTitle.trim(),
              author: fAuthor.trim(),
              status: fStatus,
              genre: fGenre,
              rating,
              notes: fNotes.trim(),
              totalPages,
              currentPage: Math.min(currentPage, totalPages || currentPage),
            }
          : b,
      ));
    } else {
      const newBook: Book = {
        id: uid(),
        title: fTitle.trim(),
        author: fAuthor.trim(),
        status: fStatus,
        genre: fGenre,
        rating,
        notes: fNotes.trim(),
        totalPages,
        currentPage: Math.min(currentPage, totalPages || currentPage),
        createdAt: Date.now(),
      };
      persist([newBook, ...books]);
    }
    setShowAdd(false);
    resetForm();
  };

  const deleteBook = (id: string) => {
    Alert.alert('Delete Book', 'Remove this book from your library?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => persist(books.filter(b => b.id !== id)),
      },
    ]);
  };

  // ─── Derived data ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = filter === 'all' ? books : books.filter(b => b.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
      );
    }
    // Sort
    const sorted = [...list];
    switch (sortMode) {
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
        break;
      case 'recent':
      default:
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    return sorted;
  }, [books, filter, search, sortMode]);

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = books.length;
    const wantCount = books.filter(b => b.status === 'want').length;
    const readingCount = books.filter(b => b.status === 'reading').length;
    const finishedCount = books.filter(b => b.status === 'finished').length;

    const rated = books.filter(b => b.rating > 0);
    const avgRating = rated.length > 0
      ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
      : '--';

    // Favorite genre
    const genreCounts: Record<string, number> = {};
    for (const b of books) {
      genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
    }
    let favGenre = '--';
    let maxCount = 0;
    for (const [g, c] of Object.entries(genreCounts)) {
      if (c > maxCount) {
        maxCount = c;
        favGenre = g;
      }
    }

    return { total, wantCount, readingCount, finishedCount, avgRating, favGenre };
  }, [books]);

  // ─── Tab counts ───────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    all: books.length,
    want: books.filter(b => b.status === 'want').length,
    reading: books.filter(b => b.status === 'reading').length,
    finished: books.filter(b => b.status === 'finished').length,
  }), [books]);

  // ─── Empty state messages ─────────────────────────────────────────────
  const emptyMessage = useMemo(() => {
    if (search.trim()) return 'No books match your search';
    switch (filter) {
      case 'want': return 'No books on your wishlist yet';
      case 'reading': return 'You are not reading anything right now';
      case 'finished': return 'No finished books yet';
      default: return 'Your library is empty. Add your first book!';
    }
  }, [filter, search]);

  const emptyIcon = useMemo((): keyof typeof Ionicons.glyphMap => {
    if (search.trim()) return 'search-outline';
    switch (filter) {
      case 'want': return 'bookmark-outline';
      case 'reading': return 'book-outline';
      case 'finished': return 'trophy-outline';
      default: return 'library-outline';
    }
  }, [filter, search]);

  // ─── Render: Star Rating ──────────────────────────────────────────────
  const StarRating = ({ value, onChange, size = 24 }: { value: number; onChange?: (v: number) => void; size?: number }) => (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity
          key={i}
          onPress={() => onChange?.(i === value ? 0 : i)}
          disabled={!onChange}
          hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
        >
          <Ionicons
            name={i <= value ? 'star' : 'star-outline'}
            size={size}
            color={i <= value ? '#F59E0B' : colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Render: Progress Bar ─────────────────────────────────────────────
  const ProgressBar = ({ current, total }: { current: number; total: number }) => {
    const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
    return (
      <View style={styles.progressWrap}>
        <View style={[styles.progressTrack, { backgroundColor: colors.glass }]}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#3B82F6' }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {current}/{total} pages ({pct}%)
        </Text>
      </View>
    );
  };

  return (
    <ScreenShell
      title="Book Tracker"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => openAdd()}>
          <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* ─── Stats Card ───────────────────────────────────────────────── */}
      {books.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowStats(s => !s)}
          style={[styles.statsCard, { backgroundColor: ACCENT + '14', borderColor: ACCENT + '30' }]}
        >
          <View style={styles.statsHeader}>
            <View style={styles.statsHeaderLeft}>
              <Ionicons name="library" size={18} color={ACCENT} />
              <Text style={[styles.statsTitle, { color: colors.text }]}>Library Stats</Text>
            </View>
            <Ionicons
              name={showStats ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </View>

          {showStats && (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: ACCENT }]}>{stats.total}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.wantCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wishlist</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.readingCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reading</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.finishedCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Done</Text>
                </View>
              </View>

              <View style={[styles.statsExtraRow, { borderTopColor: colors.border }]}>
                <View style={styles.statsExtraItem}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={[styles.statsExtraLabel, { color: colors.textMuted }]}>Avg Rating</Text>
                  <Text style={[styles.statsExtraValue, { color: colors.text }]}>{stats.avgRating}</Text>
                </View>
                <View style={[styles.statsExtraDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statsExtraItem}>
                  <Ionicons name="heart" size={14} color={stats.favGenre !== '--' ? getGenreColor(stats.favGenre) : colors.textMuted} />
                  <Text style={[styles.statsExtraLabel, { color: colors.textMuted }]}>Top Genre</Text>
                  <Text style={[styles.statsExtraValue, { color: colors.text }]}>{stats.favGenre}</Text>
                </View>
              </View>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* ─── Search ───────────────────────────────────────────────────── */}
      <View style={[styles.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by title or author..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Filter Tabs ──────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {FILTER_TABS.map(tab => {
          const active = filter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterBtn,
                active && { backgroundColor: ACCENT + '20', borderColor: ACCENT },
              ]}
              onPress={() => setFilter(tab.key)}
            >
              <Text
                style={[styles.filterText, { color: active ? ACCENT : colors.textMuted }]}
              >
                {tab.label} ({tabCounts[tab.key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── Sort Bar ─────────────────────────────────────────────────── */}
      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort:</Text>
        {SORT_OPTIONS.map(opt => {
          const active = sortMode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortBtn,
                active && { backgroundColor: ACCENT + '18' },
              ]}
              onPress={() => setSortMode(opt.key)}
            >
              <Ionicons
                name={opt.icon as any}
                size={13}
                color={active ? ACCENT : colors.textMuted}
              />
              <Text style={[styles.sortBtnText, { color: active ? ACCENT : colors.textMuted }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Book List ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name={emptyIcon} size={52} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyMessage}</Text>
          {!search.trim() && filter === 'all' && (
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: ACCENT }]}
              onPress={() => openAdd()}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Add a Book</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        filtered.map(book => {
          const statusCfg = STATUS_CONFIG[book.status];
          const genreColor = getGenreColor(book.genre);
          const showProgress = book.status === 'reading' && book.totalPages > 0;

          return (
            <View
              key={book.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Top row: genre tag + status badge */}
              <View style={styles.cardTopRow}>
                <View style={[styles.genreBadge, { backgroundColor: genreColor + '18' }]}>
                  <Text style={[styles.genreText, { color: genreColor }]}>{book.genre}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
                  <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>
                    {statusCfg.label}
                  </Text>
                </View>
              </View>

              {/* Title & Author */}
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {book.title}
              </Text>
              <Text style={[styles.cardAuthor, { color: colors.textMuted }]} numberOfLines={1}>
                by {book.author || 'Unknown'}
              </Text>

              {/* Star rating for finished */}
              {book.status === 'finished' && book.rating > 0 && (
                <View style={styles.cardRatingRow}>
                  <StarRating value={book.rating} size={16} />
                </View>
              )}

              {/* Progress bar for reading */}
              {showProgress && (
                <ProgressBar current={book.currentPage} total={book.totalPages} />
              )}

              {/* Pages info if set but not reading or no progress */}
              {book.totalPages > 0 && !showProgress && (
                <View style={styles.pagesRow}>
                  <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.pagesText, { color: colors.textMuted }]}>
                    {book.totalPages} pages
                  </Text>
                </View>
              )}

              {/* Notes preview */}
              {book.notes.length > 0 && (
                <Text style={[styles.cardNotes, { color: colors.textMuted }]} numberOfLines={2}>
                  {book.notes}
                </Text>
              )}

              {/* Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.glass }]}
                  onPress={() => openAdd(book)}
                >
                  <Ionicons name="create-outline" size={15} color={colors.textMuted} />
                  <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#EF444418' }]}
                  onPress={() => deleteBook(book.id)}
                >
                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                  <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* ─── Add / Edit Modal ─────────────────────────────────────────── */}
      <KeyboardAwareModal
        visible={showAdd}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowAdd(false); resetForm(); }}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editId ? 'Edit Book' : 'Add Book'}
              </Text>

              {/* Title */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Title *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={fTitle}
                onChangeText={setFTitle}
                placeholder="Book title"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />

              {/* Author */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Author</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={fAuthor}
                onChangeText={setFAuthor}
                placeholder="Author name"
                placeholderTextColor={colors.textMuted}
              />

              {/* Status */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Status</Text>
              <View style={styles.statusRow}>
                {(['want', 'reading', 'finished'] as BookStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const active = fStatus === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusOption,
                        active && { backgroundColor: cfg.color + '20', borderColor: cfg.color },
                      ]}
                      onPress={() => setFStatus(s)}
                    >
                      <Ionicons
                        name={cfg.icon as any}
                        size={14}
                        color={active ? cfg.color : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.statusOptionText,
                          { color: active ? cfg.color : colors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Genre chips */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Genre</Text>
              <View style={styles.genreGrid}>
                {GENRES.map(g => {
                  const active = fGenre === g;
                  const gc = getGenreColor(g);
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genreChip,
                        { borderColor: colors.border },
                        active && { backgroundColor: gc + '20', borderColor: gc },
                      ]}
                      onPress={() => setFGenre(g)}
                    >
                      <Text
                        style={[
                          styles.genreChipText,
                          { color: active ? gc : colors.textMuted },
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pages */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Pages (optional)</Text>
              <View style={styles.pagesInputRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={fTotalPages}
                    onChangeText={setFTotalPages}
                    placeholder="Total pages"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                {fStatus === 'reading' && (
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                      value={fCurrentPage}
                      onChangeText={setFCurrentPage}
                      placeholder="Current page"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                )}
              </View>

              {/* Rating (only for finished) */}
              {fStatus === 'finished' && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Rating</Text>
                  <View style={{ marginBottom: Spacing.md }}>
                    <StarRating value={fRating} onChange={setFRating} size={32} />
                  </View>
                </>
              )}

              {/* Notes */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Notes (optional)</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                    height: 80,
                    textAlignVertical: 'top',
                  },
                ]}
                value={fNotes}
                onChangeText={setFNotes}
                placeholder="Your thoughts, favorite quotes..."
                placeholderTextColor={colors.textMuted}
                multiline
              />

              {/* Buttons */}
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                  onPress={() => { setShowAdd(false); resetForm(); }}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: ACCENT }]}
                  onPress={saveBook}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {editId ? 'Update' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Stats card
    statsCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    statsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statsHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    statsTitle: {
      fontSize: 15,
      fontFamily: Fonts.bold,
    },
    statsGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginTop: Spacing.lg,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statValue: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    statLabel: {
      fontSize: 10,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    statsExtraRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
    },
    statsExtraItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      justifyContent: 'center',
    },
    statsExtraLabel: {
      fontSize: 11,
      fontFamily: Fonts.medium,
    },
    statsExtraValue: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    statsExtraDivider: {
      width: 1,
      height: 20,
    },

    // Search
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radii.md,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
      paddingVertical: 2,
    },

    // Filter tabs
    filterScroll: {
      marginBottom: Spacing.md,
      flexGrow: 0,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 8,
    },
    filterText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // Sort
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    sortLabel: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radii.pill,
    },
    sortBtnText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
    },

    // Empty state
    emptyWrap: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: Radii.pill,
      marginTop: Spacing.sm,
    },
    emptyBtnText: {
      fontSize: 14,
      fontFamily: Fonts.bold,
      color: '#fff',
    },

    // Book card
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    genreBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: Radii.pill,
    },
    genreText: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: Radii.pill,
    },
    statusText: {
      fontSize: 10,
      fontFamily: Fonts.bold,
    },
    cardTitle: {
      fontSize: 17,
      fontFamily: Fonts.bold,
      marginBottom: 2,
    },
    cardAuthor: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.sm,
    },
    cardRatingRow: {
      marginBottom: Spacing.sm,
    },
    cardNotes: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      fontStyle: 'italic',
      marginBottom: Spacing.sm,
      lineHeight: 18,
    },
    pagesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: Spacing.sm,
    },
    pagesText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.pill,
    },
    actionBtnText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // Progress bar
    progressWrap: {
      marginBottom: Spacing.sm,
      gap: 4,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressText: {
      fontSize: 11,
      fontFamily: Fonts.medium,
    },

    // Modal
    modalBg: {
      flex: 1,
      backgroundColor: '#00000066',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    modalCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      maxHeight: '90%',
    },
    modalTitle: {
      fontSize: 20,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.lg,
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    modalInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 15,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.md,
    },

    // Status selector
    statusRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statusOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    statusOptionText: {
      fontSize: 10,
      fontFamily: Fonts.semibold,
    },

    // Genre chips
    genreGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    genreChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    genreChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // Pages input
    pagesInputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },

    // Modal buttons
    modalBtns: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: Radii.md,
      alignItems: 'center',
    },
    modalBtnText: {
      fontSize: 15,
      fontFamily: Fonts.bold,
    },
  });
