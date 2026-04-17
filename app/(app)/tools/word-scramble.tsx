import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EC4899';

const WORDS = [
  'APPLE', 'BEACH', 'CLOUD', 'DANCE', 'EARTH', 'FLAME', 'GRAPE', 'HEART',
  'IMAGE', 'JELLY', 'KNIFE', 'LEMON', 'MAGIC', 'NORTH', 'OCEAN', 'PIANO',
  'QUEEN', 'RIVER', 'STONE', 'TIGER', 'ANGEL', 'BRAVE', 'CREAM', 'DREAM',
  'EAGLE', 'FRESH', 'GLOBE', 'HONEY', 'IVORY', 'JUICE', 'KOALA', 'LIGHT',
  'MOUSE', 'NOVEL', 'OLIVE', 'PEARL', 'RADAR', 'SMILE', 'TRAIN', 'UNITY',
  'VIVID', 'WITCH', 'PIXEL', 'BLISS', 'CHARM', 'FROST', 'SPARK', 'SWIFT',
  'BLOOM', 'QUEST', 'GLAZE', 'PRISM', 'BRISK', 'CIDER', 'HAVEN',
];

function scrambleWord(word: string): string {
  const letters = word.split('');
  let scrambled = letters.slice();
  // Keep shuffling until it differs from the original
  let attempts = 0;
  do {
    for (let i = scrambled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
    }
    attempts++;
  } while (scrambled.join('') === word && attempts < 50);
  return scrambled.join('');
}

function pickRandomWord(exclude: string[]): string {
  const available = WORDS.filter((w) => !exclude.includes(w));
  if (available.length === 0) return WORDS[Math.floor(Math.random() * WORDS.length)];
  return available[Math.floor(Math.random() * available.length)];
}

type GamePhase = 'playing' | 'summary';

export default function WordScrambleScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Game settings
  const [endless, setEndless] = useState(false);
  const ROUND_LIMIT = 10;

  // Game state
  const [currentWord, setCurrentWord] = useState('');
  const [scrambled, setScrambled] = useState('');
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [attempts, setAttempts] = useState(3);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedPositions, setRevealedPositions] = useState<number[]>([]);
  const [timer, setTimer] = useState(30);
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  // Feedback state
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | 'skip' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Animation
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize first word
  useEffect(() => {
    startNewWord([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing' || feedback === 'correct' || showAnswer) return;

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round, feedback, showAnswer]);

  const startNewWord = useCallback((excluded: string[]) => {
    const word = pickRandomWord(excluded);
    setCurrentWord(word);
    setScrambled(scrambleWord(word));
    setGuess('');
    setAttempts(3);
    setHintsUsed(0);
    setRevealedPositions([]);
    setTimer(30);
    setFeedback(null);
    setShowAnswer(false);
    setUsedWords((prev) => [...prev, word]);
  }, []);

  const handleTimeout = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFeedback('timeout');
    setShowAnswer(true);
    setStreak(0);
    showFeedbackAndAdvance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, endless, currentWord]);

  const showFeedbackAndAdvance = useCallback(() => {
    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      if (!endless && round >= ROUND_LIMIT) {
        setPhase('summary');
      } else {
        setRound((r) => r + 1);
        startNewWord([...usedWords, currentWord]);
      }
    }, 1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, endless, currentWord, usedWords, startNewWord]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleCheck = useCallback(() => {
    if (!guess.trim() || feedback === 'correct' || showAnswer) return;

    if (guess.trim().toUpperCase() === currentWord) {
      // Correct
      if (timerRef.current) clearInterval(timerRef.current);
      setFeedback('correct');
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);

      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(feedbackOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();

        if (!endless && round >= ROUND_LIMIT) {
          setPhase('summary');
        } else {
          setRound((r) => r + 1);
          startNewWord([...usedWords, currentWord]);
        }
      }, 1200);
    } else {
      // Wrong
      setFeedback('wrong');
      triggerShake();
      const newAttempts = attempts - 1;
      setAttempts(newAttempts);

      if (newAttempts <= 0) {
        // Out of attempts
        if (timerRef.current) clearInterval(timerRef.current);
        setShowAnswer(true);
        setStreak(0);

        setTimeout(() => {
          if (!endless && round >= ROUND_LIMIT) {
            setPhase('summary');
          } else {
            setRound((r) => r + 1);
            startNewWord([...usedWords, currentWord]);
          }
        }, 2000);
      } else {
        setTimeout(() => setFeedback(null), 800);
      }
      setGuess('');
    }
  }, [guess, currentWord, feedback, showAnswer, streak, bestStreak, attempts, round, endless, usedWords, startNewWord, triggerShake, feedbackOpacity]);

  const handleHint = useCallback(() => {
    if (hintsUsed >= 2 || feedback === 'correct' || showAnswer) return;

    const unrevealed = currentWord
      .split('')
      .map((_, i) => i)
      .filter((i) => !revealedPositions.includes(i));

    if (unrevealed.length === 0) return;

    const pos = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    setRevealedPositions((prev) => [...prev, pos]);
    setHintsUsed((h) => h + 1);
  }, [hintsUsed, feedback, showAnswer, currentWord, revealedPositions]);

  const handleSkip = useCallback(() => {
    if (feedback === 'correct' || showAnswer) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setFeedback('skip');
    setShowAnswer(true);
    setStreak(0);
    setSkippedCount((c) => c + 1);
    showFeedbackAndAdvance();
  }, [feedback, showAnswer, showFeedbackAndAdvance]);

  const resetGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setRound(1);
    setCorrectCount(0);
    setSkippedCount(0);
    setUsedWords([]);
    setPhase('playing');
    startNewWord([]);
  }, [startNewWord]);

  const timerColor = timer <= 5 ? '#EF4444' : timer <= 10 ? '#F59E0B' : colors.text;
  const timerProgress = timer / 30;

  // Summary screen
  if (phase === 'summary') {
    const accuracy = round > 0 ? Math.round((correctCount / round) * 100) : 0;
    return (
      <ScreenShell title="Word Scramble" accentColor={ACCENT}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryHeader}>
            <Ionicons name="trophy" size={48} color={ACCENT} />
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Game Over!</Text>
            <Text style={[styles.summarySubtitle, { color: colors.textMuted }]}>
              Here's how you did
            </Text>
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.summaryStatRow}>
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: ACCENT }]}>{score}</Text>
                <Text style={[styles.summaryStatLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: '#10B981' }]}>{correctCount}</Text>
                <Text style={[styles.summaryStatLabel, { color: colors.textMuted }]}>Correct</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatValue, { color: '#F59E0B' }]}>{bestStreak}</Text>
                <Text style={[styles.summaryStatLabel, { color: colors.textMuted }]}>Best Streak</Text>
              </View>
            </View>

            <View style={[styles.summaryDetailRow, { borderTopColor: colors.border }]}>
              <View style={styles.summaryDetailItem}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <Text style={[styles.summaryDetailText, { color: colors.text }]}>
                  {accuracy}% Accuracy
                </Text>
              </View>
              <View style={styles.summaryDetailItem}>
                <Ionicons name="play-skip-forward-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.summaryDetailText, { color: colors.text }]}>
                  {skippedCount} Skipped
                </Text>
              </View>
              <View style={styles.summaryDetailItem}>
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text style={[styles.summaryDetailText, { color: colors.text }]}>
                  {round - correctCount - skippedCount} Failed
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={resetGame} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => { setEndless(!endless); resetGame(); }}
          activeOpacity={0.7}
        >
          <Ionicons name={endless ? 'list-outline' : 'infinite-outline'} size={18} color={colors.textMuted} />
          <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
            {endless ? 'Switch to 10 Rounds' : 'Switch to Endless'}
          </Text>
        </TouchableOpacity>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Word Scramble" accentColor={ACCENT}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, !endless && styles.modeBtnActive]}
          onPress={() => { if (endless) { setEndless(false); resetGame(); } }}
          activeOpacity={0.7}
        >
          <Ionicons name="list-outline" size={16} color={!endless ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeText, !endless && styles.modeTextActive]}>10 Rounds</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, endless && styles.modeBtnActive]}
          onPress={() => { if (!endless) { setEndless(true); resetGame(); } }}
          activeOpacity={0.7}
        >
          <Ionicons name="infinite-outline" size={16} color={endless ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeText, endless && styles.modeTextActive]}>Endless</Text>
        </TouchableOpacity>
      </View>

      {/* Stats card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ACCENT }]}>{score}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Score</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: timerColor }]}>{timer}s</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time</Text>
          </View>
        </View>
        {/* Timer bar */}
        <View style={[styles.timerBarBg, { backgroundColor: colors.glass }]}>
          <View
            style={[
              styles.timerBarFill,
              {
                backgroundColor: timer <= 5 ? '#EF4444' : timer <= 10 ? '#F59E0B' : ACCENT,
                width: `${timerProgress * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Round indicator */}
      <View style={styles.roundRow}>
        <Ionicons name="shuffle-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.roundText, { color: colors.textMuted }]}>
          Word {round} of {endless ? '\u221E' : ROUND_LIMIT}
        </Text>
        {attempts < 3 && (
          <View style={styles.attemptsRow}>
            {[...Array(3)].map((_, i) => (
              <Ionicons
                key={i}
                name={i < attempts ? 'heart' : 'heart-outline'}
                size={14}
                color={i < attempts ? '#EF4444' : colors.textMuted}
              />
            ))}
          </View>
        )}
      </View>

      {/* Scrambled letters */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Animated.View
          style={[styles.lettersContainer, { transform: [{ translateX: shakeAnim }] }]}
        >
          {scrambled.split('').map((letter, index) => {
            const isRevealed = revealedPositions.includes(index);
            const showCorrect = showAnswer;

            return (
              <View
                key={index}
                style={[
                  styles.letterTile,
                  {
                    backgroundColor: isRevealed
                      ? 'rgba(16,185,129,0.15)'
                      : showCorrect
                        ? 'rgba(236,72,153,0.1)'
                        : colors.glass,
                    borderColor: isRevealed
                      ? '#10B981'
                      : showCorrect
                        ? ACCENT
                        : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.letterText,
                    {
                      color: isRevealed
                        ? '#10B981'
                        : showCorrect
                          ? ACCENT
                          : colors.text,
                    },
                  ]}
                >
                  {isRevealed ? currentWord[index] : showCorrect ? currentWord[index] : letter}
                </Text>
                {isRevealed && (
                  <Text style={styles.letterPosition}>{index + 1}</Text>
                )}
              </View>
            );
          })}
        </Animated.View>

        {/* Hint indicators */}
        {revealedPositions.length > 0 && !showAnswer && (
          <View style={styles.hintInfo}>
            <Ionicons name="bulb-outline" size={14} color="#F59E0B" />
            <Text style={[styles.hintInfoText, { color: colors.textMuted }]}>
              Green tiles show correct letter positions
            </Text>
          </View>
        )}
      </View>

      {/* Feedback message */}
      {feedback && (
        <Animated.View style={[styles.feedbackRow, { opacity: feedbackOpacity }]}>
          {feedback === 'correct' && (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.feedbackText, { color: '#10B981' }]}>
                Correct! +10 points
              </Text>
            </>
          )}
          {feedback === 'wrong' && (
            <>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={[styles.feedbackText, { color: '#EF4444' }]}>
                Wrong! {attempts > 0 ? `${attempts} attempt${attempts !== 1 ? 's' : ''} left` : 'No attempts left'}
              </Text>
            </>
          )}
          {feedback === 'timeout' && (
            <>
              <Ionicons name="timer-outline" size={20} color="#F59E0B" />
              <Text style={[styles.feedbackText, { color: '#F59E0B' }]}>
                Time's up! The word was {currentWord}
              </Text>
            </>
          )}
          {feedback === 'skip' && (
            <>
              <Ionicons name="play-skip-forward" size={20} color={colors.textMuted} />
              <Text style={[styles.feedbackText, { color: colors.textMuted }]}>
                Skipped! The word was {currentWord}
              </Text>
            </>
          )}
        </Animated.View>
      )}

      {/* Answer display when failed/skipped */}
      {showAnswer && (
        <View style={styles.answerRow}>
          <Text style={[styles.answerLabel, { color: colors.textMuted }]}>Answer:</Text>
          <Text style={[styles.answerWord, { color: ACCENT }]}>{currentWord}</Text>
        </View>
      )}

      {/* Input and buttons */}
      {!showAnswer && feedback !== 'correct' && (
        <>
          <View style={[styles.inputWrapper, {
            backgroundColor: colors.inputBg,
            borderColor: feedback === 'wrong' ? '#EF4444' : colors.border,
          }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              value={guess}
              onChangeText={setGuess}
              placeholder="Type your answer..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleCheck}
              maxLength={currentWord.length}
            />
            {guess.length > 0 && (
              <TouchableOpacity onPress={() => setGuess('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleHint}
              activeOpacity={0.7}
              disabled={hintsUsed >= 2}
            >
              <Ionicons
                name="bulb-outline"
                size={18}
                color={hintsUsed >= 2 ? colors.textMuted : '#F59E0B'}
              />
              <Text style={[styles.actionBtnText, {
                color: hintsUsed >= 2 ? colors.textMuted : colors.text,
              }]}>
                Hint ({2 - hintsUsed})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkBtn}
              onPress={handleCheck}
              activeOpacity={0.8}
              disabled={!guess.trim()}
            >
              <Ionicons name="checkmark-outline" size={20} color="#fff" />
              <Text style={styles.checkBtnText}>Check</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Ionicons name="play-skip-forward-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Attempts display */}
      <View style={styles.attemptsDisplay}>
        <Text style={[styles.attemptsLabel, { color: colors.textMuted }]}>Attempts: </Text>
        {[...Array(3)].map((_, i) => (
          <Ionicons
            key={i}
            name={i < attempts ? 'heart' : 'heart-dislike-outline'}
            size={16}
            color={i < attempts ? '#EF4444' : colors.textMuted}
            style={{ marginHorizontal: 2 }}
          />
        ))}
        <Text style={{ flex: 1 }} />
        <Text style={[styles.attemptsLabel, { color: colors.textMuted }]}>
          Hints: {2 - hintsUsed} left
        </Text>
      </View>

      {/* Reset button */}
      <TouchableOpacity
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
        onPress={resetGame}
        activeOpacity={0.7}
      >
        <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>Reset Game</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

/* ── Styles ── */
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    modeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    modeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    modeBtnActive: {
      backgroundColor: ACCENT,
      borderColor: ACCENT,
    },
    modeText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: c.textMuted,
    },
    modeTextActive: {
      color: '#fff',
    },
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontFamily: Fonts.bold,
      fontSize: 26,
    },
    statLabel: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 36,
    },
    timerBarBg: {
      height: 4,
      borderRadius: 2,
      marginTop: Spacing.md,
      overflow: 'hidden',
    },
    timerBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    roundRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    roundText: {
      fontFamily: Fonts.medium,
      fontSize: 14,
    },
    attemptsRow: {
      flexDirection: 'row',
      gap: 3,
      marginLeft: Spacing.sm,
    },
    lettersContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    letterTile: {
      width: 48,
      height: 56,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letterText: {
      fontFamily: Fonts.bold,
      fontSize: 24,
      lineHeight: 28,
    },
    letterPosition: {
      position: 'absolute',
      bottom: 2,
      right: 4,
      fontFamily: Fonts.regular,
      fontSize: 9,
      color: '#10B981',
      opacity: 0.7,
    },
    hintInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.md,
    },
    hintInfoText: {
      fontFamily: Fonts.regular,
      fontSize: 12,
    },
    feedbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    feedbackText: {
      fontFamily: Fonts.semibold,
      fontSize: 15,
    },
    answerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    answerLabel: {
      fontFamily: Fonts.regular,
      fontSize: 14,
    },
    answerWord: {
      fontFamily: Fonts.bold,
      fontSize: 20,
      letterSpacing: 2,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
    },
    input: {
      flex: 1,
      fontFamily: Fonts.semibold,
      fontSize: 18,
      letterSpacing: 2,
      paddingVertical: Spacing.xs,
    },
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    actionBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
    checkBtn: {
      flex: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      backgroundColor: ACCENT,
    },
    checkBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 15,
      color: '#fff',
    },
    attemptsDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.xs,
    },
    attemptsLabel: {
      fontFamily: Fonts.regular,
      fontSize: 12,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingVertical: Spacing.lg,
      borderRadius: Radii.md,
      marginBottom: Spacing.md,
    },
    primaryBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: '#fff',
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    secondaryBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
    summaryHeader: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    summaryTitle: {
      fontFamily: Fonts.bold,
      fontSize: 28,
      marginTop: Spacing.md,
    },
    summarySubtitle: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      marginTop: Spacing.xs,
    },
    summaryStats: {
      gap: Spacing.lg,
    },
    summaryStatRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryStatItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryStatValue: {
      fontFamily: Fonts.bold,
      fontSize: 32,
    },
    summaryStatLabel: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    summaryDivider: {
      width: 1,
      height: 40,
    },
    summaryDetailRow: {
      borderTopWidth: 1,
      paddingTop: Spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    summaryDetailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    summaryDetailText: {
      fontFamily: Fonts.medium,
      fontSize: 13,
    },
  });
