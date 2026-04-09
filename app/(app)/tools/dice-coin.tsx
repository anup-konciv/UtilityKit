import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

const ACCENT = '#F59E0B';
const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;
type DiceType = (typeof DICE_TYPES)[number];

// ── D6 dot patterns ──────────────────────────────────────────────────────────
// Each face value maps to an array of (row, col) positions in a 3x3 grid.
// 0 = top/left, 1 = center, 2 = bottom/right.
const D6_PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

/** Renders a realistic D6 face with dot pips instead of a plain number. */
function D6Face({ value, size = 56 }: { value: number; size?: number }) {
  const pips = D6_PIPS[value] ?? D6_PIPS[1];
  const pipSize = size * 0.18;
  const gap = (size - pipSize * 3) / 4; // spacing between pip positions

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size * 0.18,
      backgroundColor: '#fff',
      borderWidth: 2,
      borderColor: '#E5E7EB',
      padding: gap,
      // Shadow for depth
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    }}>
      {pips.map(([row, col], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: pipSize,
            height: pipSize,
            borderRadius: pipSize / 2,
            backgroundColor: '#1F2937',
            top: gap + row * (pipSize + gap),
            left: gap + col * (pipSize + gap),
          }}
        />
      ))}
    </View>
  );
}

/** Renders a non-D6 die with its shape indicator + number. */
function DnFace({ value, sides, size = 56 }: { value: number; sides: DiceType; size?: number }) {
  // Each die type gets a distinctive shape and color
  const meta: Record<number, { bg: string; shape: string }> = {
    4:  { bg: '#10B981', shape: '▲' },
    8:  { bg: '#6366F1', shape: '◆' },
    10: { bg: '#EC4899', shape: '⬠' },
    12: { bg: '#3B82F6', shape: '⬡' },
    20: { bg: '#EF4444', shape: '⬣' },
  };
  const m = meta[sides] ?? { bg: ACCENT, shape: '●' };

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: sides === 4 ? 4 : size * 0.18,
      backgroundColor: m.bg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    }}>
      <Text style={{
        position: 'absolute',
        top: 2,
        right: 5,
        fontSize: 9,
        fontFamily: Fonts.medium,
        color: 'rgba(255,255,255,0.6)',
      }}>
        D{sides}
      </Text>
      <Text style={{
        fontSize: size * 0.42,
        fontFamily: Fonts.bold,
        color: '#fff',
        lineHeight: size * 0.5,
      }}>
        {value}
      </Text>
    </View>
  );
}

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
  const [isRolling, setIsRolling] = useState(false);

  // Dice animation refs
  const diceShake = useRef(new Animated.Value(0)).current;
  const diceScale = useRef(new Animated.Value(1)).current;
  const diceBounce = useRef(new Animated.Value(0)).current;

  // ── Coin state ──
  const [coinFace, setCoinFace] = useState<'Heads' | 'Tails'>('Heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [totalFlips, setTotalFlips] = useState(0);
  const [headsCount, setHeadsCount] = useState(0);

  // Coin animation refs — scaleX simulates a Y-axis rotation, translateY
  // simulates the vertical toss arc.
  const coinFlipAnim = useRef(new Animated.Value(0)).current;
  const coinToss = useRef(new Animated.Value(0)).current;

  // Derived animated coin transforms
  const coinScaleX = coinFlipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 1],
  });
  const coinTranslateY = coinToss.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -80, 0],
  });

  // ── Dice handlers ──
  const handleRoll = useCallback(() => {
    if (isRolling) return;
    haptics.medium();
    setIsRolling(true);

    // 1) Shake + shrink animation (300ms)
    diceShake.setValue(0);
    diceScale.setValue(1);
    diceBounce.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(diceScale, { toValue: 0.8, duration: 100, useNativeDriver: true }),
        Animated.timing(diceScale, { toValue: 1.05, duration: 100, useNativeDriver: true }),
        Animated.timing(diceScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
      Animated.timing(diceShake, {
        toValue: 4,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();

    // 2) Rapid number cycling (shows random faces during shake)
    const cycleCount = 6;
    let cycle = 0;
    const cycleInterval = setInterval(() => {
      const tempResults: number[] = [];
      for (let i = 0; i < diceCount; i++) tempResults.push(rollDice(diceType));
      setDiceResults(tempResults);
      cycle++;
      if (cycle >= cycleCount) {
        clearInterval(cycleInterval);
        // 3) Settle on final result + bounce landing
        const finalResults: number[] = [];
        for (let i = 0; i < diceCount; i++) finalResults.push(rollDice(diceType));
        const total = finalResults.reduce((a, b) => a + b, 0);
        setDiceResults(finalResults);
        setDiceTotal(total);
        haptics.success();

        // Landing bounce
        Animated.sequence([
          Animated.timing(diceBounce, { toValue: -12, duration: 80, useNativeDriver: true }),
          Animated.spring(diceBounce, { toValue: 0, friction: 4, useNativeDriver: true }),
        ]).start(() => setIsRolling(false));

        setRollHistory((prev) => [{
          id: Date.now().toString(),
          diceType,
          count: diceCount,
          results: finalResults,
          total,
        }, ...prev].slice(0, 10));
      }
    }, 50);
  }, [diceType, diceCount, isRolling, diceShake, diceScale, diceBounce]);

  // Interpolate shake to a horizontal wiggle
  const diceTranslateX = diceShake.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, -6, 6, -4, 0],
  });

  // ── Coin handlers ──
  const handleFlip = useCallback(() => {
    if (isFlipping) return;
    haptics.medium();
    setIsFlipping(true);

    // Determine result up front
    const finalFace: 'Heads' | 'Tails' = Math.random() < 0.5 ? 'Heads' : 'Tails';

    // Reset animations
    coinFlipAnim.setValue(0);
    coinToss.setValue(0);

    // Run 3 full "rotations" (each is 0→1) sequentially while the coin
    // arcs up and down. The face text swaps at the midpoint of each rotation
    // (when scaleX hits 0 and the coin is edge-on, so the swap is invisible).
    const flipCount = 5;
    let flipped = 0;

    const runOneFlip = () => {
      coinFlipAnim.setValue(0);
      Animated.timing(coinFlipAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        flipped++;
        // Swap face at each midpoint (invisible since scaleX = 0 at .5)
        setCoinFace(f => f === 'Heads' ? 'Tails' : 'Heads');
        if (flipped < flipCount) {
          runOneFlip();
        } else {
          // Land on the predetermined result
          setCoinFace(finalFace);
          setTotalFlips(p => p + 1);
          if (finalFace === 'Heads') setHeadsCount(p => p + 1);
          setIsFlipping(false);
        }
      });
    };

    // Toss arc (up then down) runs in parallel with the flips
    Animated.timing(coinToss, {
      toValue: 1,
      duration: 160 * flipCount,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    runOneFlip();
  }, [isFlipping, coinFlipAnim, coinToss]);

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
          <TouchableOpacity
            style={[styles.rollBtn, isRolling && { opacity: 0.7 }]}
            onPress={handleRoll}
            activeOpacity={0.8}
            disabled={isRolling}
          >
            <Text style={{ fontSize: 22 }}>🎲</Text>
            <Text style={styles.rollBtnText}>
              {isRolling ? 'Rolling...' : `Roll ${diceCount}D${diceType}`}
            </Text>
          </TouchableOpacity>

          {/* Results — animated with shake + bounce */}
          {diceResults.length > 0 && (
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                {
                  transform: [
                    { translateX: diceTranslateX },
                    { translateY: diceBounce },
                    { scale: diceScale },
                  ],
                },
              ]}
            >
              <View style={styles.diceResultRow}>
                {diceResults.map((val, i) =>
                  diceType === 6 ? (
                    <D6Face key={i} value={val} size={diceCount <= 3 ? 64 : 52} />
                  ) : (
                    <DnFace key={i} value={val} sides={diceType} size={diceCount <= 3 ? 64 : 52} />
                  )
                )}
              </View>
              {diceResults.length > 1 && !isRolling && (
                <Text style={[styles.totalText, { color: colors.text }]}>
                  Total: {diceTotal}
                </Text>
              )}
            </Animated.View>
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
          {/* Coin display — scaleX simulates a Y-axis rotation while
              translateY arcs the coin up and down like a real toss. */}
          <View style={styles.coinArea}>
            <Animated.View
              style={[
                styles.coin,
                {
                  backgroundColor: coinFace === 'Heads' ? '#F59E0B' : '#94A3B8',
                  borderColor: coinFace === 'Heads' ? '#D97706' : '#64748B',
                  transform: [
                    { translateY: coinTranslateY },
                    { scaleX: coinScaleX },
                  ],
                  // Outer glow
                  shadowColor: coinFace === 'Heads' ? '#F59E0B' : '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8,
                },
              ]}
            >
              {/* Inner ring for depth feel */}
              <View style={[
                styles.coinInner,
                { borderColor: coinFace === 'Heads' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)' },
              ]}>
                <Text style={styles.coinEmoji}>
                  {coinFace === 'Heads' ? '👑' : '🦅'}
                </Text>
                <Text
                  style={[
                    styles.coinText,
                    { color: '#fff' },
                  ]}
                >
                  {coinFace}
                </Text>
              </View>
            </Animated.View>
            {/* Landing shadow that grows when the coin is in the air */}
            <Animated.View
              style={[
                styles.coinShadow,
                {
                  opacity: coinToss.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.15, 0.05, 0.15],
                  }),
                  transform: [{
                    scaleX: coinToss.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.6, 1],
                    }),
                  }],
                },
              ]}
            />
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
      width: 150,
      height: 150,
      borderRadius: 75,
      borderWidth: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coinInner: {
      width: 130,
      height: 130,
      borderRadius: 65,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coinEmoji: {
      fontSize: 40,
      marginBottom: 2,
    },
    coinText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    coinShadow: {
      width: 120,
      height: 16,
      borderRadius: 60,
      backgroundColor: '#000',
      marginTop: 12,
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
