import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#D946EF';

const TEMPO_NAMES: [number, string][] = [
  [20, 'Grave'], [40, 'Largo'], [55, 'Lento'], [66, 'Adagio'],
  [76, 'Andante'], [108, 'Moderato'], [120, 'Allegro'],
  [156, 'Vivace'], [176, 'Presto'], [200, 'Prestissimo'],
];

function getTempoName(bpm: number): string {
  for (let i = TEMPO_NAMES.length - 1; i >= 0; i--) {
    if (bpm >= TEMPO_NAMES[i][0]) return TEMPO_NAMES[i][1];
  }
  return 'Grave';
}

const TIME_SIGS = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '6/8', beats: 6 },
];

const BPM_PRESETS = [60, 80, 100, 120, 140, 160, 180];

export default function MetronomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [timeSig, setTimeSig] = useState(2); // index into TIME_SIGS
  const [currentBeat, setCurrentBeat] = useState(0);

  // Tap tempo
  const [taps, setTaps] = useState<number[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beats = TIME_SIGS[timeSig].beats;

  const start = useCallback(() => {
    setPlaying(true);
    setCurrentBeat(0);
  }, []);

  const stop = useCallback(() => {
    setPlaying(false);
    setCurrentBeat(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const ms = 60000 / bpm;
    let beat = 0;
    setCurrentBeat(1);
    intervalRef.current = setInterval(() => {
      beat = (beat + 1) % beats;
      setCurrentBeat(beat + 1);
    }, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, bpm, beats]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const adjustBpm = (delta: number) => {
    setBpm(b => Math.max(20, Math.min(300, b + delta)));
  };

  const handleTapTempo = () => {
    const now = Date.now();
    const recent = [...taps, now].filter(t => now - t < 5000);
    setTaps(recent);
    if (recent.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        intervals.push(recent[i] - recent[i - 1]);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapBpm = Math.round(60000 / avgMs);
      if (tapBpm >= 20 && tapBpm <= 300) setBpm(tapBpm);
    }
  };

  const tempoName = getTempoName(bpm);

  return (
    <ScreenShell title="Metronome" accentColor={ACCENT}>
      {/* BPM Display */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.tempoName, { color: ACCENT }]}>{tempoName}</Text>
        <View style={styles.bpmRow}>
          <TouchableOpacity onPress={() => adjustBpm(-5)} style={[styles.adjustBtn, { backgroundColor: colors.glass }]}>
            <Ionicons name="remove" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => adjustBpm(-1)} style={[styles.adjustBtnSm, { backgroundColor: colors.glass }]}>
            <Ionicons name="remove" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.bpmCenter}>
            <Text style={[styles.bpmValue, { color: colors.text }]}>{bpm}</Text>
            <Text style={[styles.bpmLabel, { color: colors.textMuted }]}>BPM</Text>
          </View>
          <TouchableOpacity onPress={() => adjustBpm(1)} style={[styles.adjustBtnSm, { backgroundColor: colors.glass }]}>
            <Ionicons name="add" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => adjustBpm(5)} style={[styles.adjustBtn, { backgroundColor: colors.glass }]}>
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Beat visualization */}
        <View style={styles.beatRow}>
          {Array.from({ length: beats }, (_, i) => {
            const active = currentBeat === i + 1;
            const isFirst = i === 0;
            return (
              <View
                key={i}
                style={[
                  styles.beatDot,
                  {
                    backgroundColor: active
                      ? (isFirst ? ACCENT : colors.text)
                      : colors.glass,
                    width: active ? 28 : 22,
                    height: active ? 28 : 22,
                    borderRadius: active ? 14 : 11,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Play/Stop */}
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: playing ? '#EF4444' : ACCENT }]}
          onPress={playing ? stop : start}
        >
          <Ionicons name={playing ? 'stop' : 'play'} size={28} color="#fff" />
          <Text style={styles.playBtnText}>{playing ? 'Stop' : 'Start'}</Text>
        </TouchableOpacity>
      </View>

      {/* Time Signature */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Time Signature</Text>
        <View style={styles.sigRow}>
          {TIME_SIGS.map((sig, i) => (
            <TouchableOpacity
              key={sig.label}
              style={[styles.sigChip, { backgroundColor: timeSig === i ? ACCENT + '22' : colors.glass, borderColor: timeSig === i ? ACCENT : colors.border }]}
              onPress={() => setTimeSig(i)}
            >
              <Text style={[styles.sigText, { color: timeSig === i ? ACCENT : colors.textMuted }]}>{sig.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* BPM Presets */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick Tempo</Text>
        <View style={styles.presetRow}>
          {BPM_PRESETS.map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.presetChip, { backgroundColor: bpm === b ? ACCENT + '22' : colors.glass, borderColor: bpm === b ? ACCENT : colors.border }]}
              onPress={() => setBpm(b)}
            >
              <Text style={[styles.presetNum, { color: bpm === b ? ACCENT : colors.text }]}>{b}</Text>
              <Text style={[styles.presetName, { color: colors.textMuted }]}>{getTempoName(b)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tap Tempo */}
      <TouchableOpacity
        style={[styles.tapBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handleTapTempo}
        activeOpacity={0.6}
      >
        <Ionicons name="hand-left-outline" size={24} color={ACCENT} />
        <Text style={[styles.tapText, { color: colors.text }]}>Tap Tempo</Text>
        <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap rhythmically to set BPM</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    tempoName: { fontSize: 14, fontFamily: Fonts.semibold, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2, marginBottom: Spacing.sm },
    bpmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
    bpmCenter: { alignItems: 'center', minWidth: 100 },
    bpmValue: { fontSize: 56, fontFamily: Fonts.bold },
    bpmLabel: { fontSize: 12, fontFamily: Fonts.medium, marginTop: -4 },
    adjustBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    adjustBtnSm: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    beatRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
    beatDot: {},
    playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: Radii.xl },
    playBtnText: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
    sigRow: { flexDirection: 'row', gap: Spacing.sm },
    sigChip: { flex: 1, paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1, alignItems: 'center' },
    sigText: { fontSize: 16, fontFamily: Fonts.bold },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    presetChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', minWidth: 60 },
    presetNum: { fontSize: 16, fontFamily: Fonts.bold },
    presetName: { fontSize: 8, fontFamily: Fonts.regular, marginTop: 2 },
    tapBtn: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
    tapText: { fontSize: 16, fontFamily: Fonts.bold },
    tapHint: { fontSize: 12, fontFamily: Fonts.regular },
  });
