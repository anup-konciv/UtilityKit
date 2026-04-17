import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

const ACCENT = '#8B5CF6';
const { width: SCREEN_W } = Dimensions.get('window');

// ── Difficulty configs ──────────────────────────────────────────────────────
type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, { cols: number; rows: number; pairs: number; label: string }> = {
  easy:   { cols: 4, rows: 3, pairs: 6,  label: 'Easy' },
  medium: { cols: 4, rows: 4, pairs: 8,  label: 'Medium' },
  hard:   { cols: 5, rows: 4, pairs: 10, label: 'Hard' },
};

// ── Emoji pool ──────────────────────────────────────────────────────────────
const ALL_EMOJIS = [
  '🐶', '🐱', '🐸', '🦊', '🐼', '🐨', '🦁', '🐯', '🐮', '🐷',
  '🐙', '🦋', '🐢', '🦄', '🐳', '🍎', '🍕', '🍩', '🌮', '🍦',
  '🎸', '🚀', '🌈', '🎯', '🏀', '🎲', '💎', '🌻', '🍄', '🦀',
];

// ── Card type ───────────────────────────────────────────────────────────────
type Card = {
  id: number;
  emoji: string;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(pairs: number): Card[] {
  const emojis = shuffle(ALL_EMOJIS).slice(0, pairs);
  const cards: Card[] = [];
  emojis.forEach((emoji, idx) => {
    cards.push({ id: idx * 2,     emoji, pairId: idx, isFlipped: false, isMatched: false });
    cards.push({ id: idx * 2 + 1, emoji, pairId: idx, isFlipped: false, isMatched: false });
  });
  return shuffle(cards);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Animated Card Component ─────────────────────────────────────────────────
function GameCard({
  card,
  size,
  onPress,
  colors,
  disabled,
}: {
  card: Card;
  size: number;
  onPress: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  disabled: boolean;
}) {
  const flipAnim = useRef(new Animated.Value(card.isFlipped || card.isMatched ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const prevFlipped = useRef(card.isFlipped || card.isMatched);

  useEffect(() => {
    const shouldShow = card.isFlipped || card.isMatched;
    if (shouldShow !== prevFlipped.current) {
      prevFlipped.current = shouldShow;
      Animated.timing(flipAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [card.isFlipped, card.isMatched, flipAnim]);

  // Match celebration bounce
  useEffect(() => {
    if (card.isMatched) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }
  }, [card.isMatched, scaleAnim]);

  // Front rotation: 0deg at flipAnim=0, -90deg at flipAnim=0.5, -180deg at flipAnim=1
  const frontRotation = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  // Back rotation: 90deg at flipAnim=0, 90deg at flipAnim=0.5, 0deg at flipAnim=1
  const backRotation = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: ['-90deg', '-90deg', '0deg', '0deg'],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const cardBase: any = {
    width: size,
    height: size * 1.15,
    borderRadius: Radii.md,
    position: 'absolute' as const,
    backfaceVisibility: 'hidden' as const,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || card.isFlipped || card.isMatched}
      style={{ width: size, height: size * 1.15 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: size, height: size * 1.15 }}>
        {/* Face-down (front = card back) */}
        <Animated.View
          style={[
            cardBase,
            {
              backgroundColor: ACCENT,
              borderWidth: 2,
              borderColor: ACCENT + 'CC',
              transform: [{ rotateY: frontRotation }],
              opacity: frontOpacity,
              shadowColor: ACCENT,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 4,
            },
          ]}
        >
          <Text style={{ fontSize: size * 0.4, color: 'rgba(255,255,255,0.9)' }}>?</Text>
          <View
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              right: 4,
              bottom: 4,
              borderRadius: Radii.sm,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          />
        </Animated.View>

        {/* Face-up (back = emoji face) */}
        <Animated.View
          style={[
            cardBase,
            {
              backgroundColor: card.isMatched ? (colors.bg === '#0B1120' ? '#1A3A2A' : '#F0FDF4') : colors.card,
              borderWidth: 2,
              borderColor: card.isMatched ? '#10B981' : colors.border,
              transform: [{ rotateY: backRotation }],
              opacity: backOpacity,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            },
          ]}
        >
          <Text style={{ fontSize: size * 0.45 }}>{card.emoji}</Text>
          {card.isMatched && (
            <View
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
              }}
            >
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function MemoryMatchScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [cards, setCards] = useState<Card[]>(() => buildDeck(DIFFICULTY_CONFIG.easy.pairs));
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [bestScores, setBestScores] = useState<Record<Difficulty, number | null>>({
    easy: null,
    medium: null,
    hard: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const config = DIFFICULTY_CONFIG[difficulty];

  // ── Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStarted && !gameComplete) {
      timerRef.current = setInterval(() => {
        setElapsed((p) => p + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameComplete]);

  // ── New game ──────────────────────────────────────────────────────────
  const startNewGame = useCallback(
    (diff?: Difficulty) => {
      const d = diff ?? difficulty;
      if (timerRef.current) clearInterval(timerRef.current);
      setCards(buildDeck(DIFFICULTY_CONFIG[d].pairs));
      setFlippedIds([]);
      setMoves(0);
      setMatchCount(0);
      setElapsed(0);
      setGameStarted(false);
      setGameComplete(false);
      setIsChecking(false);
      if (diff) setDifficulty(d);
      haptics.tap();
    },
    [difficulty]
  );

  // ── Card tap ──────────────────────────────────────────────────────────
  const handleCardPress = useCallback(
    (id: number) => {
      if (isChecking) return;
      if (flippedIds.length >= 2) return;

      const card = cards.find((c) => c.id === id);
      if (!card || card.isFlipped || card.isMatched) return;

      haptics.tap();

      if (!gameStarted) setGameStarted(true);

      const newCards = cards.map((c) => (c.id === id ? { ...c, isFlipped: true } : c));
      setCards(newCards);

      const newFlipped = [...flippedIds, id];
      setFlippedIds(newFlipped);

      if (newFlipped.length === 2) {
        setMoves((p) => p + 1);
        setIsChecking(true);

        const first = newCards.find((c) => c.id === newFlipped[0])!;
        const second = newCards.find((c) => c.id === newFlipped[1])!;

        if (first.pairId === second.pairId) {
          // Match found
          haptics.success();
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.pairId === first.pairId ? { ...c, isMatched: true, isFlipped: false } : c
              )
            );
            setMatchCount((p) => {
              const newCount = p + 1;
              // Check for game completion
              if (newCount === DIFFICULTY_CONFIG[difficulty].pairs) {
                setGameComplete(true);
                if (timerRef.current) clearInterval(timerRef.current);
                haptics.success();

                // Update best score
                const totalMoves = moves + 1; // +1 because state hasn't updated yet
                setBestScores((prev) => {
                  const current = prev[difficulty];
                  if (current === null || totalMoves < current) {
                    return { ...prev, [difficulty]: totalMoves };
                  }
                  return prev;
                });
              }
              return newCount;
            });
            setFlippedIds([]);
            setIsChecking(false);
          }, 500);
        } else {
          // No match - flip back
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                newFlipped.includes(c.id) ? { ...c, isFlipped: false } : c
              )
            );
            setFlippedIds([]);
            setIsChecking(false);
          }, 800);
        }
      }
    },
    [cards, flippedIds, isChecking, gameStarted, difficulty, moves]
  );

  // ── Card sizing ───────────────────────────────────────────────────────
  const horizontalPadding = Spacing.lg * 2; // ScreenShell padding
  const gap = Spacing.sm;
  const availableWidth = SCREEN_W - horizontalPadding - Spacing.lg;
  const cardSize = Math.floor((availableWidth - gap * (config.cols - 1)) / config.cols);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <ScreenShell title="Memory Match" accentColor={ACCENT} scrollable={false}>
      <View style={styles.container}>
        {/* Difficulty selector */}
        <View style={styles.difficultyRow}>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.diffBtn,
                { borderColor: colors.border },
                difficulty === d && { backgroundColor: ACCENT, borderColor: ACCENT },
              ]}
              onPress={() => startNewGame(d)}
            >
              <Text
                style={[
                  styles.diffText,
                  { color: colors.textMuted },
                  difficulty === d && { color: '#fff' },
                ]}
              >
                {DIFFICULTY_CONFIG[d].label}
              </Text>
              <Text
                style={[
                  styles.diffSub,
                  { color: colors.textMuted },
                  difficulty === d && { color: 'rgba(255,255,255,0.7)' },
                ]}
              >
                {DIFFICULTY_CONFIG[d].pairs} pairs
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Ionicons name="swap-horizontal-outline" size={16} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{moves}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Moves</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(elapsed)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="checkmark-done-outline" size={16} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {matchCount}/{config.pairs}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Matches</Text>
          </View>
          {bestScores[difficulty] !== null && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{bestScores[difficulty]}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best</Text>
              </View>
            </>
          )}
        </View>

        {/* Game complete overlay */}
        {gameComplete ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.congratsEmoji}>🎉</Text>
            <Text style={[styles.congratsTitle, { color: colors.text }]}>Congratulations!</Text>
            <Text style={[styles.congratsSubtitle, { color: colors.textMuted }]}>
              You matched all {config.pairs} pairs!
            </Text>

            <View style={styles.finalStatsRow}>
              <View style={[styles.finalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.finalStatValue, { color: ACCENT }]}>{moves}</Text>
                <Text style={[styles.finalStatLabel, { color: colors.textMuted }]}>Moves</Text>
              </View>
              <View style={[styles.finalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.finalStatValue, { color: ACCENT }]}>{formatTime(elapsed)}</Text>
                <Text style={[styles.finalStatLabel, { color: colors.textMuted }]}>Time</Text>
              </View>
              <View style={[styles.finalStatBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.finalStatValue, { color: '#F59E0B' }]}>
                  {bestScores[difficulty] ?? '-'}
                </Text>
                <Text style={[styles.finalStatLabel, { color: colors.textMuted }]}>Best</Text>
              </View>
            </View>

            {bestScores[difficulty] === moves && (
              <View style={styles.newBestBadge}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.newBestText}>New Best Score!</Text>
              </View>
            )}

            <TouchableOpacity style={styles.newGameBtn} onPress={() => startNewGame()} activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.newGameBtnText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Card grid */
          <View style={styles.gridContainer}>
            <View style={[styles.grid, { gap }]}>
              {Array.from({ length: config.rows }).map((_, rowIdx) => (
                <View key={rowIdx} style={[styles.gridRow, { gap }]}>
                  {cards
                    .slice(rowIdx * config.cols, rowIdx * config.cols + config.cols)
                    .map((card) => (
                      <GameCard
                        key={card.id}
                        card={card}
                        size={cardSize}
                        onPress={() => handleCardPress(card.id)}
                        colors={colors}
                        disabled={isChecking}
                      />
                    ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* New Game button (during gameplay) */}
        {!gameComplete && (
          <TouchableOpacity
            style={[styles.resetBtn, { borderColor: colors.border }]}
            onPress={() => startNewGame()}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>New Game</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenShell>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: Spacing.md,
    },
    difficultyRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    diffBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    diffText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
    diffSub: {
      fontFamily: Fonts.regular,
      fontSize: 10,
      marginTop: 1,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radii.lg,
      borderWidth: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontFamily: Fonts.bold,
      fontSize: 16,
    },
    statLabel: {
      fontFamily: Fonts.regular,
      fontSize: 10,
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    gridContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    grid: {
      alignItems: 'center',
    },
    gridRow: {
      flexDirection: 'row',
    },
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
      alignItems: 'center',
    },
    congratsEmoji: {
      fontSize: 56,
      marginBottom: Spacing.sm,
    },
    congratsTitle: {
      fontFamily: Fonts.bold,
      fontSize: 24,
      marginBottom: Spacing.xs,
    },
    congratsSubtitle: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      marginBottom: Spacing.lg,
    },
    finalStatsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
      width: '100%',
    },
    finalStatBox: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    finalStatValue: {
      fontFamily: Fonts.bold,
      fontSize: 20,
    },
    finalStatLabel: {
      fontFamily: Fonts.regular,
      fontSize: 11,
      marginTop: 2,
    },
    newBestBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: '#F59E0B' + '20',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radii.pill,
      marginBottom: Spacing.lg,
    },
    newBestText: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      color: '#F59E0B',
    },
    newGameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxl,
      borderRadius: Radii.md,
      width: '100%',
    },
    newGameBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: '#fff',
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    resetBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
  });
