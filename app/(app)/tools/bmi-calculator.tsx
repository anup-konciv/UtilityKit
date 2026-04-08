import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#06B6D4';

type Unit = 'metric' | 'imperial';
type Gender = 'male' | 'female' | 'other';

type HistoryEntry = {
  id: string;
  bmi: number;
  date: string;
  label: string;
};

const CATEGORIES = [
  {
    label: 'Underweight',
    range: '< 18.5',
    min: 0,
    max: 18.5,
    color: '#3B82F6',
    darkColor: '#60A5FA',
    bg: '#EFF6FF',
    darkBg: '#0A1E3A',
    tips: [
      'Eat calorie-dense whole foods like nuts, avocado, and legumes.',
      'Aim for 3–5 small meals per day to boost caloric intake.',
      'Include strength training to build healthy muscle mass.',
    ],
  },
  {
    label: 'Normal',
    range: '18.5–24.9',
    min: 18.5,
    max: 25,
    color: '#10B981',
    darkColor: '#34D399',
    bg: '#F0FDF4',
    darkBg: '#0A2E1E',
    tips: [
      'Keep up regular physical activity — at least 150 min/week.',
      'Maintain a balanced diet with plenty of vegetables and protein.',
      'Stay hydrated and get consistent sleep for overall wellness.',
    ],
  },
  {
    label: 'Overweight',
    range: '25–29.9',
    min: 25,
    max: 30,
    color: '#F59E0B',
    darkColor: '#FBBF24',
    bg: '#FFFBEB',
    darkBg: '#2A1A00',
    tips: [
      'Add 30 minutes of brisk walking or cardio most days.',
      'Reduce processed foods, sugary drinks, and refined carbs.',
      'Consider consulting a nutritionist for a personalised plan.',
    ],
  },
  {
    label: 'Obese',
    range: '≥ 30',
    min: 30,
    max: 100,
    color: '#EF4444',
    darkColor: '#F87171',
    bg: '#FEF2F2',
    darkBg: '#2E0A0A',
    tips: [
      'Start with low-impact exercise like swimming or cycling.',
      'Track your daily food intake to identify excess calories.',
      'Speak with your doctor about a safe weight-loss programme.',
    ],
  },
];

const SCALE_SEGMENTS = [
  { color: '#3B82F6', flex: 1 },
  { color: '#10B981', flex: 1 },
  { color: '#F59E0B', flex: 1 },
  { color: '#EF4444', flex: 2 },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
}

// Mini line chart for history
function HistoryChart({
  data,
  accent,
  colors,
}: {
  data: HistoryEntry[];
  accent: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const H = 60;
  const W_GUESS = 280;
  const [width, setWidth] = useState(W_GUESS);

  if (data.length < 2) return null;

  const bmis = data.map((d) => d.bmi);
  const minB = Math.min(...bmis) - 1;
  const maxB = Math.max(...bmis) + 1;
  const range = maxB - minB || 1;

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: H - ((d.bmi - minB) / range) * H,
    bmi: d.bmi,
    label: d.label,
  }));

  const pathD = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const getCatColor = (label: string) => {
    const cat = CATEGORIES.find((c) => c.label === label);
    return cat?.color ?? accent;
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {/* SVG-like line chart using Views */}
      <View style={{ height: H + 20, position: 'relative' }}>
        {/* Connect dots with lines */}
        {pts.slice(0, -1).map((p, i) => {
          const next = pts[i + 1];
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                width: len,
                height: 2,
                backgroundColor: accent + '60',
                transformOrigin: '0 50%',
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}
        {/* Dots */}
        {pts.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.x - 5,
              top: p.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: getCatColor(p.label),
              borderWidth: 2,
              borderColor: colors.card,
            }}
          />
        ))}
        {/* Date labels at bottom */}
        {pts.map((p, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: p.x - 16,
              top: H + 4,
              fontSize: 9,
              fontFamily: Fonts.medium,
              color: colors.textMuted,
              width: 32,
              textAlign: 'center',
            }}
          >
            {formatDate(data[i].date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function BMICalculatorScreen() {
  const { colors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [unit, setUnit] = useState<Unit>('metric');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('70');
  const [heightFt, setHeightFt] = useState('5');
  const [heightIn, setHeightIn] = useState('7');
  const [weightLbs, setWeightLbs] = useState('154');

  // Optional fields
  const [waist, setWaist] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [showOptional, setShowOptional] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedToday, setSavedToday] = useState(false);

  // Animated scale indicator
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const [scaleWidth, setScaleWidth] = useState(0);

  useEffect(() => {
    loadJSON<'metric' | 'imperial'>(KEYS.defaultUnits, 'metric').then((pref) =>
      setUnit(pref)
    );
    loadJSON<HistoryEntry[]>(KEYS.bmiHistory, []).then((h) => setHistory(h));
  }, []);

  const result = useMemo(() => {
    let bmi: number;
    let heightCm: number;

    if (unit === 'metric') {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (!h || !w || h <= 0 || w <= 0) return null;
      bmi = w / Math.pow(h / 100, 2);
      heightCm = h;
    } else {
      const totalIn = (parseInt(heightFt) || 0) * 12 + (parseInt(heightIn) || 0);
      const lbs = parseFloat(weightLbs);
      if (!totalIn || !lbs) return null;
      bmi = (lbs / Math.pow(totalIn, 2)) * 703;
      heightCm = totalIn * 2.54;
    }

    bmi = Math.min(bmi, 99.9);
    const cat = CATEGORIES.find((c) => bmi >= c.min && bmi < c.max) ?? CATEGORIES[3];
    // Scale: BMI 10–40 maps to 0–100%
    const pct = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));

    // Ideal weight range (BMI 18.5–24.9)
    const idealMin = 18.5 * Math.pow(heightCm / 100, 2);
    const idealMax = 24.9 * Math.pow(heightCm / 100, 2);

    // Waist-to-height ratio
    let whr: number | null = null;
    let whrStatus: string | null = null;
    const waistVal = parseFloat(waist);
    if (waistVal > 0 && heightCm > 0) {
      whr = waistVal / heightCm;
      if (whr < 0.4) whrStatus = 'Very lean';
      else if (whr < 0.5) whrStatus = 'Healthy';
      else if (whr < 0.6) whrStatus = 'Increased risk';
      else whrStatus = 'High risk';
    }

    // Age context note
    let ageNote: string | null = null;
    const ageVal = parseInt(age);
    if (ageVal >= 65) {
      ageNote = 'For adults 65+, a slightly higher BMI (up to 27) may be protective against bone loss and frailty.';
    } else if (ageVal > 0 && ageVal < 18) {
      ageNote = 'BMI interpretation differs for children and teens — please use a paediatric BMI chart.';
    }

    // Gender context note
    let genderNote: string | null = null;
    if (gender === 'female') {
      genderNote = 'Women naturally carry more body fat than men at the same BMI, which is normal and healthy.';
    } else if (gender === 'male') {
      genderNote = 'Men tend to carry more muscle mass, so BMI may slightly overestimate body fat percentage.';
    }

    return { bmi, cat, pct, idealMin, idealMax, whr, whrStatus, ageNote, genderNote };
  }, [unit, height, weight, heightFt, heightIn, weightLbs, waist, age, gender]);

  // Animate indicator when result changes
  useEffect(() => {
    if (result && scaleWidth > 0) {
      Animated.spring(indicatorAnim, {
        toValue: (result.pct / 100) * scaleWidth,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    }
  }, [result?.pct, scaleWidth]);

  const saveReading = useCallback(() => {
    if (!result) return;
    const entry: HistoryEntry = {
      id: uid(),
      bmi: parseFloat(result.bmi.toFixed(1)),
      date: todayISO(),
      label: result.cat.label,
    };
    const updated = [entry, ...history].slice(0, 10);
    setHistory(updated);
    saveJSON(KEYS.bmiHistory, updated);
    setSavedToday(true);
  }, [result, history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveJSON(KEYS.bmiHistory, []);
    setSavedToday(false);
  }, []);

  const catColor = (cat: (typeof CATEGORIES)[0]) =>
    isDark ? cat.darkColor : cat.color;
  const catBg = (cat: (typeof CATEGORIES)[0]) =>
    isDark ? cat.darkBg : cat.bg;

  return (
    <ScreenShell title="BMI Calculator" accentColor={ACCENT}>
      {/* Unit Toggle */}
      <View
        style={[
          styles.toggle,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {(['metric', 'imperial'] as Unit[]).map((u) => (
          <TouchableOpacity
            key={u}
            style={[styles.togglePill, unit === u && { backgroundColor: ACCENT }]}
            onPress={() => setUnit(u)}
          >
            <Text
              style={[
                styles.toggleText,
                { color: unit === u ? '#fff' : colors.textMuted },
              ]}
            >
              {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lbs/in)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Inputs */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={styles.sectionLabel}>MEASUREMENTS</Text>
        {unit === 'metric' ? (
          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Height (cm)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                placeholder="170"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Weight (kg)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="70"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Height</Text>
              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={heightFt}
                    onChangeText={setHeightFt}
                    keyboardType="numeric"
                    placeholder="5 ft"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={heightIn}
                    onChangeText={setHeightIn}
                    keyboardType="numeric"
                    placeholder="7 in"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Weight (lbs)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={weightLbs}
                onChangeText={setWeightLbs}
                keyboardType="numeric"
                placeholder="154"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </>
        )}

        {/* Optional fields toggle */}
        <TouchableOpacity
          style={styles.optionalToggle}
          onPress={() => setShowOptional((v) => !v)}
        >
          <Ionicons
            name={showOptional ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textMuted}
          />
          <Text style={[styles.optionalToggleText, { color: colors.textMuted }]}>
            {showOptional ? 'Hide' : 'Add'} optional details (age, gender, waist)
          </Text>
        </TouchableOpacity>

        {showOptional && (
          <>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Age (years)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  placeholder="e.g. 35"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Waist ({unit === 'metric' ? 'cm' : 'in'})
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={waist}
                  onChangeText={setWaist}
                  keyboardType="numeric"
                  placeholder={unit === 'metric' ? '80' : '32'}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Gender selector */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Gender</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderBtn,
                      {
                        backgroundColor:
                          gender === g ? ACCENT + '20' : colors.inputBg,
                        borderColor: gender === g ? ACCENT : colors.border,
                      },
                    ]}
                    onPress={() => setGender(gender === g ? '' : g)}
                  >
                    <Ionicons
                      name={
                        g === 'male'
                          ? 'male-outline'
                          : g === 'female'
                          ? 'female-outline'
                          : 'person-outline'
                      }
                      size={14}
                      color={gender === g ? ACCENT : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.genderText,
                        { color: gender === g ? ACCENT : colors.textMuted },
                      ]}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </View>

      {/* Result */}
      {result && (
        <>
          {/* Big BMI Result Card */}
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: colors.card,
                borderColor: catColor(result.cat),
              },
            ]}
          >
            {/* Accent stripe */}
            <View
              style={[styles.resultStripe, { backgroundColor: catColor(result.cat) + '30' }]}
            />

            <View style={styles.resultTop}>
              <View style={styles.resultLeft}>
                <Text style={[styles.bmiNumber, { color: catColor(result.cat) }]}>
                  {result.bmi.toFixed(1)}
                </Text>
                <Text style={[styles.bmiUnitText, { color: colors.textMuted }]}>BMI</Text>
              </View>
              <View style={styles.resultRight}>
                <View
                  style={[
                    styles.catBadge,
                    { backgroundColor: catColor(result.cat) + '20' },
                  ]}
                >
                  <View
                    style={[styles.catDot, { backgroundColor: catColor(result.cat) }]}
                  />
                  <Text style={[styles.catBadgeText, { color: catColor(result.cat) }]}>
                    {result.cat.label}
                  </Text>
                </View>
                <Text style={[styles.idealWeightText, { color: colors.textMuted }]}>
                  Ideal weight range
                </Text>
                <Text style={[styles.idealWeightValue, { color: colors.text }]}>
                  {result.idealMin.toFixed(1)} – {result.idealMax.toFixed(1)}{' '}
                  {unit === 'metric' ? 'kg' : 'lbs'}
                </Text>
              </View>
            </View>

            {/* Gradient-style Scale Bar */}
            <View style={styles.scaleWrap}>
              <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>
                BMI Scale
              </Text>
              <View
                style={styles.scaleTrack}
                onLayout={(e) => setScaleWidth(e.nativeEvent.layout.width)}
              >
                {SCALE_SEGMENTS.map((seg, i) => (
                  <View
                    key={i}
                    style={[
                      styles.scaleSegment,
                      {
                        flex: seg.flex,
                        backgroundColor: seg.color,
                        opacity: isDark ? 0.85 : 1,
                      },
                    ]}
                  />
                ))}
                {/* Animated pointer */}
                {scaleWidth > 0 && (
                  <Animated.View
                    style={[
                      styles.scalePointerWrap,
                      { left: indicatorAnim },
                    ]}
                  >
                    <View
                      style={[
                        styles.scalePointerStem,
                        { backgroundColor: catColor(result.cat) },
                      ]}
                    />
                    <View
                      style={[
                        styles.scalePointerDiamond,
                        {
                          backgroundColor: catColor(result.cat),
                          borderColor: colors.card,
                        },
                      ]}
                    />
                  </Animated.View>
                )}
              </View>
              <View style={styles.scaleTickRow}>
                {['10', '18.5', '25', '30', '40'].map((v) => (
                  <Text
                    key={v}
                    style={[styles.scaleTick, { color: colors.textMuted }]}
                  >
                    {v}
                  </Text>
                ))}
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: savedToday ? colors.surface : ACCENT,
                  borderColor: savedToday ? colors.border : ACCENT,
                },
              ]}
              onPress={saveReading}
              disabled={savedToday}
            >
              <Ionicons
                name={savedToday ? 'checkmark-circle' : 'bookmark-outline'}
                size={16}
                color={savedToday ? colors.textMuted : '#fff'}
              />
              <Text
                style={[
                  styles.saveBtnText,
                  { color: savedToday ? colors.textMuted : '#fff' },
                ]}
              >
                {savedToday ? 'Saved today' : 'Save reading'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Waist-to-Height Ratio */}
          {result.whr !== null && (
            <View
              style={[
                styles.whrCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={styles.sectionLabel}>WAIST-TO-HEIGHT RATIO</Text>
              <View style={styles.whrRow}>
                <View style={styles.whrMain}>
                  <Text
                    style={[
                      styles.whrValue,
                      {
                        color:
                          result.whr < 0.5
                            ? isDark
                              ? '#34D399'
                              : '#10B981'
                            : isDark
                            ? '#F87171'
                            : '#EF4444',
                      },
                    ]}
                  >
                    {result.whr.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.whrStatus,
                      {
                        color:
                          result.whr < 0.5
                            ? isDark
                              ? '#34D399'
                              : '#10B981'
                            : isDark
                            ? '#FBBF24'
                            : '#F59E0B',
                      },
                    ]}
                  >
                    {result.whrStatus}
                  </Text>
                </View>
                <View style={styles.whrMeta}>
                  <Text style={[styles.whrNote, { color: colors.textMuted }]}>
                    Healthy threshold: &lt; 0.5
                  </Text>
                  <Text style={[styles.whrNote, { color: colors.textMuted }]}>
                    Strong predictor of metabolic risk
                  </Text>
                </View>
              </View>
              {/* Mini progress bar */}
              <View
                style={[styles.whrTrack, { backgroundColor: colors.border }]}
              >
                <View
                  style={[
                    styles.whrFill,
                    {
                      width: `${Math.min(100, (result.whr / 0.8) * 100)}%` as any,
                      backgroundColor: result.whr < 0.5 ? '#10B981' : '#EF4444',
                    },
                  ]}
                />
                {/* 0.5 marker */}
                <View style={[styles.whrMarker, { left: `${(0.5 / 0.8) * 100}%` as any }]} />
              </View>
            </View>
          )}

          {/* Age / Gender Context Notes */}
          {(result.ageNote || result.genderNote) && (
            <View
              style={[
                styles.noteCard,
                { backgroundColor: ACCENT + '12', borderColor: ACCENT + '30' },
              ]}
            >
              <View style={styles.noteHeader}>
                <Ionicons name="information-circle-outline" size={16} color={ACCENT} />
                <Text style={[styles.noteTitle, { color: ACCENT }]}>
                  Context for your BMI
                </Text>
              </View>
              {result.ageNote && (
                <Text style={[styles.noteText, { color: colors.textSub }]}>
                  {result.ageNote}
                </Text>
              )}
              {result.genderNote && (
                <Text style={[styles.noteText, { color: colors.textSub }]}>
                  {result.genderNote}
                </Text>
              )}
            </View>
          )}

          {/* Health Tips */}
          <View
            style={[
              styles.tipsCard,
              {
                backgroundColor: catBg(result.cat),
                borderColor: catColor(result.cat) + '40',
              },
            ]}
          >
            <View style={styles.tipsHeader}>
              <Ionicons
                name="bulb-outline"
                size={16}
                color={catColor(result.cat)}
              />
              <Text style={[styles.tipsTitle, { color: catColor(result.cat) }]}>
                Health Tips — {result.cat.label}
              </Text>
            </View>
            {result.cat.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View
                  style={[styles.tipDot, { backgroundColor: catColor(result.cat) }]}
                />
                <Text style={[styles.tipText, { color: colors.textSub }]}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Category Grid */}
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <View
                key={cat.label}
                style={[
                  styles.catBox,
                  {
                    backgroundColor: catBg(cat),
                    borderColor:
                      result.cat.label === cat.label
                        ? catColor(cat)
                        : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.catBoxLabel, { color: catColor(cat) }]}>
                  {cat.label}
                </Text>
                <Text style={[styles.catBoxRange, { color: catColor(cat) }]}>
                  {cat.range}
                </Text>
                {result.cat.label === cat.label && (
                  <Ionicons name="checkmark-circle" size={14} color={catColor(cat)} />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* BMI History */}
      {history.length > 0 && (
        <View
          style={[
            styles.historyCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.historyHeader}>
            <Text style={styles.sectionLabel}>BMI HISTORY</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Chart */}
          {history.length >= 2 && (
            <View style={{ marginBottom: Spacing.md }}>
              <HistoryChart
                data={[...history].reverse()}
                accent={ACCENT}
                colors={colors}
              />
            </View>
          )}

          {/* List */}
          {history.slice(0, 5).map((entry, i) => {
            const cat = CATEGORIES.find((c) => c.label === entry.label) ?? CATEGORIES[1];
            return (
              <View
                key={entry.id}
                style={[
                  styles.historyRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: i < Math.min(history.length, 5) - 1 ? 0.5 : 0,
                  },
                ]}
              >
                <View
                  style={[
                    styles.historyDot,
                    { backgroundColor: catColor(cat) + '25' },
                  ]}
                >
                  <Text style={[styles.historyBmi, { color: catColor(cat) }]}>
                    {entry.bmi.toFixed(1)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyLabel, { color: colors.text }]}>
                    {entry.label}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                    {formatDate(entry.date)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.historyBadge,
                    { backgroundColor: catColor(cat) + '15' },
                  ]}
                >
                  <Text
                    style={[styles.historyBadgeText, { color: catColor(cat) }]}
                  >
                    {entry.bmi.toFixed(1)}
                  </Text>
                </View>
              </View>
            );
          })}
          {history.length > 5 && (
            <Text style={[styles.moreText, { color: colors.textMuted }]}>
              +{history.length - 5} more entries
            </Text>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      borderRadius: Radii.pill,
      padding: 3,
      gap: 4,
      borderWidth: 1,
    },
    togglePill: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: Radii.pill,
      alignItems: 'center',
    },
    toggleText: { fontSize: 13, fontFamily: Fonts.medium },

    card: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      color: c.textMuted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
    },
    row: { flexDirection: 'row', gap: Spacing.sm },
    fieldHalf: { flex: 1 },
    field: { marginBottom: Spacing.sm },
    label: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      marginBottom: 5,
    },
    input: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 15,
      fontFamily: Fonts.regular,
    },
    optionalToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
    },
    optionalToggleText: { fontSize: 12, fontFamily: Fonts.medium },
    genderRow: { flexDirection: 'row', gap: Spacing.sm },
    genderBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: Radii.md,
      borderWidth: 1.5,
    },
    genderText: { fontSize: 12, fontFamily: Fonts.semibold },

    // Result card
    resultCard: {
      borderRadius: Radii.xl,
      borderWidth: 2,
      overflow: 'hidden',
    },
    resultStripe: {
      height: 6,
      width: '100%',
    },
    resultTop: {
      flexDirection: 'row',
      padding: Spacing.lg,
      gap: Spacing.lg,
      alignItems: 'center',
    },
    resultLeft: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 100,
    },
    bmiNumber: {
      fontSize: 56,
      fontFamily: Fonts.bold,
      lineHeight: 60,
    },
    bmiUnitText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      letterSpacing: 2,
    },
    resultRight: {
      flex: 1,
      gap: Spacing.xs,
    },
    catBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radii.pill,
      alignSelf: 'flex-start',
      marginBottom: Spacing.xs,
    },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catBadgeText: { fontSize: 14, fontFamily: Fonts.bold },
    idealWeightText: { fontSize: 11, fontFamily: Fonts.medium },
    idealWeightValue: { fontSize: 15, fontFamily: Fonts.semibold },

    // Scale bar
    scaleWrap: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    scaleLabel: {
      fontSize: 10,
      fontFamily: Fonts.medium,
      letterSpacing: 0.8,
      marginBottom: Spacing.sm,
    },
    scaleTrack: {
      flexDirection: 'row',
      height: 16,
      borderRadius: 8,
      overflow: 'visible',
      position: 'relative',
    },
    scaleSegment: { height: '100%' },
    scalePointerWrap: {
      position: 'absolute',
      top: -6,
      alignItems: 'center',
      width: 0,
      overflow: 'visible',
    },
    scalePointerStem: {
      width: 3,
      height: 28,
      borderRadius: 2,
    },
    scalePointerDiamond: {
      width: 10,
      height: 10,
      borderRadius: 2,
      borderWidth: 2,
      transform: [{ rotate: '45deg' }],
      marginTop: -4,
    },
    scaleTickRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    scaleTick: { fontSize: 9, fontFamily: Fonts.medium },

    // Save button
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      margin: Spacing.lg,
      marginTop: Spacing.sm,
      paddingVertical: 12,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    saveBtnText: { fontSize: 14, fontFamily: Fonts.bold },

    // Waist-to-height
    whrCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    whrRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      marginBottom: Spacing.md,
    },
    whrMain: { alignItems: 'center', minWidth: 70 },
    whrValue: { fontSize: 32, fontFamily: Fonts.bold, lineHeight: 36 },
    whrStatus: { fontSize: 11, fontFamily: Fonts.semibold, marginTop: 2 },
    whrMeta: { flex: 1, gap: 4 },
    whrNote: { fontSize: 12, fontFamily: Fonts.regular },
    whrTrack: {
      height: 8,
      borderRadius: 4,
      overflow: 'visible',
      position: 'relative',
    },
    whrFill: {
      height: '100%',
      borderRadius: 4,
      position: 'absolute',
    },
    whrMarker: {
      position: 'absolute',
      top: -2,
      width: 2,
      height: 12,
      backgroundColor: '#fff',
      borderRadius: 1,
    },

    // Context note
    noteCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.xs,
    },
    noteTitle: { fontSize: 12, fontFamily: Fonts.bold },
    noteText: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 18 },

    // Tips
    tipsCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    tipsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: Spacing.xs,
    },
    tipsTitle: { fontSize: 13, fontFamily: Fonts.bold },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    tipDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 6,
      flexShrink: 0,
    },
    tipText: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 20, flex: 1 },

    // Category grid
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    catBox: {
      flex: 1,
      minWidth: '45%',
      borderRadius: Radii.md,
      padding: Spacing.md,
      borderWidth: 2,
      gap: 2,
    },
    catBoxLabel: { fontSize: 13, fontFamily: Fonts.bold },
    catBoxRange: { fontSize: 11, fontFamily: Fonts.regular },

    // History
    historyCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    clearText: { fontSize: 12, fontFamily: Fonts.medium },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: 10,
    },
    historyDot: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyBmi: { fontSize: 14, fontFamily: Fonts.bold },
    historyLabel: { fontSize: 13, fontFamily: Fonts.semibold },
    historyDate: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    historyBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radii.pill,
    },
    historyBadgeText: { fontSize: 13, fontFamily: Fonts.bold },
    moreText: {
      fontSize: 11,
      fontFamily: Fonts.medium,
      textAlign: 'center',
      paddingTop: Spacing.sm,
    },
  });
