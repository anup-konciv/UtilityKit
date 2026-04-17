import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#64748B';

// ── Types & Constants ──────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  rows: number;
  cols: number;
  mines: number;
  label: string;
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { rows: 8, cols: 8, mines: 10, label: 'Easy' },
  medium: { rows: 10, cols: 10, mines: 20, label: 'Medium' },
  hard: { rows: 12, cols: 12, mines: 35, label: 'Hard' },
};

type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

interface CellData {
  hasMine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
}

const NUMBER_COLORS: Record<number, string> = {
  1: '#3B82F6',
  2: '#22C55E',
  3: '#EF4444',
  4: '#1E3A8A',
  5: '#991B1B',
  6: '#0D9488',
  7: '#1C1917',
  8: '#6B7280',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function createEmptyGrid(rows: number, cols: number): CellData[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      hasMine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    })),
  );
}

function getNeighbors(row: number, col: number, rows: number, cols: number): [number, number][] {
  const neighbors: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push([nr, nc]);
      }
    }
  }
  return neighbors;
}

function placeMines(
  rows: number,
  cols: number,
  mineCount: number,
  safeRow: number,
  safeCol: number,
): CellData[][] {
  const grid = createEmptyGrid(rows, cols);

  // Build a set of positions that must remain mine-free (first tap + neighbors)
  const safeSet = new Set<string>();
  safeSet.add(`${safeRow},${safeCol}`);
  for (const [nr, nc] of getNeighbors(safeRow, safeCol, rows, cols)) {
    safeSet.add(`${nr},${nc}`);
  }

  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (grid[r][c].hasMine || safeSet.has(`${r},${c}`)) continue;
    grid[r][c].hasMine = true;
    placed++;
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].hasMine) continue;
      let count = 0;
      for (const [nr, nc] of getNeighbors(r, c, rows, cols)) {
        if (grid[nr][nc].hasMine) count++;
      }
      grid[r][c].adjacentMines = count;
    }
  }

  return grid;
}

/** Iterative flood-fill reveal (BFS) to avoid stack overflow. */
function floodReveal(grid: CellData[][], startRow: number, startCol: number): CellData[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
  const queue: [number, number][] = [[startRow, startCol]];
  const visited = new Set<string>();
  visited.add(`${startRow},${startCol}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = newGrid[r][c];
    if (cell.flagged || cell.hasMine) continue;
    cell.revealed = true;

    if (cell.adjacentMines === 0) {
      for (const [nr, nc] of getNeighbors(r, c, rows, cols)) {
        const key = `${nr},${nc}`;
        if (!visited.has(key) && !newGrid[nr][nc].revealed && !newGrid[nr][nc].flagged) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
  }

  return newGrid;
}

function cloneGrid(grid: CellData[][]): CellData[][] {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function countFlags(grid: CellData[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.flagged) count++;
    }
  }
  return count;
}

function checkWin(grid: CellData[][]): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.hasMine && !cell.revealed) return false;
    }
  }
  return true;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MinesweeperScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const config = DIFFICULTIES[difficulty];

  const [grid, setGrid] = useState<CellData[][]>(() => createEmptyGrid(config.rows, config.cols));
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cellSize = Math.floor((screenWidth - 48) / config.cols);
  const flagCount = useMemo(() => countFlags(grid), [grid]);
  const minesRemaining = config.mines - flagCount;

  // Timer logic
  useEffect(() => {
    if (gameStatus === 'playing') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameStatus]);

  const resetGame = useCallback(
    (diff?: Difficulty) => {
      const d = diff ?? difficulty;
      const cfg = DIFFICULTIES[d];
      setGrid(createEmptyGrid(cfg.rows, cfg.cols));
      setGameStatus('idle');
      setFlagMode(false);
      setElapsed(0);
    },
    [difficulty],
  );

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      if (d === difficulty) return;
      setDifficulty(d);
      resetGame(d);
    },
    [difficulty, resetGame],
  );

  const handleCellPress = useCallback(
    (row: number, col: number) => {
      if (gameStatus === 'won' || gameStatus === 'lost') return;

      const cell = grid[row][col];

      // Flag mode
      if (flagMode) {
        if (cell.revealed) return;
        const newGrid = cloneGrid(grid);
        newGrid[row][col].flagged = !newGrid[row][col].flagged;
        setGrid(newGrid);
        return;
      }

      // Normal reveal mode
      if (cell.flagged || cell.revealed) return;

      // First tap: generate mines
      if (gameStatus === 'idle') {
        const newGrid = placeMines(config.rows, config.cols, config.mines, row, col);
        const revealed = floodReveal(newGrid, row, col);
        setGrid(revealed);
        setGameStatus('playing');
        if (checkWin(revealed)) {
          setGameStatus('won');
        }
        return;
      }

      // Hit a mine
      if (cell.hasMine) {
        const newGrid = cloneGrid(grid);
        // Reveal all mines
        for (let r = 0; r < config.rows; r++) {
          for (let c = 0; c < config.cols; c++) {
            if (newGrid[r][c].hasMine) {
              newGrid[r][c].revealed = true;
            }
          }
        }
        // Mark the tapped mine specifically
        newGrid[row][col].revealed = true;
        setGrid(newGrid);
        setGameStatus('lost');
        return;
      }

      // Normal reveal with flood-fill
      const newGrid = floodReveal(grid, row, col);
      setGrid(newGrid);
      if (checkWin(newGrid)) {
        setGameStatus('won');
      }
    },
    [grid, gameStatus, flagMode, config],
  );

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCellContent = (cell: CellData, row: number, col: number) => {
    if (cell.flagged && !cell.revealed) {
      // If game is lost and this flag is on a mine, show checkmark; otherwise show flag
      if (gameStatus === 'lost' && cell.hasMine) {
        return <Ionicons name="checkmark-circle" size={cellSize * 0.55} color="#10B981" />;
      }
      if (gameStatus === 'lost' && !cell.hasMine) {
        // Wrong flag
        return <Ionicons name="close-circle" size={cellSize * 0.55} color="#EF4444" />;
      }
      return <Ionicons name="flag" size={cellSize * 0.5} color="#EF4444" />;
    }

    if (!cell.revealed) return null;

    if (cell.hasMine) {
      return (
        <Text style={[styles.cellText, { fontSize: cellSize * 0.45 }]}>
          💣
        </Text>
      );
    }

    if (cell.adjacentMines > 0) {
      return (
        <Text
          style={[
            styles.cellNumber,
            {
              fontSize: cellSize * 0.45,
              color: NUMBER_COLORS[cell.adjacentMines] ?? colors.text,
            },
          ]}
        >
          {cell.adjacentMines}
        </Text>
      );
    }

    return null;
  };

  const getCellBg = (cell: CellData): string => {
    if (cell.revealed && cell.hasMine) {
      return 'rgba(239,68,68,0.25)';
    }
    if (cell.revealed) {
      return colors.surface;
    }
    return colors.card;
  };

  return (
    <ScreenShell title="Minesweeper" accentColor={ACCENT}>
      {/* Difficulty selector */}
      <View style={styles.diffRow}>
        {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.diffChip, difficulty === d && styles.diffChipActive]}
            onPress={() => switchDifficulty(d)}
            activeOpacity={0.7}
          >
            <Text style={[styles.diffText, difficulty === d && styles.diffTextActive]}>
              {DIFFICULTIES[d].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats header */}
      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="skull-outline" size={18} color="#EF4444" />
            <Text style={[styles.statValue, { color: colors.text }]}>{minesRemaining}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Mines</Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={18} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(elapsed)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time</Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={[
              styles.statItem,
              styles.flagToggle,
              flagMode && styles.flagToggleActive,
            ]}
            onPress={() => setFlagMode((f) => !f)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flag"
              size={18}
              color={flagMode ? '#fff' : '#EF4444'}
            />
            <Text
              style={[
                styles.statValue,
                { color: flagMode ? '#fff' : colors.text },
              ]}
            >
              {flagMode ? 'ON' : 'OFF'}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: flagMode ? 'rgba(255,255,255,0.7)' : colors.textMuted },
              ]}
            >
              Flag
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Game board */}
      <View style={styles.boardWrapper}>
        <View
          style={[
            styles.board,
            {
              width: cellSize * config.cols,
              borderColor: colors.border,
              backgroundColor: colors.border,
            },
          ]}
        >
          {grid.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.boardRow}>
              {row.map((cell, colIdx) => (
                <TouchableOpacity
                  key={`${rowIdx}-${colIdx}`}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: getCellBg(cell),
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleCellPress(rowIdx, colIdx)}
                  activeOpacity={0.6}
                  disabled={gameStatus === 'won' || gameStatus === 'lost'}
                >
                  {getCellContent(cell, rowIdx, colIdx)}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Game result overlay */}
      {(gameStatus === 'won' || gameStatus === 'lost') && (
        <View
          style={[
            styles.resultCard,
            {
              backgroundColor: gameStatus === 'won' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              borderColor: gameStatus === 'won' ? '#10B981' : '#EF4444',
            },
          ]}
        >
          <Ionicons
            name={gameStatus === 'won' ? 'trophy' : 'skull'}
            size={28}
            color={gameStatus === 'won' ? '#10B981' : '#EF4444'}
          />
          <View style={styles.resultTextWrap}>
            <Text
              style={[
                styles.resultTitle,
                { color: gameStatus === 'won' ? '#10B981' : '#EF4444' },
              ]}
            >
              {gameStatus === 'won' ? 'You Win!' : 'Game Over!'}
            </Text>
            <Text style={[styles.resultSub, { color: colors.textMuted }]}>
              {gameStatus === 'won'
                ? `Cleared in ${formatTime(elapsed)}`
                : 'You hit a mine'}
            </Text>
          </View>
        </View>
      )}

      {/* New Game button */}
      <TouchableOpacity
        style={styles.newGameBtn}
        onPress={() => resetGame()}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh-outline" size={20} color="#fff" />
        <Text style={styles.newGameText}>New Game</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    diffRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    diffChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    diffChipActive: {
      backgroundColor: ACCENT,
      borderColor: ACCENT,
    },
    diffText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: c.textMuted,
    },
    diffTextActive: {
      color: '#fff',
    },
    statsCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontFamily: Fonts.bold,
      fontSize: 18,
    },
    statLabel: {
      fontFamily: Fonts.regular,
      fontSize: 11,
    },
    statDivider: {
      width: 1,
      height: 36,
    },
    flagToggle: {
      borderRadius: Radii.md,
      paddingVertical: Spacing.xs,
    },
    flagToggleActive: {
      backgroundColor: '#EF4444',
    },
    boardWrapper: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    board: {
      flexDirection: 'column',
      borderWidth: 1,
      borderRadius: Radii.sm,
      overflow: 'hidden',
    },
    boardRow: {
      flexDirection: 'row',
    },
    cell: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
    },
    cellText: {
      textAlign: 'center',
    },
    cellNumber: {
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    resultCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
      borderRadius: Radii.xl,
      borderWidth: 1.5,
      marginBottom: Spacing.lg,
    },
    resultTextWrap: {
      flex: 1,
    },
    resultTitle: {
      fontFamily: Fonts.bold,
      fontSize: 20,
    },
    resultSub: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      marginTop: 2,
    },
    newGameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingVertical: Spacing.lg,
      borderRadius: Radii.md,
      marginBottom: Spacing.lg,
    },
    newGameText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      color: '#fff',
    },
  });
