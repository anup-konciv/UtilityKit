import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#3B82F6';

type Player = 'X' | 'O';
type Cell = Player | null;
type Board = Cell[];
type Mode = 'ai' | 'friend';

const WIN_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

const EMPTY_BOARD: Board = Array(9).fill(null);

function checkWinner(board: Board): { winner: Player; line: number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line };
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every((c) => c !== null);
}

function getAvailableMoves(board: Board): number[] {
  return board.reduce<number[]>((acc, cell, i) => {
    if (cell === null) acc.push(i);
    return acc;
  }, []);
}

// AI: win -> block -> center -> corner -> edge
function getAIMove(board: Board): number {
  const available = getAvailableMoves(board);
  if (available.length === 0) return -1;

  // 1. Try to win
  for (const move of available) {
    const test = [...board];
    test[move] = 'O';
    if (checkWinner(test)?.winner === 'O') return move;
  }

  // 2. Try to block
  for (const move of available) {
    const test = [...board];
    test[move] = 'X';
    if (checkWinner(test)?.winner === 'X') return move;
  }

  // 3. Take center
  if (board[4] === null) return 4;

  // 4. Take a corner
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

  // 5. Take an edge
  const edges = [1, 3, 5, 7].filter((i) => board[i] === null);
  if (edges.length > 0) return edges[Math.floor(Math.random() * edges.length)];

  return available[0];
}

export default function TicTacToeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [board, setBoard] = useState<Board>([...EMPTY_BOARD]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winResult, setWinResult] = useState<{ winner: Player; line: number[] } | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [mode, setMode] = useState<Mode>('ai');
  const [scores, setScores] = useState({ wins: 0, losses: 0, draws: 0 });
  const [pressedCell, setPressedCell] = useState<number | null>(null);

  const gameOver = winResult !== null || isDraw;

  const resetGame = useCallback(() => {
    setBoard([...EMPTY_BOARD]);
    setCurrentPlayer('X');
    setWinResult(null);
    setIsDraw(false);
    setPressedCell(null);
  }, []);

  const handleCellPress = useCallback(
    (index: number) => {
      if (board[index] !== null || gameOver) return;
      if (mode === 'ai' && currentPlayer === 'O') return;

      const newBoard = [...board];
      newBoard[index] = currentPlayer;

      const result = checkWinner(newBoard);
      if (result) {
        setBoard(newBoard);
        setWinResult(result);
        if (mode === 'ai') {
          if (result.winner === 'X') {
            setScores((s) => ({ ...s, wins: s.wins + 1 }));
          } else {
            setScores((s) => ({ ...s, losses: s.losses + 1 }));
          }
        } else {
          // In friend mode, X winning counts as "wins", O as "losses"
          if (result.winner === 'X') {
            setScores((s) => ({ ...s, wins: s.wins + 1 }));
          } else {
            setScores((s) => ({ ...s, losses: s.losses + 1 }));
          }
        }
        return;
      }

      if (isBoardFull(newBoard)) {
        setBoard(newBoard);
        setIsDraw(true);
        setScores((s) => ({ ...s, draws: s.draws + 1 }));
        return;
      }

      if (mode === 'ai') {
        // Player just moved as X, now AI moves as O
        const aiMove = getAIMove(newBoard);
        if (aiMove >= 0) {
          newBoard[aiMove] = 'O';
          const aiResult = checkWinner(newBoard);
          if (aiResult) {
            setBoard(newBoard);
            setWinResult(aiResult);
            setScores((s) => ({ ...s, losses: s.losses + 1 }));
            return;
          }
          if (isBoardFull(newBoard)) {
            setBoard(newBoard);
            setIsDraw(true);
            setScores((s) => ({ ...s, draws: s.draws + 1 }));
            return;
          }
        }
        setBoard(newBoard);
        setCurrentPlayer('X');
      } else {
        setBoard(newBoard);
        setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
      }
    },
    [board, currentPlayer, gameOver, mode],
  );

  const switchMode = useCallback(
    (newMode: Mode) => {
      if (newMode === mode) return;
      setMode(newMode);
      setBoard([...EMPTY_BOARD]);
      setCurrentPlayer('X');
      setWinResult(null);
      setIsDraw(false);
      setScores({ wins: 0, losses: 0, draws: 0 });
      setPressedCell(null);
    },
    [mode],
  );

  const getResultMessage = (): string => {
    if (isDraw) return "It's a Draw!";
    if (!winResult) return '';
    if (mode === 'ai') {
      return winResult.winner === 'X' ? 'You Win!' : 'You Lose!';
    }
    return `Player ${winResult.winner} Wins!`;
  };

  const getResultColor = (): string => {
    if (isDraw) return colors.textMuted;
    if (!winResult) return colors.text;
    if (mode === 'ai') {
      return winResult.winner === 'X' ? '#10B981' : '#EF4444';
    }
    return winResult.winner === 'X' ? ACCENT : '#F59E0B';
  };

  const getTurnLabel = (): string => {
    if (gameOver) return getResultMessage();
    if (mode === 'ai') return "Your Turn (X)";
    return `Player ${currentPlayer}'s Turn`;
  };

  return (
    <ScreenShell title="Tic-Tac-Toe" accentColor={ACCENT}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'ai' && styles.modeBtnActive]}
          onPress={() => switchMode('ai')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="hardware-chip-outline"
            size={16}
            color={mode === 'ai' ? '#fff' : colors.textMuted}
          />
          <Text style={[styles.modeText, mode === 'ai' && styles.modeTextActive]}>vs AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'friend' && styles.modeBtnActive]}
          onPress={() => switchMode('friend')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={mode === 'friend' ? '#fff' : colors.textMuted}
          />
          <Text style={[styles.modeText, mode === 'friend' && styles.modeTextActive]}>
            vs Friend
          </Text>
        </TouchableOpacity>
      </View>

      {/* Score card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: '#10B981' }]}>{scores.wins}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>
              {mode === 'ai' ? 'Wins' : 'X Wins'}
            </Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.textMuted }]}>{scores.draws}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Draws</Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: '#EF4444' }]}>{scores.losses}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>
              {mode === 'ai' ? 'Losses' : 'O Wins'}
            </Text>
          </View>
        </View>
      </View>

      {/* Turn / result indicator */}
      <View style={styles.turnRow}>
        {gameOver ? (
          <Ionicons
            name={isDraw ? 'remove-circle-outline' : winResult?.winner === 'X' ? 'trophy-outline' : 'sad-outline'}
            size={20}
            color={getResultColor()}
          />
        ) : (
          <View
            style={[
              styles.turnDot,
              { backgroundColor: currentPlayer === 'X' ? ACCENT : '#F59E0B' },
            ]}
          />
        )}
        <Text
          style={[
            styles.turnText,
            { color: gameOver ? getResultColor() : colors.text },
            gameOver && styles.turnTextBold,
          ]}
        >
          {getTurnLabel()}
        </Text>
      </View>

      {/* Game board */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.board}>
          {board.map((cell, index) => {
            const isWinCell = winResult?.line.includes(index) ?? false;
            const isPressed = pressedCell === index;
            const isEmpty = cell === null && !gameOver;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.cell,
                  {
                    borderColor: colors.border,
                    backgroundColor: isWinCell
                      ? winResult?.winner === 'X'
                        ? 'rgba(16,185,129,0.15)'
                        : 'rgba(239,68,68,0.15)'
                      : isPressed
                        ? colors.glass
                        : 'transparent',
                  },
                  // Remove right border for last column
                  index % 3 === 2 && { borderRightWidth: 0 },
                  // Remove bottom border for last row
                  index >= 6 && { borderBottomWidth: 0 },
                ]}
                onPress={() => handleCellPress(index)}
                onPressIn={() => isEmpty && setPressedCell(index)}
                onPressOut={() => setPressedCell(null)}
                activeOpacity={1}
                disabled={cell !== null || gameOver}
              >
                {cell === 'X' && (
                  <Text
                    style={[
                      styles.cellMark,
                      { color: ACCENT },
                      isWinCell && styles.cellMarkWin,
                    ]}
                  >
                    X
                  </Text>
                )}
                {cell === 'O' && (
                  <Text
                    style={[
                      styles.cellMark,
                      { color: '#F59E0B' },
                      isWinCell && styles.cellMarkWin,
                    ]}
                  >
                    O
                  </Text>
                )}
                {isEmpty && isPressed && (
                  <Text style={[styles.cellGhost, { color: colors.textMuted }]}>
                    {mode === 'ai' ? 'X' : currentPlayer}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* New Game button */}
      <TouchableOpacity style={styles.newGameBtn} onPress={resetGame} activeOpacity={0.8}>
        <Ionicons name="refresh-outline" size={20} color="#fff" />
        <Text style={styles.newGameText}>New Game</Text>
      </TouchableOpacity>

      {/* Reset scores */}
      {(scores.wins > 0 || scores.losses > 0 || scores.draws > 0) && (
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: colors.border }]}
          onPress={() => setScores({ wins: 0, losses: 0, draws: 0 })}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>Reset Scores</Text>
        </TouchableOpacity>
      )}
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
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreItem: {
      flex: 1,
      alignItems: 'center',
    },
    scoreValue: {
      fontFamily: Fonts.bold,
      fontSize: 26,
    },
    scoreLabel: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    scoreDivider: {
      width: 1,
      height: 36,
    },
    turnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    turnDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    turnText: {
      fontFamily: Fonts.medium,
      fontSize: 16,
    },
    turnTextBold: {
      fontFamily: Fonts.bold,
      fontSize: 18,
    },
    board: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cell: {
      width: '33.333%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: 2,
      borderBottomWidth: 2,
    },
    cellMark: {
      fontFamily: Fonts.bold,
      fontSize: 44,
      lineHeight: 52,
    },
    cellMarkWin: {
      fontSize: 48,
      lineHeight: 56,
    },
    cellGhost: {
      fontFamily: Fonts.medium,
      fontSize: 36,
      lineHeight: 44,
      opacity: 0.25,
    },
    newGameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingVertical: Spacing.lg,
      borderRadius: Radii.md,
      marginBottom: Spacing.md,
    },
    newGameText: {
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
      marginBottom: Spacing.lg,
    },
    resetBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
  });
