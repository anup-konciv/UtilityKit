import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#4F46E5';

type MatSize = 2 | 3;
type Matrix = number[][];

function emptyMatrix(n: MatSize): Matrix {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function addMat(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

function subMat(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

function mulMat(a: Matrix, b: Matrix): Matrix {
  const n = a.length;
  const r = emptyMatrix(n as MatSize);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        r[i][j] += a[i][k] * b[k][j];
  return r;
}

function det2(m: Matrix): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

function det3(m: Matrix): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function determinant(m: Matrix): number {
  return m.length === 2 ? det2(m) : det3(m);
}

function transpose(m: Matrix): Matrix {
  const n = m.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => m[j][i]));
}

function inverse2(m: Matrix): Matrix | null {
  const d = det2(m);
  if (d === 0) return null;
  return [
    [m[1][1] / d, -m[0][1] / d],
    [-m[1][0] / d, m[0][0] / d],
  ];
}

function inverse3(m: Matrix): Matrix | null {
  const d = det3(m);
  if (d === 0) return null;
  const cofactors: Matrix = [
    [
      m[1][1] * m[2][2] - m[1][2] * m[2][1],
      -(m[1][0] * m[2][2] - m[1][2] * m[2][0]),
      m[1][0] * m[2][1] - m[1][1] * m[2][0],
    ],
    [
      -(m[0][1] * m[2][2] - m[0][2] * m[2][1]),
      m[0][0] * m[2][2] - m[0][2] * m[2][0],
      -(m[0][0] * m[2][1] - m[0][1] * m[2][0]),
    ],
    [
      m[0][1] * m[1][2] - m[0][2] * m[1][1],
      -(m[0][0] * m[1][2] - m[0][2] * m[1][0]),
      m[0][0] * m[1][1] - m[0][1] * m[1][0],
    ],
  ];
  const adj = transpose(cofactors);
  return adj.map(row => row.map(v => v / d));
}

function inverseMat(m: Matrix): Matrix | null {
  return m.length === 2 ? inverse2(m) : inverse3(m);
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

type Op = 'add' | 'subtract' | 'multiply' | 'determinant' | 'transpose' | 'inverse';

export default function MatrixCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [size, setSize] = useState<MatSize>(2);
  const [matA, setMatA] = useState<string[][]>(() => Array.from({ length: 2 }, () => Array(2).fill('')));
  const [matB, setMatB] = useState<string[][]>(() => Array.from({ length: 2 }, () => Array(2).fill('')));
  const [op, setOp] = useState<Op>('add');
  const [result, setResult] = useState<Matrix | number | string | null>(null);

  const changeSize = (s: MatSize) => {
    setSize(s);
    setMatA(Array.from({ length: s }, () => Array(s).fill('')));
    setMatB(Array.from({ length: s }, () => Array(s).fill('')));
    setResult(null);
  };

  const parseMatrix = (m: string[][]): Matrix => m.map(row => row.map(v => parseFloat(v) || 0));

  const updateCell = (mat: 'A' | 'B', r: number, c: number, val: string) => {
    const setter = mat === 'A' ? setMatA : setMatB;
    setter(prev => prev.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell))));
    setResult(null);
  };

  const needsB = op === 'add' || op === 'subtract' || op === 'multiply';

  const calculate = () => {
    const a = parseMatrix(matA);
    const b = parseMatrix(matB);

    switch (op) {
      case 'add': setResult(addMat(a, b)); break;
      case 'subtract': setResult(subMat(a, b)); break;
      case 'multiply': setResult(mulMat(a, b)); break;
      case 'determinant': setResult(determinant(a)); break;
      case 'transpose': setResult(transpose(a)); break;
      case 'inverse': {
        const inv = inverseMat(a);
        setResult(inv ?? 'Matrix is singular (no inverse)');
        break;
      }
    }
  };

  const renderMatrixInput = (label: string, mat: string[][], which: 'A' | 'B') => (
    <View style={[styles.matCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.matLabel, { color: ACCENT }]}>Matrix {label}</Text>
      {Array.from({ length: size }, (_, r) => (
        <View key={r} style={styles.matRow}>
          {Array.from({ length: size }, (_, c) => (
            <TextInput
              key={c}
              style={[styles.matCell, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={mat[r]?.[c] ?? ''}
              onChangeText={v => updateCell(which, r, c, v)}
              keyboardType="numeric"
              textAlign="center"
              maxLength={6}
            />
          ))}
        </View>
      ))}
    </View>
  );

  const renderMatrixResult = (m: Matrix) => (
    <View style={styles.resultMatrix}>
      {m.map((row, r) => (
        <View key={r} style={styles.matRow}>
          {row.map((v, c) => (
            <View key={c} style={[styles.resultCell, { backgroundColor: ACCENT + '15' }]}>
              <Text style={[styles.resultCellText, { color: ACCENT }]}>{formatNum(v)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <ScreenShell title="Matrix Calculator" accentColor={ACCENT}>
      {/* Size selector */}
      <View style={styles.sizeRow}>
        {([2, 3] as MatSize[]).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.sizeBtn, size === s && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => changeSize(s)}
          >
            <Text style={[styles.sizeBtnText, { color: size === s ? '#fff' : colors.textMuted }]}>{s}x{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Operation selector */}
      <View style={styles.opRow}>
        {([
          { key: 'add', label: 'A + B', icon: 'add' },
          { key: 'subtract', label: 'A - B', icon: 'remove' },
          { key: 'multiply', label: 'A × B', icon: 'close' },
          { key: 'determinant', label: 'det(A)', icon: 'analytics' },
          { key: 'transpose', label: 'Aᵀ', icon: 'swap-vertical' },
          { key: 'inverse', label: 'A⁻¹', icon: 'return-down-back' },
        ] as { key: Op; label: string; icon: string }[]).map(o => (
          <TouchableOpacity
            key={o.key}
            style={[styles.opBtn, op === o.key && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setOp(o.key); setResult(null); }}
          >
            <Text style={[styles.opBtnText, { color: op === o.key ? '#fff' : colors.textMuted }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderMatrixInput('A', matA, 'A')}
      {needsB && renderMatrixInput('B', matB, 'B')}

      <TouchableOpacity style={[styles.calcBtn, { backgroundColor: ACCENT }]} onPress={calculate}>
        <Ionicons name="calculator" size={20} color="#fff" />
        <Text style={styles.calcBtnText}>Calculate</Text>
      </TouchableOpacity>

      {result !== null && (
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.resultTitle}>Result</Text>
          {typeof result === 'number' ? (
            <Text style={[styles.scalarResult, { color: ACCENT }]}>{formatNum(result)}</Text>
          ) : typeof result === 'string' ? (
            <Text style={[styles.errorText, { color: '#EF4444' }]}>{result}</Text>
          ) : (
            renderMatrixResult(result)
          )}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    sizeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    sizeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
    sizeBtnText: { fontSize: 14, fontFamily: Fonts.bold },
    opRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.lg },
    opBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border },
    opBtnText: { fontSize: 12, fontFamily: Fonts.bold },
    matCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
    matLabel: { fontSize: 13, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
    matRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    matCell: { flex: 1, borderWidth: 1.5, borderRadius: Radii.md, padding: 10, fontSize: 16, fontFamily: Fonts.bold },
    calcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    calcBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, alignItems: 'center' },
    resultTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    resultMatrix: { gap: 6 },
    resultCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: Radii.md, alignItems: 'center' },
    resultCellText: { fontSize: 16, fontFamily: Fonts.bold },
    scalarResult: { fontSize: 42, fontFamily: Fonts.bold },
    errorText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
