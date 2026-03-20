import { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Vibration, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F59E0B';
const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;
type DiceType = (typeof DICE_TYPES)[number];

type RollRecord = {
  id: string;
  diceType: DiceType;
  count: number;
  results: number[];
  total: number;
};

function rollDice(sides: DiceType): number {
  return Math.floor(Math.random() * sides) + 1;
}

export default function DiceCoinScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<'dice' | 'coin'>('dice');

  // ── Dice state ──
  const [diceType, setDiceType] = useState<DiceType>(6);
  const [diceCount, setDiceCount] = useState(1);
  const [diceResults, setDiceResults] = useState<number[]>([]);
  const [diceTotal, setDiceTotal] = useState(0);
  const [rollHistory, setRollHistory] = useState<RollRecord[]>([]);

  // ── Coin state ──
  const [coinFace, setCoinFace] = useState<'Heads' | 'Tails'>('Heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [totalFlips, setTotalFlips] = useState(0);
  const [headsCount, setHeadsCount] = useState(0);
  const coinScale = useRef(new Animated.Value(1)).current;

  // ── Dice handlers ──
  const handleRoll = useCallback(() => {
    Vibration.vibrate(40);
    const results: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      results.push(rollDice(diceType));
    }
    const total = results.reduce((a, b) => a + b, 0);
    setDiceResults(results);
    setDiceTotal(total);

    const record: RollRecord = {
      id: Date.now().toString(),
      diceType,
      count: diceCount,
      results,
      total,
    };
    setRollHistory((prev) => [record, ...prev].slice(0, 10));
  }, [diceType, diceCount]);

  // ── Coin handlers ──
  const handleFlip = useCallback(() => {
    if (isFlipping) return;
    Vibration.vibrate(40);
    setIsFlipping(true);

    const totalToggles = 8;
    let current = coinFace;
    let count = 0;

    const interval = setInterval(() => {
      current = current === 'Heads' ? 'Tails' : 'Heads';
      setCoinFace(current);

      // Pulse animation
      Animated.sequence([
        Animated.timing(coinScale, { toValue: 0.85, duration: 40, useNativeDriver: true }),
        Animated.timing(coinScale, { toValue: 1, duration: 40, useNativeDriver: true }),
      ]).start();

      count++;
      if (count >= totalToggles) {
        clearInterval(interval);
        // Final result
        const finalFace: 'Heads' | 'Tails' = Math.random() < 0.5 ? 'Heads' : 'Tails';
        setCoinFace(finalFace);
        setTotalFlips((p) => p + 1);
        if (finalFace === 'Heads') setHeadsCount((p) => p + 1);
        setIsFlipping(false);
      }
    }, 100);
  }, [isFlipping, coinFace, coinScale]);

  const resetCoinStats = useCallback(() => {
    setTotalFlips(0);
    setHeadsCount(0);
    setCoinFace('Heads');
  }, []);

  const tailsCount = totalFlips - headsCount;
  const headsPct = totalFlips > 0 ? ((headsCount / totalFlips) * 100).toFixed(1) : '0.0';

  // ── Render ──
  return (
    <ScreenShell title="Dice & Coin" accentColor={ACCENT} scrollable={false}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'dice' && styles.tabBtnActive]}
          onPress={() => setTab('dice')}
        >
          <Ionicons name="dice-outline" size={18} color={tab === 'dice' ? '#fff' : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'dice' && styles.tabTextActive]}>Dice Roller</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'coin' && styles.tabBtnActive]}
          onPress={() => setTab('coin')}
        >
          <Ionicons name="ellipse-outline" size={18} color={tab === 'coin' ? '#fff' : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'coin' && styles.tabTextActive]}>Coin Flipper</Text>
        </TouchableOpacity>
      </View>

      {tab === 'dice' ? (
        <View style={styles.content}>
          {/* Dice type selector */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSub }]}>Dice Type</Text>
            <View style={styles.chipRow}>
              {DICE_TYPES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    diceType === d && { backgroundColor: ACCENT, borderColor: ACCENT },
                  ]}
                  onPress={() => setDiceType(d)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textMuted },
                      diceType === d && { color: '#fff' },
                    ]}
                  >
                    D{d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSub, marginTop: Spacing.md }]}>Number of Dice</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    diceCount === n && { backgroundColor: ACCENT, borderColor: ACCENT },
                  ]}
                  onPress={() => setDiceCount(n)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.textMuted },
                      diceCount === n && { color: '#fff' },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Roll button */}
          <TouchableOpacity style={styles.rollBtn} onPress={handleRoll} activeOpacity={0.8}>
            <Ionicons name="dice" size={22} color="#fff" />
            <Text style={styles.rollBtnText}>Roll {diceCount}D{diceType}</Text>
          </TouchableOpacity>

          {/* Results */}
          {diceResults.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.diceResultRow}>
                {diceResults.map((val, i) => (
                  <View key={i} style={[styles.dieFace, { backgroundColor: ACCENT }]}>
                    <Text style={styles.dieFaceText}>{val}</Text>
                  </View>
                ))}
              </View>
              {diceResults.length > 1 && (
                <Text style={[styles.totalText, { color: colors.text }]}>
                  Total: {diceTotal}
                </Text>
              )}
            </View>
          )}

          {/* History */}
          {rollHistory.length > 0 && (
            <View style={{ flex: 1, minHeight: 80 }}>
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Roll History</Text>
              <FlatList
                data={rollHistory}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.historyDice, { color: colors.textMuted }]}>
                      {item.count}D{item.diceType}
                    </Text>
                    <Text style={[styles.historyResults, { color: colors.textSub }]}>
                      [{item.results.join(', ')}]
                    </Text>
                    <Text style={[styles.historyTotal, { color: ACCENT }]}>
                      = {item.total}
                    </Text>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          {/* Coin display */}
          <View style={styles.coinArea}>
            <Animated.View
              style={[
                styles.coin,
                {
                  backgroundColor: coinFace === 'Heads' ? ACCENT : colors.card,
                  borderColor: ACCENT,
                  transform: [{ scale: coinScale }],
                },
              ]}
            >
              <Text
                style={[
                  styles.coinText,
                  { color: coinFace === 'Heads' ? '#fff' : colors.text },
                ]}
              >
                {coinFace === 'Heads' ? 'H' : 'T'}
              </Text>
              <Text
                style={[
                  styles.coinLabel,
                  { color: coinFace === 'Heads' ? 'rgba(255,255,255,0.8)' : colors.textMuted },
                ]}
              >
                {coinFace}
              </Text>
            </Animated.View>
          </View>

          {/* Flip button */}
          <TouchableOpacity
            style={[styles.rollBtn, isFlipping && { opacity: 0.6 }]}
            onPress={handleFlip}
            activeOpacity={0.8}
            disabled={isFlipping}
          >
            <Ionicons name="refresh" size={22} color="#fff" />
            <Text style={styles.rollBtnText}>{isFlipping ? 'Flipping...' : 'Flip Coin'}</Text>
          </TouchableOpacity>

          {/* Stats */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSub, marginBottom: Spacing.sm }]}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{totalFlips}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Flips</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{headsCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Heads</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textSub }]}>{tailsCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tails</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{headsPct}%</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Heads %</Text>
              </View>
            </View>
          </View>

          {/* Reset */}
          {totalFlips > 0 && (
            <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.border }]} onPress={resetCoinStats}>
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>Reset Stats</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

/* ── Styles ── */
function createStyles(colors: Record<string, string>) {
  return StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabBtnActive: {
      backgroundColor: ACCENT,
      borderColor: ACCENT,
    },
    tabText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: colors.textMuted,
    },
    tabTextActive: {
      color: '#fff',
    },
    content: {
      flex: 1,
      gap: Spacing.lg,
    },
    card: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    label: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      marginBottom: Spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.sm,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
    rollBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingVertical: Spacing.lg,
      borderRadius: Radii.md,
    },
    rollBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: '#fff',
    },
    diceResultRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    dieFace: {
      width: 56,
      height: 56,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dieFaceText: {
      fontFamily: Fonts.bold,
      fontSize: 24,
      color: '#fff',
    },
    totalText: {
      fontFamily: Fonts.bold,
      fontSize: 20,
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    sectionTitle: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      marginBottom: Spacing.sm,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    historyDice: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      width: 48,
    },
    historyResults: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      flex: 1,
    },
    historyTotal: {
      fontFamily: Fonts.bold,
      fontSize: 14,
    },
    coinArea: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    coin: {
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coinText: {
      fontFamily: Fonts.bold,
      fontSize: 56,
    },
    coinLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      marginTop: Spacing.xs,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    statItem: {
      width: '50%',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    statValue: {
      fontFamily: Fonts.bold,
      fontSize: 22,
    },
    statLabel: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      marginTop: 2,
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
}
