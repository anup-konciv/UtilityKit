import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F59E0B';
const GRID_SIZE = 4;

// ── Tile color palette ──────────────────────────────────────────────────────
const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  2:    { bg: '#EDE0C8', text: '#776E65' },
  4:    { bg: '#E8D5B5', text: '#776E65' },
  8:    { bg: '#F2B179', text: '#FFFFFF' },
  16:   { bg: '#F59563', text: '#FFFFFF' },
  32:   { bg: '#F67C5F', text: '#FFFFFF' },
  64:   { bg: '#F65E3B', text: '#FFFFFF' },
  128:  { bg: '#EDCF72', text: '#FFFFFF' },
  256:  { bg: '#EDCC61', text: '#FFFFFF' },
  512:  { bg: '#EDC850', text: '#FFFFFF' },
  1024: { bg: '#EDC53F', text: '#FFFFFF' },
  2048: { bg: '#EDC22E', text: '#FFFFFF' },
};

const DEFAULT_TILE = { bg: '#3C3A32', text: '#FFFFFF' };

type Board = number[][];

// ── Board helpers ───────────────────────────────────────────────────────────

function createEmptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function getEmptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function addRandomTile(board: Board): Board {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newBoard = cloneBoard(board);
  newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newBoard;
}

function initBoard(): Board {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);
  return board;
}

// ── Slide logic (operates on a single row left-to-right) ────────────────────

function slideRow(row: number[]): { result: number[]; scored: number } {
  // Remove zeroes
  let filtered = row.filter((v) => v !== 0);
  let scored = 0;
  // Merge adjacent equal tiles
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      scored += filtered[i];
      filtered[i + 1] = 0;
      i++; // skip merged tile
    }
  }
  // Remove zeroes created by merging
  filtered = filtered.filter((v) => v !== 0);
  // Pad with zeroes on the right
  while (filtered.length < GRID_SIZE) filtered.push(0);
  return { result: filtered, scored };
}

function rotateBoard90CW(board: Board): Board {
  const n = GRID_SIZE;
  const rotated = createEmptyBoard();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = board[r][c];
    }
  }
  return rotated;
}

function rotateBoard90CCW(board: Board): Board {
  const n = GRID_SIZE;
  const rotated = createEmptyBoard();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[n - 1 - c][r] = board[r][c];
    }
  }
  return rotated;
}

function rotateBoard180(board: Board): Board {
  const n = GRID_SIZE;
  const rotated = createEmptyBoard();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[n - 1 - r][n - 1 - c] = board[r][c];
    }
  }
  return rotated;
}

type Direction = 'left' | 'right' | 'up' | 'down';

function move(board: Board, direction: Direction): { board: Board; scored: number; moved: boolean } {
  // Normalize: rotate so the move direction becomes "left", slide, then rotate back
  let oriented: Board;
  switch (direction) {
    case 'left':
      oriented = cloneBoard(board);
      break;
    case 'right':
      oriented = rotateBoard180(board);
      break;
    case 'up':
      oriented = rotateBoard90CW(board);
      break;
    case 'down':
      oriented = rotateBoard90CCW(board);
      break;
  }

  let totalScored = 0;
  const slid = createEmptyBoard();
  for (let r = 0; r < GRID_SIZE; r++) {
    const { result, scored } = slideRow(oriented[r]);
    slid[r] = result;
    totalScored += scored;
  }

  // Rotate back
  let final: Board;
  switch (direction) {
    case 'left':
      final = slid;
      break;
    case 'right':
      final = rotateBoard180(slid);
      break;
    case 'up':
      final = rotateBoard90CCW(slid);
      break;
    case 'down':
      final = rotateBoard90CW(slid);
      break;
  }

  // Detect if anything actually moved
  let moved = false;
  for (let r = 0; r < GRID_SIZE && !moved; r++) {
    for (let c = 0; c < GRID_SIZE && !moved; c++) {
      if (board[r][c] !== final[r][c]) moved = true;
    }
  }

  return { board: final, scored: totalScored, moved };
}

function canMove(board: Board): boolean {
  // Has empty cell?
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return true;
    }
  }
  // Has adjacent equal?
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = board[r][c];
      if (c < GRID_SIZE - 1 && board[r][c + 1] === v) return true;
      if (r < GRID_SIZE - 1 && board[r + 1][c] === v) return true;
    }
  }
  return false;
}

function hasWon(board: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] >= 2048) return true;
    }
  }
  return false;
}

function getTileStyle(value: number) {
  return TILE_COLORS[value] ?? DEFAULT_TILE;
}

function getFontSize(value: number, tileSize: number): number {
  if (value >= 1024) return tileSize * 0.22;
  if (value >= 128) return tileSize * 0.28;
  if (value >= 16) return tileSize * 0.32;
  return tileSize * 0.38;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Game2048Screen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  // Grid sizing: leave padding on both sides, capped for tablets
  const gridPadding = Spacing.lg * 2 + Spacing.sm * 2; // outer padding + board padding
  const maxGridWidth = Math.min(screenWidth - gridPadding, 400);
  const cellGap = Spacing.sm;
  const tileSize = (maxGridWidth - cellGap * (GRID_SIZE + 1)) / GRID_SIZE;

  const [board, setBoard] = useState<Board>(() => initBoard());
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [prevBoard, setPrevBoard] = useState<Board | null>(null);
  const [prevScore, setPrevScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [wonDismissed, setWonDismissed] = useState(false);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (gameOver) return;

      const { board: newBoard, scored, moved } = move(board, direction);
      if (!moved) return;

      // Save undo state
      setPrevBoard(cloneBoard(board));
      setPrevScore(score);

      const newScore = score + scored;
      const boardWithTile = addRandomTile(newBoard);

      setBoard(boardWithTile);
      setScore(newScore);
      if (newScore > bestScore) setBestScore(newScore);

      // Win check
      if (!won && hasWon(boardWithTile)) {
        setWon(true);
      }

      // Game over check
      if (!canMove(boardWithTile)) {
        setGameOver(true);
      }
    },
    [board, score, bestScore, gameOver, won],
  );

  const handleUndo = useCallback(() => {
    if (!prevBoard) return;
    setBoard(prevBoard);
    setScore(prevScore);
    setPrevBoard(null);
    setGameOver(false);
  }, [prevBoard, prevScore]);

  const handleNewGame = useCallback(() => {
    setBoard(initBoard());
    setScore(0);
    setPrevBoard(null);
    setPrevScore(0);
    setGameOver(false);
    setWon(false);
    setWonDismissed(false);
  }, []);

  const showWinBanner = won && !wonDismissed;

  return (
    <ScreenShell title="2048" accentColor={ACCENT} scrollable={false}>
      <View style={styles.container}>
        {/* ── Score bar ── */}
        <View style={styles.scoreBar}>
          <View style={[styles.scoreBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>SCORE</Text>
            <Text style={[styles.scoreValue, { color: colors.text }]}>{score}</Text>
          </View>
          <View style={[styles.scoreBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>BEST</Text>
            <Text style={[styles.scoreValue, { color: ACCENT }]}>{bestScore}</Text>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: ACCENT }]}
            onPress={handleNewGame}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>New Game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: prevBoard ? colors.card : colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={handleUndo}
            activeOpacity={0.7}
            disabled={!prevBoard}
          >
            <Ionicons
              name="arrow-undo"
              size={16}
              color={prevBoard ? colors.text : colors.textMuted}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: prevBoard ? colors.text : colors.textMuted },
              ]}
            >
              Undo
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Board ── */}
        <View style={styles.boardWrapper}>
          <View
            style={[
              styles.board,
              {
                width: maxGridWidth,
                height: maxGridWidth,
                padding: cellGap,
                backgroundColor: '#BBADA0',
              },
            ]}
          >
            {board.map((row, r) =>
              row.map((value, c) => {
                const tileBg = value === 0 ? 'rgba(238,228,218,0.35)' : getTileStyle(value).bg;
                const tileTextColor = value === 0 ? 'transparent' : getTileStyle(value).text;
                return (
                  <View
                    key={`${r}-${c}`}
                    style={[
                      styles.tile,
                      {
                        width: tileSize,
                        height: tileSize,
                        top: cellGap + r * (tileSize + cellGap),
                        left: cellGap + c * (tileSize + cellGap),
                        backgroundColor: tileBg,
                      },
                    ]}
                  >
                    {value > 0 && (
                      <Text
                        style={[
                          styles.tileText,
                          {
                            color: tileTextColor,
                            fontSize: getFontSize(value, tileSize),
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {value}
                      </Text>
                    )}
                  </View>
                );
              }),
            )}

            {/* ── Overlays ── */}
            {gameOver && (
              <View style={styles.overlay}>
                <Text style={styles.overlayTitle}>Game Over!</Text>
                <Text style={styles.overlaySubtitle}>Final Score: {score}</Text>
                <TouchableOpacity
                  style={styles.overlayBtn}
                  onPress={handleNewGame}
                  activeOpacity={0.8}
                >
                  <Text style={styles.overlayBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {showWinBanner && (
              <View style={[styles.overlay, { backgroundColor: 'rgba(237,194,46,0.85)' }]}>
                <Text style={styles.overlayTitle}>You Win!</Text>
                <Text style={styles.overlaySubtitle}>Score: {score}</Text>
                <View style={styles.overlayBtnRow}>
                  <TouchableOpacity
                    style={styles.overlayBtn}
                    onPress={() => setWonDismissed(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.overlayBtnText}>Keep Playing</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.overlayBtn, { backgroundColor: '#776E65' }]}
                    onPress={handleNewGame}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.overlayBtnText}>New Game</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Direction controls ── */}
        <View style={styles.controls}>
          {/* Top row: Up */}
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.arrowBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleMove('up')}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-up" size={28} color={ACCENT} />
            </TouchableOpacity>
          </View>
          {/* Middle row: Left, Down, Right */}
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.arrowBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleMove('left')}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={28} color={ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.arrowBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleMove('down')}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-down" size={28} color={ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.arrowBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleMove('right')}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-forward" size={28} color={ACCENT} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

/* ── Styles ── */
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: Spacing.lg,
    },
    // ── Score bar ──
    scoreBar: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    scoreBox: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    scoreLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      letterSpacing: 1,
    },
    scoreValue: {
      fontFamily: Fonts.bold,
      fontSize: 22,
      marginTop: 2,
    },
    // ── Action row ──
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    actionBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: '#fff',
    },
    // ── Board ──
    boardWrapper: {
      alignItems: 'center',
    },
    board: {
      borderRadius: Radii.lg,
      position: 'relative',
    },
    tile: {
      position: 'absolute',
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileText: {
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    // ── Overlays ──
    overlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: Radii.lg,
      backgroundColor: 'rgba(238,228,218,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      zIndex: 10,
    },
    overlayTitle: {
      fontFamily: Fonts.bold,
      fontSize: 32,
      color: '#776E65',
    },
    overlaySubtitle: {
      fontFamily: Fonts.semibold,
      fontSize: 16,
      color: '#776E65',
    },
    overlayBtnRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    overlayBtn: {
      backgroundColor: ACCENT,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    overlayBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: '#fff',
    },
    // ── Controls ──
    controls: {
      alignItems: 'center',
      gap: Spacing.sm,
    },
    controlRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    arrowBtn: {
      width: 56,
      height: 56,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
