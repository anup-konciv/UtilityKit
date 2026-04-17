import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#6366F1';

type Difficulty = 'easy' | 'medium' | 'hard';
type Grid = number[][]; // 0 = empty, 1-9 = filled
type NotesGrid = Set<number>[][]; // pencil marks per cell

const DIFFICULTY_REMOVE: Record<Difficulty, number> = {
  easy: 30,
  medium: 40,
  hard: 50,
};

// ── Puzzle Generator ──

function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function createEmptyNotes(): NotesGrid {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>()),
  );
}

function isValidPlacement(grid: Grid, row: number, col: number, num: number): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }
  // Check column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fillDiagonalBoxes(grid: Grid): void {
  for (let box = 0; box < 3; box++) {
    const startRow = box * 3;
    const startCol = box * 3;
    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        grid[r][c] = nums[idx++];
      }
    }
  }
}

function solveSudoku(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValidPlacement(grid, r, c, num)) {
            grid[r][c] = num;
            if (solveSudoku(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generatePuzzle(difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const grid = createEmptyGrid();
  fillDiagonalBoxes(grid);
  solveSudoku(grid);

  const solution = grid.map((row) => [...row]);
  const puzzle = grid.map((row) => [...row]);

  const cellsToRemove = DIFFICULTY_REMOVE[difficulty];
  const positions = shuffleArray(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number]),
  );

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= cellsToRemove) break;
    puzzle[r][c] = 0;
    removed++;
  }

  return { puzzle, solution };
}

function hasConflict(grid: Grid, row: number, col: number): boolean {
  const val = grid[row][col];
  if (val === 0) return false;

  // Check row
  for (let c = 0; c < 9; c++) {
    if (c !== col && grid[row][c] === val) return true;
  }
  // Check column
  for (let r = 0; r < 9; r++) {
    if (r !== row && grid[r][col] === val) return true;
  }
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (r !== row || c !== col) {
        if (grid[r][c] === val) return true;
      }
    }
  }
  return false;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ──

export default function SudokuScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const cellSize = Math.floor((screenWidth - 64) / 9);
  const gridSize = cellSize * 9;

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [puzzle, setPuzzle] = useState<Grid>(() => createEmptyGrid());
  const [solution, setSolution] = useState<Grid>(() => createEmptyGrid());
  const [playerGrid, setPlayerGrid] = useState<Grid>(() => createEmptyGrid());
  const [initialCells, setInitialCells] = useState<boolean[][]>(() =>
    Array.from({ length: 9 }, () => Array(9).fill(false)),
  );
  const [notes, setNotes] = useState<NotesGrid>(() => createEmptyNotes());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completionTime, setCompletionTime] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
  useEffect(() => {
    if (isRunning && !isComplete) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isComplete]);

  const startNewGame = useCallback(
    (diff: Difficulty) => {
      const { puzzle: p, solution: s } = generatePuzzle(diff);
      setPuzzle(p);
      setSolution(s);
      setPlayerGrid(p.map((row) => [...row]));
      setInitialCells(p.map((row) => row.map((v) => v !== 0)));
      setNotes(createEmptyNotes());
      setSelectedCell(null);
      setNotesMode(false);
      setTimer(0);
      setIsRunning(true);
      setIsComplete(false);
      setCompletionTime(0);
      setShowErrors(false);
    },
    [],
  );

  // Start game on first mount
  useEffect(() => {
    startNewGame(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellPress = useCallback(
    (row: number, col: number) => {
      if (isComplete) return;
      setSelectedCell([row, col]);
    },
    [isComplete],
  );

  const handleNumberPress = useCallback(
    (num: number) => {
      if (!selectedCell || isComplete) return;
      const [row, col] = selectedCell;
      if (initialCells[row][col]) return;

      if (notesMode) {
        setNotes((prev) => {
          const newNotes = prev.map((r) => r.map((s) => new Set(s)));
          if (newNotes[row][col].has(num)) {
            newNotes[row][col].delete(num);
          } else {
            newNotes[row][col].add(num);
          }
          return newNotes;
        });
        // Clear the cell value when entering notes
        setPlayerGrid((prev) => {
          if (prev[row][col] !== 0) {
            const newGrid = prev.map((r) => [...r]);
            newGrid[row][col] = 0;
            return newGrid;
          }
          return prev;
        });
      } else {
        setPlayerGrid((prev) => {
          const newGrid = prev.map((r) => [...r]);
          newGrid[row][col] = num;
          return newGrid;
        });
        // Clear notes for this cell
        setNotes((prev) => {
          const newNotes = prev.map((r) => r.map((s) => new Set(s)));
          newNotes[row][col].clear();
          return newNotes;
        });

        // Check if puzzle is complete
        const testGrid = playerGrid.map((r) => [...r]);
        testGrid[row][col] = num;
        const isFull = testGrid.every((r) => r.every((v) => v !== 0));
        if (isFull) {
          const isCorrect = testGrid.every((r, ri) =>
            r.every((v, ci) => v === solution[ri][ci]),
          );
          if (isCorrect) {
            setIsComplete(true);
            setIsRunning(false);
            setCompletionTime(timer);
          }
        }
      }
    },
    [selectedCell, isComplete, initialCells, notesMode, playerGrid, solution, timer],
  );

  const handleErase = useCallback(() => {
    if (!selectedCell || isComplete) return;
    const [row, col] = selectedCell;
    if (initialCells[row][col]) return;

    setPlayerGrid((prev) => {
      const newGrid = prev.map((r) => [...r]);
      newGrid[row][col] = 0;
      return newGrid;
    });
    setNotes((prev) => {
      const newNotes = prev.map((r) => r.map((s) => new Set(s)));
      newNotes[row][col].clear();
      return newNotes;
    });
  }, [selectedCell, isComplete, initialCells]);

  const handleCheckSolution = useCallback(() => {
    setShowErrors(true);
    const isFull = playerGrid.every((r) => r.every((v) => v !== 0));
    if (isFull) {
      const isCorrect = playerGrid.every((r, ri) =>
        r.every((v, ci) => v === solution[ri][ci]),
      );
      if (isCorrect) {
        setIsComplete(true);
        setIsRunning(false);
        setCompletionTime(timer);
      }
    }
  }, [playerGrid, solution, timer]);

  const isInSameGroup = (r: number, c: number): boolean => {
    if (!selectedCell) return false;
    const [sr, sc] = selectedCell;
    if (r === sr) return true;
    if (c === sc) return true;
    const boxR = Math.floor(sr / 3) * 3;
    const boxC = Math.floor(sc / 3) * 3;
    if (r >= boxR && r < boxR + 3 && c >= boxC && c < boxC + 3) return true;
    return false;
  };

  const getCellBgColor = (r: number, c: number): string => {
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      return ACCENT + '40';
    }
    if (isInSameGroup(r, c)) {
      return ACCENT + '15';
    }
    return 'transparent';
  };

  const isCellError = (r: number, c: number): boolean => {
    if (!showErrors) return false;
    return hasConflict(playerGrid, r, c);
  };

  const difficultyOptions: { key: Difficulty; label: string }[] = [
    { key: 'easy', label: 'Easy' },
    { key: 'medium', label: 'Medium' },
    { key: 'hard', label: 'Hard' },
  ];

  return (
    <ScreenShell title="Sudoku" accentColor={ACCENT}>
      {/* Completion banner */}
      {isComplete && (
        <View style={[styles.completionBanner, { backgroundColor: '#10B981' + '20', borderColor: '#10B981' + '40' }]}>
          <Ionicons name="trophy" size={28} color="#10B981" />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <Text style={[styles.completionTitle, { color: '#10B981' }]}>
              Congratulations!
            </Text>
            <Text style={[styles.completionSub, { color: colors.textMuted }]}>
              Puzzle solved in {formatTime(completionTime)}
            </Text>
          </View>
        </View>
      )}

      {/* Difficulty selector */}
      <View style={styles.difficultyRow}>
        {difficultyOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.difficultyBtn,
              {
                backgroundColor: difficulty === opt.key ? ACCENT : colors.card,
                borderColor: difficulty === opt.key ? ACCENT : colors.border,
              },
            ]}
            onPress={() => {
              setDifficulty(opt.key);
              startNewGame(opt.key);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.difficultyText,
                { color: difficulty === opt.key ? '#fff' : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timer and controls row */}
      <View style={[styles.infoRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.timerContainer}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.timerText, { color: colors.text }]}>
            {formatTime(timer)}
          </Text>
        </View>
        <View style={styles.infoActions}>
          <TouchableOpacity
            style={[
              styles.notesToggle,
              {
                backgroundColor: notesMode ? ACCENT : colors.inputBg,
                borderColor: notesMode ? ACCENT : colors.border,
              },
            ]}
            onPress={() => setNotesMode((p) => !p)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="pencil-outline"
              size={14}
              color={notesMode ? '#fff' : colors.textMuted}
            />
            <Text
              style={[
                styles.notesToggleText,
                { color: notesMode ? '#fff' : colors.textMuted },
              ]}
            >
              Notes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sudoku Grid */}
      <View style={[styles.gridWrapper, { width: gridSize, borderColor: colors.text }]}>
        {Array.from({ length: 9 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {Array.from({ length: 9 }, (_, col) => {
              const value = playerGrid[row][col];
              const isInitial = initialCells[row][col];
              const isSelected =
                selectedCell !== null &&
                selectedCell[0] === row &&
                selectedCell[1] === col;
              const error = isCellError(row, col) && !isInitial;
              const cellNotes = notes[row][col];
              const sameValueHighlight =
                selectedCell !== null &&
                value !== 0 &&
                playerGrid[selectedCell[0]][selectedCell[1]] === value;

              return (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: getCellBgColor(row, col),
                      borderColor: colors.border,
                    },
                    col % 3 === 0 && col !== 0 && { borderLeftWidth: 2, borderLeftColor: colors.text },
                    row % 3 === 0 && row !== 0 && { borderTopWidth: 2, borderTopColor: colors.text },
                    isSelected && { backgroundColor: ACCENT + '40' },
                    sameValueHighlight &&
                      !isSelected && { backgroundColor: ACCENT + '20' },
                  ]}
                  onPress={() => handleCellPress(row, col)}
                  activeOpacity={0.8}
                >
                  {value !== 0 ? (
                    <Text
                      style={[
                        styles.cellText,
                        {
                          fontSize: cellSize * 0.5,
                          color: error
                            ? '#EF4444'
                            : isInitial
                              ? colors.text
                              : ACCENT,
                          fontFamily: isInitial ? Fonts.bold : Fonts.semibold,
                        },
                      ]}
                    >
                      {value}
                    </Text>
                  ) : cellNotes.size > 0 ? (
                    <View style={styles.notesContainer}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <Text
                          key={n}
                          style={[
                            styles.noteText,
                            {
                              fontSize: cellSize * 0.22,
                              width: cellSize / 3,
                              height: cellSize / 3,
                              color: cellNotes.has(n) ? colors.textMuted : 'transparent',
                            },
                          ]}
                        >
                          {n}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Number pad */}
      <View style={styles.numPadContainer}>
        <View style={styles.numPadRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            // Count how many of this number are placed
            let count = 0;
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                if (playerGrid[r][c] === num) count++;
              }
            }
            const exhausted = count >= 9;

            return (
              <TouchableOpacity
                key={num}
                style={[
                  styles.numBtn,
                  {
                    backgroundColor: exhausted ? colors.glass : colors.card,
                    borderColor: colors.border,
                    opacity: exhausted ? 0.4 : 1,
                  },
                ]}
                onPress={() => handleNumberPress(num)}
                activeOpacity={0.7}
                disabled={exhausted || isComplete}
              >
                <Text
                  style={[
                    styles.numBtnText,
                    { color: colors.text },
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Action buttons row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleErase}
          activeOpacity={0.7}
        >
          <Ionicons name="backspace-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Erase</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleCheckSolution}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={ACCENT} />
          <Text style={[styles.actionBtnText, { color: ACCENT }]}>Check</Text>
        </TouchableOpacity>
      </View>

      {/* New Game button */}
      <TouchableOpacity
        style={styles.newGameBtn}
        onPress={() => startNewGame(difficulty)}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh-outline" size={20} color="#fff" />
        <Text style={styles.newGameText}>New Game</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

/* ── Styles ── */
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    completionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.lg,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    completionTitle: {
      fontFamily: Fonts.bold,
      fontSize: 18,
    },
    completionSub: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      marginTop: 2,
    },
    difficultyRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    difficultyBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    difficultyText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    timerText: {
      fontFamily: Fonts.bold,
      fontSize: 18,
    },
    infoActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    notesToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.sm,
      borderWidth: 1,
    },
    notesToggleText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
    gridWrapper: {
      alignSelf: 'center',
      borderWidth: 2,
      marginBottom: Spacing.lg,
    },
    cell: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
    },
    cellText: {
      textAlign: 'center',
    },
    notesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    },
    noteText: {
      textAlign: 'center',
      fontFamily: Fonts.regular,
      lineHeight: undefined,
    },
    numPadContainer: {
      marginBottom: Spacing.md,
    },
    numPadRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    numBtn: {
      width: 36,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radii.sm,
      borderWidth: 1,
    },
    numBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 18,
    },
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    actionBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
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
