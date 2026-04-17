import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT = '#10B981';
const SNAKE_HEAD = '#059669';
const SNAKE_BODY = '#34D399';
const FOOD_COLOR = '#EF4444';
const INITIAL_SPEED = 250;
const SPEED_DECREMENT = 15;
const MIN_SPEED = 100;
const SPEED_UP_EVERY = 5;

type Position = [number, number]; // [row, col]
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// ─── Helpers ────────────────────────────────────────────────────────────────

function posEqual(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function getRandomFood(gridSize: number, snake: Position[]): Position {
  const empty: Position[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!snake.some((s) => s[0] === r && s[1] === c)) {
        empty.push([r, c]);
      }
    }
  }
  if (empty.length === 0) return [0, 0];
  return empty[Math.floor(Math.random() * empty.length)];
}

function getOpposite(dir: Direction): Direction {
  switch (dir) {
    case 'UP': return 'DOWN';
    case 'DOWN': return 'UP';
    case 'LEFT': return 'RIGHT';
    case 'RIGHT': return 'LEFT';
  }
}

function getInitialSnake(gridSize: number): Position[] {
  const mid = Math.floor(gridSize / 2);
  return [
    [mid, mid],
    [mid, mid - 1],
    [mid, mid - 2],
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SnakeGameScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  // Compute grid size based on screen width
  const GRID_SIZE = 14;
  const boardPadding = Spacing.lg * 2; // horizontal padding from ScreenShell
  const availableWidth = screenWidth - boardPadding;
  const cellSize = Math.floor(availableWidth / GRID_SIZE);
  const boardSize = cellSize * GRID_SIZE;

  // ── Game state ──
  const [gameState, setGameState] = useState<GameState>('idle');
  const [snake, setSnake] = useState<Position[]>(() => getInitialSnake(GRID_SIZE));
  const [food, setFood] = useState<Position>(() => {
    const initial = getInitialSnake(GRID_SIZE);
    return getRandomFood(GRID_SIZE, initial);
  });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // ── Refs for game loop ──
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Position>(food);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>(gameState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Compute speed from score
  const getSpeed = useCallback((currentScore: number) => {
    const level = Math.floor(currentScore / SPEED_UP_EVERY);
    return Math.max(MIN_SPEED, INITIAL_SPEED - level * SPEED_DECREMENT);
  }, []);

  // ── Clear interval helper ──
  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Game tick ──
  const tick = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    // Apply queued direction
    directionRef.current = nextDirectionRef.current;

    const currentSnake = snakeRef.current;
    const head = currentSnake[0];
    let newRow = head[0];
    let newCol = head[1];

    switch (directionRef.current) {
      case 'UP': newRow -= 1; break;
      case 'DOWN': newRow += 1; break;
      case 'LEFT': newCol -= 1; break;
      case 'RIGHT': newCol += 1; break;
    }

    // Check wall collision
    if (newRow < 0 || newRow >= GRID_SIZE || newCol < 0 || newCol >= GRID_SIZE) {
      clearTick();
      setGameState('gameover');
      return;
    }

    const newHead: Position = [newRow, newCol];

    // Check self collision (skip tail if not eating, it will move away)
    const willEat = posEqual(newHead, foodRef.current);
    const checkSnake = willEat ? currentSnake : currentSnake.slice(0, -1);
    if (checkSnake.some((s) => posEqual(s, newHead))) {
      clearTick();
      setGameState('gameover');
      return;
    }

    // Build new snake
    const newSnake: Position[] = [newHead, ...currentSnake];
    if (!willEat) {
      newSnake.pop();
    }

    setSnake(newSnake);

    if (willEat) {
      const newScore = scoreRef.current + 1;
      setScore(newScore);
      setHighScore((prev) => Math.max(prev, newScore));

      const newFood = getRandomFood(GRID_SIZE, newSnake);
      setFood(newFood);

      // Check if speed should change
      const oldLevel = Math.floor(scoreRef.current / SPEED_UP_EVERY);
      const newLevel = Math.floor(newScore / SPEED_UP_EVERY);
      if (newLevel > oldLevel) {
        // Restart interval with new speed
        clearTick();
        const newSpeed = getSpeed(newScore);
        intervalRef.current = setInterval(tick, newSpeed);
      }
    }
  }, [GRID_SIZE, clearTick, getSpeed]);

  // ── Start game loop ──
  const startLoop = useCallback(() => {
    clearTick();
    const speed = getSpeed(scoreRef.current);
    intervalRef.current = setInterval(tick, speed);
  }, [clearTick, getSpeed, tick]);

  // ── Game controls ──
  const startNewGame = useCallback(() => {
    const initialSnake = getInitialSnake(GRID_SIZE);
    setSnake(initialSnake);
    setFood(getRandomFood(GRID_SIZE, initialSnake));
    setScore(0);
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    scoreRef.current = 0;
    snakeRef.current = initialSnake;
    setGameState('playing');
  }, [GRID_SIZE]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      clearTick();
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState, clearTick]);

  // Start/stop loop based on game state
  useEffect(() => {
    if (gameState === 'playing') {
      startLoop();
    } else {
      clearTick();
    }
    return clearTick;
  }, [gameState, startLoop, clearTick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTick();
  }, [clearTick]);

  // ── Direction handler ──
  const changeDirection = useCallback((newDir: Direction) => {
    if (gameState !== 'playing') return;
    // Prevent reversing
    if (newDir === getOpposite(directionRef.current)) return;
    nextDirectionRef.current = newDir;
  }, [gameState]);

  // ── Render ──
  return (
    <ScreenShell title="Snake" accentColor={ACCENT} scrollable={false}>
      <View style={styles.container}>
        {/* Score bar */}
        <View style={styles.scoreBar}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Score</Text>
            <Text style={[styles.scoreValue, { color: colors.text }]}>{score}</Text>
          </View>

          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>
              Level {Math.floor(score / SPEED_UP_EVERY) + 1}
            </Text>
            <View style={styles.speedDots}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.speedDot,
                    {
                      backgroundColor:
                        i <= Math.floor(score / SPEED_UP_EVERY)
                          ? ACCENT
                          : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={[styles.scoreItem, { alignItems: 'flex-end' }]}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Best</Text>
            <Text style={[styles.scoreValue, { color: ACCENT }]}>{highScore}</Text>
          </View>
        </View>

        {/* Game board */}
        <View
          style={[
            styles.board,
            {
              width: boardSize,
              height: boardSize,
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Grid lines */}
          {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
            <View key={`h-${i}`}>
              <View
                style={[
                  styles.gridLineH,
                  {
                    top: i * cellSize,
                    width: boardSize,
                    backgroundColor: colors.border,
                  },
                ]}
              />
              <View
                style={[
                  styles.gridLineV,
                  {
                    left: i * cellSize,
                    height: boardSize,
                    backgroundColor: colors.border,
                  },
                ]}
              />
            </View>
          ))}

          {/* Snake cells */}
          {snake.map((pos, index) => (
            <View
              key={`s-${index}`}
              style={[
                styles.cell,
                {
                  top: pos[0] * cellSize + 1,
                  left: pos[1] * cellSize + 1,
                  width: cellSize - 2,
                  height: cellSize - 2,
                  backgroundColor: index === 0 ? SNAKE_HEAD : SNAKE_BODY,
                  borderRadius: index === 0 ? cellSize * 0.35 : cellSize * 0.2,
                },
              ]}
            >
              {index === 0 && (
                <View style={styles.eyeContainer}>
                  <View style={[styles.eye, { width: cellSize * 0.18, height: cellSize * 0.18 }]} />
                  <View style={[styles.eye, { width: cellSize * 0.18, height: cellSize * 0.18 }]} />
                </View>
              )}
            </View>
          ))}

          {/* Food */}
          <View
            style={[
              styles.cell,
              {
                top: food[0] * cellSize + 1,
                left: food[1] * cellSize + 1,
                width: cellSize - 2,
                height: cellSize - 2,
                backgroundColor: 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <View
              style={[
                styles.foodDot,
                {
                  width: cellSize * 0.65,
                  height: cellSize * 0.65,
                  borderRadius: cellSize * 0.325,
                  backgroundColor: FOOD_COLOR,
                },
              ]}
            />
          </View>

          {/* Overlay for idle / gameover / paused */}
          {gameState !== 'playing' && (
            <View style={[styles.overlay, { width: boardSize, height: boardSize }]}>
              <View style={[styles.overlayInner, { backgroundColor: colors.card }]}>
                {gameState === 'idle' && (
                  <>
                    <Ionicons name="game-controller" size={36} color={ACCENT} />
                    <Text style={[styles.overlayTitle, { color: colors.text }]}>Snake</Text>
                    <Text style={[styles.overlaySubtext, { color: colors.textMuted }]}>
                      Tap Play to begin
                    </Text>
                    <TouchableOpacity
                      style={styles.overlayBtn}
                      onPress={startNewGame}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play" size={20} color="#fff" />
                      <Text style={styles.overlayBtnText}>Play</Text>
                    </TouchableOpacity>
                  </>
                )}

                {gameState === 'paused' && (
                  <>
                    <Ionicons name="pause-circle" size={36} color={ACCENT} />
                    <Text style={[styles.overlayTitle, { color: colors.text }]}>Paused</Text>
                    <TouchableOpacity
                      style={styles.overlayBtn}
                      onPress={togglePause}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play" size={20} color="#fff" />
                      <Text style={styles.overlayBtnText}>Resume</Text>
                    </TouchableOpacity>
                  </>
                )}

                {gameState === 'gameover' && (
                  <>
                    <Ionicons name="skull" size={36} color={FOOD_COLOR} />
                    <Text style={[styles.overlayTitle, { color: colors.text }]}>Game Over</Text>
                    <Text style={[styles.overlayScore, { color: ACCENT }]}>
                      Score: {score}
                    </Text>
                    {score >= highScore && score > 0 && (
                      <Text style={[styles.overlayNewBest, { color: FOOD_COLOR }]}>
                        New Best!
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.overlayBtn}
                      onPress={startNewGame}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh" size={20} color="#fff" />
                      <Text style={styles.overlayBtnText}>Play Again</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Control area */}
        <View style={styles.controlArea}>
          {/* Pause / New Game buttons */}
          <View style={styles.actionRow}>
            {(gameState === 'playing' || gameState === 'paused') && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={togglePause}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={gameState === 'playing' ? 'pause' : 'play'}
                  size={18}
                  color={colors.text}
                />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>
                  {gameState === 'playing' ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>
            )}

            {(gameState === 'playing' || gameState === 'paused') && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={startNewGame}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color={colors.textMuted} />
                <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Restart</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* DPAD */}
          <View style={styles.dpad}>
            {/* Up button */}
            <View style={styles.dpadRow}>
              <TouchableOpacity
                style={[styles.dpadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => changeDirection('UP')}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-up" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Left, Center, Right row */}
            <View style={styles.dpadRow}>
              <TouchableOpacity
                style={[styles.dpadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => changeDirection('LEFT')}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>

              <View style={[styles.dpadCenter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="game-controller-outline" size={18} color={colors.textMuted} />
              </View>

              <TouchableOpacity
                style={[styles.dpadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => changeDirection('RIGHT')}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-forward" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Down button */}
            <View style={styles.dpadRow}>
              <TouchableOpacity
                style={[styles.dpadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => changeDirection('DOWN')}
                activeOpacity={0.6}
              >
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const DPAD_BTN_SIZE = 56;

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    // ── Score bar ──
    scoreBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: Spacing.md,
    },
    scoreItem: {
      alignItems: 'center',
    },
    scoreLabel: {
      fontFamily: Fonts.medium,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 2,
    },
    scoreValue: {
      fontFamily: Fonts.bold,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
    },
    speedDots: {
      flexDirection: 'row',
      gap: 3,
      marginTop: 2,
    },
    speedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },

    // ── Board ──
    board: {
      borderWidth: 2,
      borderRadius: Radii.sm,
      overflow: 'hidden',
      position: 'relative',
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      height: StyleSheet.hairlineWidth,
      opacity: 0.5,
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      width: StyleSheet.hairlineWidth,
      opacity: 0.5,
    },
    cell: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyeContainer: {
      flexDirection: 'row',
      gap: 3,
    },
    eye: {
      backgroundColor: '#fff',
      borderRadius: 99,
    },
    foodDot: {
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
      elevation: 4,
    },

    // ── Overlay ──
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      zIndex: 10,
    },
    overlayInner: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      paddingVertical: Spacing.xl,
      borderRadius: Radii.lg,
      gap: Spacing.sm,
    },
    overlayTitle: {
      fontFamily: Fonts.bold,
      fontSize: 24,
    },
    overlaySubtext: {
      fontFamily: Fonts.regular,
      fontSize: 14,
    },
    overlayScore: {
      fontFamily: Fonts.bold,
      fontSize: 20,
    },
    overlayNewBest: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
    overlayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radii.pill,
      marginTop: Spacing.sm,
    },
    overlayBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: '#fff',
    },

    // ── Controls ──
    controlArea: {
      width: '100%',
      alignItems: 'center',
      gap: Spacing.md,
      paddingTop: Spacing.md,
    },
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    actionBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },

    // ── DPAD ──
    dpad: {
      alignItems: 'center',
      gap: Spacing.xs,
    },
    dpadRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      justifyContent: 'center',
    },
    dpadBtn: {
      width: DPAD_BTN_SIZE,
      height: DPAD_BTN_SIZE,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    dpadCenter: {
      width: DPAD_BTN_SIZE,
      height: DPAD_BTN_SIZE,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
