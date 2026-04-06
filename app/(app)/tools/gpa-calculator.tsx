import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#2563EB';

type GradeScale = { name: string; grades: { letter: string; points: number }[] };

const SCALES: GradeScale[] = [
  {
    name: '4.0 Scale',
    grades: [
      { letter: 'A+', points: 4.0 }, { letter: 'A', points: 4.0 }, { letter: 'A-', points: 3.7 },
      { letter: 'B+', points: 3.3 }, { letter: 'B', points: 3.0 }, { letter: 'B-', points: 2.7 },
      { letter: 'C+', points: 2.3 }, { letter: 'C', points: 2.0 }, { letter: 'C-', points: 1.7 },
      { letter: 'D+', points: 1.3 }, { letter: 'D', points: 1.0 }, { letter: 'F', points: 0.0 },
    ],
  },
  {
    name: '10.0 Scale',
    grades: [
      { letter: 'O', points: 10 }, { letter: 'A+', points: 9 }, { letter: 'A', points: 8 },
      { letter: 'B+', points: 7 }, { letter: 'B', points: 6 }, { letter: 'C', points: 5 },
      { letter: 'P', points: 4 }, { letter: 'F', points: 0 },
    ],
  },
];

type Course = { id: string; name: string; credits: string; gradeIdx: number };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function GPACalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [scaleIdx, setScaleIdx] = useState(0);
  const [courses, setCourses] = useState<Course[]>([
    { id: uid(), name: '', credits: '3', gradeIdx: 0 },
    { id: uid(), name: '', credits: '3', gradeIdx: 0 },
    { id: uid(), name: '', credits: '3', gradeIdx: 0 },
  ]);

  const scale = SCALES[scaleIdx];

  const updateCourse = useCallback((id: string, field: keyof Course, value: string | number) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  const addCourse = () => {
    setCourses(prev => [...prev, { id: uid(), name: '', credits: '3', gradeIdx: 0 }]);
  };

  const removeCourse = (id: string) => {
    if (courses.length <= 1) return;
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const gpa = useMemo(() => {
    let totalPoints = 0;
    let totalCredits = 0;
    for (const c of courses) {
      const cr = parseFloat(c.credits) || 0;
      if (cr <= 0) continue;
      totalCredits += cr;
      totalPoints += cr * scale.grades[c.gradeIdx].points;
    }
    if (totalCredits === 0) return null;
    return { gpa: totalPoints / totalCredits, totalCredits, totalPoints };
  }, [courses, scale]);

  const maxGPA = scale.grades[0].points;
  const gpaPercent = gpa ? (gpa.gpa / maxGPA) * 100 : 0;

  const getGPAColor = (val: number) => {
    const ratio = val / maxGPA;
    if (ratio >= 0.85) return '#10B981';
    if (ratio >= 0.7) return '#3B82F6';
    if (ratio >= 0.5) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <ScreenShell title="GPA Calculator" accentColor={ACCENT}>
      {/* Scale selector */}
      <View style={styles.scaleRow}>
        {SCALES.map((s, i) => (
          <TouchableOpacity
            key={s.name}
            style={[styles.scaleBtn, scaleIdx === i && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setScaleIdx(i); setCourses(prev => prev.map(c => ({ ...c, gradeIdx: 0 }))); }}
          >
            <Text style={[styles.scaleBtnText, { color: scaleIdx === i ? '#fff' : colors.textMuted }]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Result Card */}
      {gpa && (
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.resultGPA, { color: getGPAColor(gpa.gpa) }]}>{gpa.gpa.toFixed(2)}</Text>
          <Text style={[styles.resultLabel, { color: colors.textMuted }]}>out of {maxGPA.toFixed(1)}</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${gpaPercent}%`, backgroundColor: getGPAColor(gpa.gpa) }]} />
          </View>
          <Text style={[styles.resultCredits, { color: colors.textMuted }]}>
            {gpa.totalCredits} credits | {gpa.totalPoints.toFixed(1)} quality points
          </Text>
        </View>
      )}

      {/* Courses */}
      {courses.map((course, idx) => (
        <View key={course.id} style={[styles.courseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.courseHeader}>
            <Text style={[styles.courseNum, { color: ACCENT }]}>#{idx + 1}</Text>
            {courses.length > 1 && (
              <TouchableOpacity onPress={() => removeCourse(course.id)}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.nameInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={course.name}
            onChangeText={v => updateCourse(course.id, 'name', v)}
            placeholder="Course name (optional)"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.courseRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Credits</Text>
              <TextInput
                style={[styles.creditsInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={course.credits}
                onChangeText={v => updateCourse(course.id, 'credits', v)}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Grade</Text>
              <View style={styles.gradeRow}>
                {scale.grades.map((g, gi) => (
                  <TouchableOpacity
                    key={g.letter}
                    style={[styles.gradeBtn, course.gradeIdx === gi && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                    onPress={() => updateCourse(course.id, 'gradeIdx', gi)}
                  >
                    <Text style={[styles.gradeBtnText, { color: course.gradeIdx === gi ? '#fff' : colors.text }]}>
                      {g.letter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={addCourse}>
        <Ionicons name="add" size={20} color={ACCENT} />
        <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Course</Text>
      </TouchableOpacity>

      {/* Grade reference */}
      <View style={[styles.refCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.refTitle}>Grade Reference</Text>
        <View style={styles.refGrid}>
          {scale.grades.map(g => (
            <View key={g.letter} style={styles.refItem}>
              <Text style={[styles.refLetter, { color: colors.text }]}>{g.letter}</Text>
              <Text style={[styles.refPoints, { color: colors.textMuted }]}>{g.points.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    scaleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    scaleBtn: { flex: 1, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
    scaleBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
    resultGPA: { fontSize: 48, fontFamily: Fonts.bold },
    resultLabel: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: Spacing.md },
    progressTrack: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm },
    progressFill: { height: '100%', borderRadius: 4 },
    resultCredits: { fontSize: 12, fontFamily: Fonts.regular, marginTop: Spacing.sm },
    courseCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
    courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    courseNum: { fontSize: 13, fontFamily: Fonts.bold },
    nameInput: { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.sm, fontSize: 14, fontFamily: Fonts.regular, marginBottom: Spacing.sm },
    courseRow: { flexDirection: 'row', gap: Spacing.md },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.medium, marginBottom: 4 },
    creditsInput: { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.sm, fontSize: 16, fontFamily: Fonts.bold, textAlign: 'center' },
    gradeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    gradeBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radii.sm, borderWidth: 1, borderColor: c.border },
    gradeBtnText: { fontSize: 11, fontFamily: Fonts.bold },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radii.lg, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: Spacing.lg },
    addBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    refCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg },
    refTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    refGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    refItem: { alignItems: 'center', width: 48 },
    refLetter: { fontSize: 14, fontFamily: Fonts.bold },
    refPoints: { fontSize: 11, fontFamily: Fonts.regular },
  });
