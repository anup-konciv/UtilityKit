import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, FlatList, Animated, Alert,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import EmptyState from '@/components/EmptyState';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#A855F7';

type Card = { id: string; front: string; back: string };
type Deck = { id: string; name: string; color: string; cards: Card[] };

const DECK_COLORS = ['#A855F7', '#3B82F6', '#10B981', '#F97316', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function FlashcardsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [deckColor, setDeckColor] = useState(DECK_COLORS[0]);
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [editDeckId, setEditDeckId] = useState<string | null>(null);

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadJSON<Deck[]>(KEYS.flashcards, []).then(setDecks);
  }, []);

  const persist = useCallback((d: Deck[]) => {
    setDecks(d);
    saveJSON(KEYS.flashcards, d);
  }, []);

  const flipCard = useCallback(() => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 10,
    }).start();
    setFlipped(f => !f);
  }, [flipped, flipAnim]);

  const nextCard = useCallback(() => {
    if (!activeDeck) return;
    flipAnim.setValue(0);
    setFlipped(false);
    setCardIdx(i => (i + 1) % activeDeck.cards.length);
  }, [activeDeck, flipAnim]);

  const prevCard = useCallback(() => {
    if (!activeDeck) return;
    flipAnim.setValue(0);
    setFlipped(false);
    setCardIdx(i => (i - 1 + activeDeck.cards.length) % activeDeck.cards.length);
  }, [activeDeck, flipAnim]);

  const shuffle = useCallback(() => {
    if (!activeDeck) return;
    const shuffled = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    const updated = decks.map(d => d.id === activeDeck.id ? { ...d, cards: shuffled } : d);
    persist(updated);
    setActiveDeck({ ...activeDeck, cards: shuffled });
    setCardIdx(0);
    flipAnim.setValue(0);
    setFlipped(false);
  }, [activeDeck, decks, persist, flipAnim]);

  const addDeck = useCallback(() => {
    if (!deckName.trim()) return;
    if (editDeckId) {
      const updated = decks.map(d => d.id === editDeckId ? { ...d, name: deckName.trim(), color: deckColor } : d);
      persist(updated);
    } else {
      persist([...decks, { id: uid(), name: deckName.trim(), color: deckColor, cards: [] }]);
    }
    setDeckName('');
    setEditDeckId(null);
    setShowAddDeck(false);
  }, [deckName, deckColor, editDeckId, decks, persist]);

  const deleteDeck = useCallback((id: string) => {
    Alert.alert('Delete Deck', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(decks.filter(d => d.id !== id)) },
    ]);
  }, [decks, persist]);

  const addCard = useCallback(() => {
    if (!cardFront.trim() || !cardBack.trim() || !activeDeck) return;
    const newCard: Card = { id: uid(), front: cardFront.trim(), back: cardBack.trim() };
    const updated = decks.map(d =>
      d.id === activeDeck.id ? { ...d, cards: [...d.cards, newCard] } : d
    );
    persist(updated);
    setActiveDeck(prev => prev ? { ...prev, cards: [...prev.cards, newCard] } : null);
    setCardFront('');
    setCardBack('');
    setShowAddCard(false);
  }, [cardFront, cardBack, activeDeck, decks, persist]);

  const deleteCard = useCallback((cardId: string) => {
    if (!activeDeck) return;
    const updated = decks.map(d =>
      d.id === activeDeck.id ? { ...d, cards: d.cards.filter(c => c.id !== cardId) } : d
    );
    persist(updated);
    const newCards = activeDeck.cards.filter(c => c.id !== cardId);
    setActiveDeck({ ...activeDeck, cards: newCards });
    if (cardIdx >= newCards.length) setCardIdx(Math.max(0, newCards.length - 1));
    flipAnim.setValue(0);
    setFlipped(false);
  }, [activeDeck, decks, persist, cardIdx, flipAnim]);

  const frontInterp = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '90deg'] });
  const backInterp = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['90deg', '90deg', '0deg'] });

  // ── Deck List View ──
  if (!activeDeck) {
    return (
      <ScreenShell
        title="Flashcards"
        accentColor={ACCENT}
        rightAction={
          <TouchableOpacity onPress={() => { setEditDeckId(null); setDeckName(''); setDeckColor(DECK_COLORS[0]); setShowAddDeck(true); }}>
            <Ionicons name="add-circle" size={28} color={ACCENT} />
          </TouchableOpacity>
        }
      >
        {decks.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="No decks yet"
            hint="Build a deck of flashcards to study any topic. Tap a card to flip and reveal the answer."
            accent={ACCENT}
            actionLabel="Create deck"
            onAction={() => { setEditDeckId(null); setDeckName(''); setDeckColor(DECK_COLORS[0]); setShowAddDeck(true); }}
          />
        ) : (
          decks.map(deck => (
            <TouchableOpacity
              key={deck.id}
              style={[styles.deckCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => { setActiveDeck(deck); setCardIdx(0); setFlipped(false); flipAnim.setValue(0); }}
            >
              <View style={[styles.deckIcon, { backgroundColor: deck.color + '20' }]}>
                <Ionicons name="albums" size={24} color={deck.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.deckName, { color: colors.text }]}>{deck.name}</Text>
                <Text style={[styles.deckCount, { color: colors.textMuted }]}>{deck.cards.length} card{deck.cards.length !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => { setEditDeckId(deck.id); setDeckName(deck.name); setDeckColor(deck.color); setShowAddDeck(true); }} style={{ padding: 4 }}>
                <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteDeck(deck.id)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        {/* Add/Edit Deck Modal */}
        <KeyboardAwareModal visible={showAddDeck} transparent animationType="fade" onRequestClose={() => setShowAddDeck(false)}>
          <View style={styles.modalBg}>
            <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editDeckId ? 'Edit Deck' : 'New Deck'}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={deckName}
                onChangeText={setDeckName}
                placeholder="Deck name..."
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <View style={styles.colorRow}>
                {DECK_COLORS.map(clr => (
                  <TouchableOpacity
                    key={clr}
                    style={[styles.colorDot, { backgroundColor: clr }, deckColor === clr && { borderWidth: 3, borderColor: colors.text }]}
                    onPress={() => setDeckColor(clr)}
                  />
                ))}
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAddDeck(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addDeck}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </KeyboardAwareModal>
      </ScreenShell>
    );
  }

  // ── Card Study View ──
  const currentCard = activeDeck.cards[cardIdx];

  return (
    <ScreenShell
      title={activeDeck.name}
      accentColor={activeDeck.color}
      rightAction={
        <TouchableOpacity onPress={() => setShowAddCard(true)}>
          <Ionicons name="add-circle" size={28} color={activeDeck.color} />
        </TouchableOpacity>
      }
    >
      {/* Back button */}
      <TouchableOpacity style={styles.backRow} onPress={() => setActiveDeck(null)}>
        <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
        <Text style={[styles.backText, { color: colors.textMuted }]}>All Decks</Text>
      </TouchableOpacity>

      {activeDeck.cards.length === 0 ? (
        <EmptyState
          icon="document-outline"
          title="No cards in this deck"
          hint="Add a question on the front and the answer on the back. Cards in the same deck share the same colour."
          accent={activeDeck.color}
          actionLabel="Add card"
          onAction={() => setShowAddCard(true)}
        />
      ) : (
        <>
          {/* Progress */}
          <Text style={[styles.progress, { color: colors.textMuted }]}>
            {cardIdx + 1} / {activeDeck.cards.length}
          </Text>

          {/* Flip Card */}
          <TouchableOpacity activeOpacity={0.95} onPress={flipCard} style={styles.cardContainer}>
            {/* Front */}
            <Animated.View style={[styles.flipCard, { backgroundColor: colors.card, borderColor: activeDeck.color + '60', transform: [{ rotateY: frontInterp }] }]}>
              <View style={[styles.cardSideBadge, { backgroundColor: activeDeck.color + '20' }]}>
                <Text style={[styles.cardSideText, { color: activeDeck.color }]}>FRONT</Text>
              </View>
              <Text style={[styles.cardText, { color: colors.text }]}>{currentCard?.front ?? ''}</Text>
              <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to flip</Text>
            </Animated.View>
            {/* Back */}
            <Animated.View style={[styles.flipCard, styles.flipCardBack, { backgroundColor: activeDeck.color + '10', borderColor: activeDeck.color + '60', transform: [{ rotateY: backInterp }] }]}>
              <View style={[styles.cardSideBadge, { backgroundColor: activeDeck.color + '20' }]}>
                <Text style={[styles.cardSideText, { color: activeDeck.color }]}>BACK</Text>
              </View>
              <Text style={[styles.cardText, { color: colors.text }]}>{currentCard?.back ?? ''}</Text>
              <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to flip</Text>
            </Animated.View>
          </TouchableOpacity>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={prevCard}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: activeDeck.color + '20', borderColor: activeDeck.color + '40' }]} onPress={shuffle}>
              <Ionicons name="shuffle" size={22} color={activeDeck.color} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: '#EF444420', borderColor: '#EF444440' }]} onPress={() => currentCard && deleteCard(currentCard.id)}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={nextCard}>
              <Ionicons name="chevron-forward" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Add Card Modal */}
      <KeyboardAwareModal visible={showAddCard} transparent animationType="fade" onRequestClose={() => setShowAddCard(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Card</Text>
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Front (Question)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={cardFront}
              onChangeText={setCardFront}
              placeholder="Question or term..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
            />
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Back (Answer)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={cardBack}
              onChangeText={setCardBack}
              placeholder="Answer or definition..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAddCard(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: activeDeck.color }]} onPress={addCard}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center' },
    deckCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    deckIcon: { width: 48, height: 48, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    deckName: { fontSize: 16, fontFamily: Fonts.semibold },
    deckCount: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
    backText: { fontSize: 13, fontFamily: Fonts.medium },
    progress: { textAlign: 'center', fontSize: 13, fontFamily: Fonts.medium, marginBottom: Spacing.md },
    cardContainer: { height: 260, marginBottom: Spacing.xl },
    flipCard: {
      position: 'absolute', width: '100%', height: '100%',
      borderRadius: Radii.xl, borderWidth: 2, padding: Spacing.xl,
      alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden',
    },
    flipCardBack: { position: 'absolute', width: '100%', height: '100%' },
    cardSideBadge: { position: 'absolute', top: Spacing.md, left: Spacing.md, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.pill },
    cardSideText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1 },
    cardText: { fontSize: 20, fontFamily: Fonts.semibold, textAlign: 'center', lineHeight: 30 },
    tapHint: { position: 'absolute', bottom: Spacing.md, fontSize: 11, fontFamily: Fonts.regular },
    controls: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
    ctrlBtn: { width: 52, height: 52, borderRadius: Radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 6 },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md, minHeight: 44 },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
