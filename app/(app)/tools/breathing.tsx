import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#059669';

type Technique = { name: string; desc: string; steps: { label: string; duration: number }[] };

const TECHNIQUES: Technique[] = [
  {
    name: '4-7-8 Relaxing',
    desc: 'Calming breath for sleep & anxiety',
    steps: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 7 },
      { label: 'Exhale', duration: 8 },
    ],
  },
  {
    name: 'Box Breathing',
    desc: 'Equal timing for focus & calm',
    steps: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 4 },
      { label: 'Exhale', duration: 4 },
      { label: 'Hold', duration: 4 },
    ],
  },
  {
    name: 'Deep Calm',
    desc: 'Long exhale for deep relaxation',
    steps: [
      { label: 'Inhale', duration: 4 },
      { label: 'Exhale', duration: 8 },
    ],
  },
  {
    name: 'Energize',
    desc: 'Short bursts for energy boost',
    steps: [
      { label: 'Inhale', duration: 2 },
      { label: 'Exhale', duration: 2 },
    ],
  },
];

export default function BreathingScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [techIdx, setTechIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [cycles, setCycles] = useState(0);

  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tech = TECHNIQUES[techIdx];
  const currentStep = tech.steps[stepIdx];

  const scaleRef = useRef(0.4);
  const opacityRef = useRef(0.3);

  const animateStep = useCallback((label: string, duration: number) => {
    const isInhale = label === 'Inhale';
    const isExhale = label === 'Exhale';

    const toScale = isInhale ? 1 : isExhale ? 0.4 : scaleRef.current;
    const toOpacity = isInhale ? 0.8 : isExhale ? 0.3 : opacityRef.current;
    scaleRef.current = toScale;
    opacityRef.current = toOpacity;

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: toScale,
        duration: duration * 1000,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: toOpacity,
        duration: duration * 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const start = useCallback(() => {
    setRunning(true);
    setStepIdx(0);
    setCycles(0);
    const step = tech.steps[0];
    setCountdown(step.duration);
    animateStep(step.label, step.duration);
  }, [tech, animateStep]);

  const stop = useCallback(() => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0.3);
  }, [scaleAnim, opacityAnim]);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setStepIdx(si => {
            const nextSi = (si + 1) % tech.steps.length;
            if (nextSi === 0) setCycles(c => c + 1);
            const nextStep = tech.steps[nextSi];
            animateStep(nextStep.label, nextStep.duration);
            setCountdown(nextStep.duration);
            return nextSi;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, tech, animateStep]);

  const stepColor = currentStep?.label === 'Inhale' ? '#3B82F6'
    : currentStep?.label === 'Exhale' ? '#10B981'
    : '#F59E0B';

  return (
    <ScreenShell title="Breathing" accentColor={ACCENT} scrollable={false}>
      <View style={styles.container}>
        {/* Technique selector */}
        <View style={styles.techRow}>
          {TECHNIQUES.map((t, i) => (
            <TouchableOpacity
              key={t.name}
              style={[styles.techBtn, techIdx === i && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => { if (running) stop(); setTechIdx(i); setStepIdx(0); }}
            >
              <Text style={[styles.techBtnText, { color: techIdx === i ? '#fff' : colors.textMuted }]} numberOfLines={1}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.techDesc, { color: colors.textMuted }]}>{tech.desc}</Text>

        {/* Breathing circle */}
        <View style={styles.circleWrap}>
          <Animated.View style={[styles.circleOuter, { backgroundColor: ACCENT + '15', transform: [{ scale: scaleAnim }], opacity: opacityAnim }]} />
          <Animated.View style={[styles.circleInner, { backgroundColor: ACCENT + '25', transform: [{ scale: scaleAnim }] }]} />
          <View style={styles.circleCenter}>
            {running ? (
              <>
                <Text style={[styles.stepLabel, { color: stepColor }]}>{currentStep?.label}</Text>
                <Text style={[styles.countdownText, { color: colors.text }]}>{countdown}</Text>
              </>
            ) : (
              <>
                <Ionicons name="leaf-outline" size={32} color={ACCENT} />
                <Text style={[styles.readyText, { color: colors.textMuted }]}>Ready</Text>
              </>
            )}
          </View>
        </View>

        {/* Steps indicator */}
        <View style={styles.stepsRow}>
          {tech.steps.map((s, i) => (
            <View key={i} style={styles.stepIndicator}>
              <View style={[styles.stepDot, { backgroundColor: running && stepIdx === i ? stepColor : colors.border }]} />
              <Text style={[styles.stepName, { color: running && stepIdx === i ? colors.text : colors.textMuted }]}>
                {s.label} ({s.duration}s)
              </Text>
            </View>
          ))}
        </View>

        {/* Cycles */}
        {running && (
          <Text style={[styles.cyclesText, { color: colors.textMuted }]}>Cycles: {cycles}</Text>
        )}

        {/* Start/Stop */}
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: running ? '#EF4444' : ACCENT }]}
          onPress={running ? stop : start}
        >
          <Ionicons name={running ? 'stop' : 'play'} size={24} color="#fff" />
          <Text style={styles.controlBtnText}>{running ? 'Stop' : 'Start'}</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, alignItems: 'center' },
    techRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
    techBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border },
    techBtnText: { fontSize: 11, fontFamily: Fonts.semibold },
    techDesc: { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.xl },
    circleWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
    circleOuter: { position: 'absolute', width: 240, height: 240, borderRadius: 120 },
    circleInner: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
    circleCenter: { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    stepLabel: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: 4 },
    countdownText: { fontSize: 48, fontFamily: Fonts.bold },
    readyText: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 8 },
    stepsRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.lg },
    stepIndicator: { alignItems: 'center', gap: 4 },
    stepDot: { width: 8, height: 8, borderRadius: 4 },
    stepName: { fontSize: 11, fontFamily: Fonts.medium },
    cyclesText: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: Spacing.lg },
    controlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 48, borderRadius: Radii.xl },
    controlBtnText: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
  });
