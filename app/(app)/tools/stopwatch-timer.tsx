import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type Mode = 'stopwatch' | 'countdown';

function padZ(n: number) { return String(Math.floor(n)).padStart(2, '0'); }
function fmtMs(ms: number) {
  const s = Math.abs(ms) / 1000;
  return `${padZ(s / 60)}:${padZ(s % 60)}.${padZ((Math.abs(ms) % 1000) / 10)}`;
}

export default function StopwatchTimerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('stopwatch');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  const [ctHours, setCtHours] = useState('0');
  const [ctMins, setCtMins] = useState('5');
  const [ctSecs, setCtSecs] = useState('0');
  const [ctMs, setCtMs] = useState(0);
  const [ctFinished, setCtFinished] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const ctEndRef = useRef(0);

  const clearTick = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Stopwatch
  const swStart = useCallback(() => {
    setRunning(true);
    startRef.current = Date.now() - elapsed;
    intervalRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 30);
  }, [elapsed]);

  const swPause = () => { clearTick(); setRunning(false); };

  const swReset = () => { clearTick(); setRunning(false); setElapsed(0); setLaps([]); };

  const swLap = () => {
    const lapBase = laps.reduce((a, b) => a + b, 0);
    setLaps((prev) => [...prev, elapsed - lapBase]);
  };

  // Countdown
  const ctStart = useCallback(() => {
    const target = ((parseInt(ctHours) || 0) * 3600 + (parseInt(ctMins) || 0) * 60 + (parseInt(ctSecs) || 0)) * 1000;
    if (!target) return;
    const remaining = ctMs > 0 ? ctMs : target;
    setCtMs(remaining);
    setCtFinished(false);
    setRunning(true);
    ctEndRef.current = Date.now() + remaining;
    intervalRef.current = setInterval(() => {
      const left = ctEndRef.current - Date.now();
      if (left <= 0) {
        clearTick();
        setCtMs(0);
        setRunning(false);
        setCtFinished(true);
      } else {
        setCtMs(left);
      }
    }, 30);
  }, [ctHours, ctMins, ctSecs, ctMs]);

  const ctPause = () => { clearTick(); setRunning(false); };

  const ctReset = () => { clearTick(); setRunning(false); setCtMs(0); setCtFinished(false); };

  useEffect(() => () => clearTick(), []);

  const switchMode = (m: Mode) => {
    clearTick(); setRunning(false);
    if (m === 'stopwatch') { setElapsed(0); setLaps([]); }
    else { setCtMs(0); setCtFinished(false); }
    setMode(m);
  };

  const swDisplayColor = running ? colors.accent : colors.text;
  const ctDisplayColor = ctFinished ? colors.error : running ? '#F97316' : colors.text;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: '#F97316' }]}>Stopwatch & Timer</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Mode Toggle */}
      <View style={[styles.modeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['stopwatch', 'countdown'] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modePill, mode === m && { backgroundColor: '#F97316' }]}
            onPress={() => switchMode(m)}
          >
            <Text style={[styles.modePillText, { color: mode === m ? '#fff' : colors.textMuted }]}>
              {m === 'stopwatch' ? '⏱ Stopwatch' : '⏲ Countdown'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STOPWATCH */}
      {mode === 'stopwatch' && (
        <View style={styles.body}>
          <Text style={[styles.display, { color: swDisplayColor }]}>{fmtMs(elapsed)}</Text>
          <View style={styles.ctrlRow}>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: running ? '#F59E0B' : '#F97316' }]}
              onPress={running ? swPause : swStart}
            >
              <Text style={styles.ctrlBtnText}>{running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={running ? swLap : swReset}
            >
              <Text style={[styles.ctrlBtnText, { color: colors.text }]}>{running ? 'Lap' : 'Reset'}</Text>
            </TouchableOpacity>
          </View>
          {laps.length > 0 && (
            <FlatList
              data={[...laps].reverse()}
              keyExtractor={(_, i) => String(i)}
              style={styles.lapList}
              renderItem={({ item, index }) => {
                const lapNum = laps.length - index;
                return (
                  <View style={[styles.lapRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.lapLabel, { color: colors.textMuted }]}>Lap {lapNum}</Text>
                    <Text style={[styles.lapTime, { color: colors.accent }]}>{fmtMs(item)}</Text>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* COUNTDOWN */}
      {mode === 'countdown' && (
        <View style={styles.body}>
          {!running && ctMs === 0 && (
            <View style={styles.ctInputRow}>
              {[
                { label: 'H', val: ctHours, set: setCtHours },
                { label: 'M', val: ctMins, set: setCtMins },
                { label: 'S', val: ctSecs, set: setCtSecs },
              ].map((f, i) => (
                <View key={f.label} style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.ctFieldLabel, { color: colors.textMuted }]}>{f.label}</Text>
                    <View style={[styles.ctField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TouchableOpacity onPress={() => f.set(String(Math.max(0, (parseInt(f.val) || 0) + 1)))}>
                        <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                      <Text style={[styles.ctFieldVal, { color: colors.text }]}>{padZ(parseInt(f.val) || 0)}</Text>
                      <TouchableOpacity onPress={() => f.set(String(Math.max(0, (parseInt(f.val) || 0) - 1)))}>
                        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {i < 2 && <Text style={[styles.colon, { color: colors.textMuted }]}>:</Text>}
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.display, { color: ctDisplayColor }]}>
            {ctFinished ? '00:00.00' : fmtMs(ctMs || ((parseInt(ctHours)||0)*3600 + (parseInt(ctMins)||0)*60 + (parseInt(ctSecs)||0))*1000)}
          </Text>
          {ctFinished && <Text style={[styles.finishedText, { color: colors.error }]}>⏰ Time's up!</Text>}
          <View style={styles.ctrlRow}>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: running ? '#F59E0B' : '#F97316' }]}
              onPress={running ? ctPause : ctStart}
            >
              <Text style={styles.ctrlBtnText}>{running ? 'Pause' : ctMs > 0 ? 'Resume' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={ctReset}
            >
              <Text style={[styles.ctrlBtnText, { color: colors.text }]}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
    backBtn: { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: Fonts.bold },
    modeToggle: { flexDirection: 'row', margin: Spacing.lg, borderRadius: Radii.pill, padding: 4, gap: 4, borderWidth: 1 },
    modePill: { flex: 1, paddingVertical: 9, borderRadius: Radii.pill, alignItems: 'center' },
    modePillText: { fontSize: 13, fontFamily: Fonts.semibold },
    body: { flex: 1, alignItems: 'center', paddingTop: Spacing.xl },
    display: { fontSize: 60, fontFamily: Fonts.regular, letterSpacing: -2, fontVariant: ['tabular-nums'], marginBottom: Spacing.xl },
    ctrlRow: { flexDirection: 'row', gap: Spacing.md },
    ctrlBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: Radii.pill },
    ctrlBtnText: { fontSize: 16, fontFamily: Fonts.semibold, color: '#fff' },
    lapList: { width: '100%', marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
    lapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
    lapLabel: { fontSize: 13, fontFamily: Fonts.medium },
    lapTime: { fontSize: 13, fontFamily: Fonts.semibold },
    ctInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, gap: 0 },
    ctFieldLabel: { fontSize: 11, fontFamily: Fonts.bold, marginBottom: 4 },
    ctField: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', minWidth: 64 },
    ctFieldVal: { fontSize: 28, fontFamily: Fonts.bold, marginVertical: 4 },
    colon: { fontSize: 28, fontFamily: Fonts.bold, marginHorizontal: 4, marginTop: 20 },
    finishedText: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.md },
  });
