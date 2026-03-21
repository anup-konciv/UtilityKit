import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#6366F1';
const ACCENT2 = '#4F46E5';
const INTEREST_CLR = '#F59E0B';
const PRINCIPAL_CLR = '#3B82F6';

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}
function fmtDec(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

type TenureUnit = 'months' | 'years';
type ViewMode = 'summary' | 'yearly' | 'monthly';

const LOAN_PRESETS = [
  { label: 'Home', amount: '5000000', rate: '8.5', tenure: '240', icon: 'home-outline' },
  { label: 'Car', amount: '800000', rate: '9.5', tenure: '60', icon: 'car-outline' },
  { label: 'Personal', amount: '300000', rate: '14', tenure: '36', icon: 'person-outline' },
  { label: 'Education', amount: '1000000', rate: '10', tenure: '84', icon: 'school-outline' },
];

export default function EMICalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [principal, setPrincipal] = useState('500000');
  const [rate, setRate] = useState('8.5');
  const [tenure, setTenure] = useState('60');
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>('months');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [showSchedule, setShowSchedule] = useState(false);

  const tenureMonths = tenureUnit === 'years' ? parseInt(tenure) * 12 : parseInt(tenure);

  const result = useMemo(() => {
    const P = parseFloat(principal), yr = parseFloat(rate), n = tenureMonths;
    if (!P || !yr || !n || P <= 0 || yr <= 0 || n <= 0) return null;
    const r = yr / 12 / 100;
    const EMI = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = EMI * n;
    const interest = total - P;
    const principalPct = (P / total) * 100;

    const rows: { month: number; emi: number; principal: number; interest: number; balance: number; yearPrincipal: number; yearInterest: number }[] = [];
    let bal = P;
    let yearP = 0, yearI = 0;
    for (let i = 1; i <= n; i++) {
      const ic = bal * r, pc = EMI - ic;
      bal = Math.max(0, bal - pc);
      yearP += pc;
      yearI += ic;
      rows.push({ month: i, emi: EMI, principal: pc, interest: ic, balance: bal, yearPrincipal: yearP, yearInterest: yearI });
      if (i % 12 === 0) { yearP = 0; yearI = 0; }
    }

    // Yearly summary
    const yearlyRows: { year: number; principal: number; interest: number; balance: number }[] = [];
    let yBal = P, yP = 0, yI = 0;
    for (let i = 1; i <= n; i++) {
      const ic = yBal * r, pc = EMI - ic;
      yBal = Math.max(0, yBal - pc);
      yP += pc;
      yI += ic;
      if (i % 12 === 0 || i === n) {
        yearlyRows.push({ year: Math.ceil(i / 12), principal: yP, interest: yI, balance: yBal });
        yP = 0; yI = 0;
      }
    }

    // Progress milestones
    const half = rows.find(r => r.balance <= P / 2);
    const quarter = rows.find(r => r.balance <= P / 4);

    return { EMI, total, interest, principalPct, rows, yearlyRows, halfMonth: half?.month, quarterMonth: quarter?.month };
  }, [principal, rate, tenureMonths]);

  const applyPreset = (p: typeof LOAN_PRESETS[0]) => {
    setPrincipal(p.amount);
    setRate(p.rate);
    setTenure(p.tenure);
    setTenureUnit('months');
  };

  const shareResult = useCallback(async () => {
    if (!result) return;
    const text = `EMI Calculator\n\nLoan: ₹${fmt(parseFloat(principal))}\nRate: ${rate}%\nTenure: ${tenure} ${tenureUnit}\n\nMonthly EMI: ₹${fmtDec(result.EMI)}\nTotal Interest: ₹${fmt(result.interest)}\nTotal Payment: ₹${fmt(result.total)}`;
    await Share.share({ message: text });
  }, [result, principal, rate, tenure, tenureUnit]);

  // Donut chart segments via arcs
  const donutData = result ? [
    { pct: result.principalPct, color: PRINCIPAL_CLR, label: 'Principal' },
    { pct: 100 - result.principalPct, color: INTEREST_CLR, label: 'Interest' },
  ] : [];

  return (
    <ScreenShell title="EMI Calculator" accentColor={ACCENT}>
      {/* Loan Presets */}
      <View style={styles.presetsRow}>
        {LOAN_PRESETS.map(p => (
          <TouchableOpacity
            key={p.label}
            style={[styles.presetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => applyPreset(p)}
          >
            <Ionicons name={p.icon as any} size={16} color={ACCENT} />
            <Text style={[styles.presetLabel, { color: colors.text }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input Card */}
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Loan Amount */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Ionicons name="wallet-outline" size={16} color={ACCENT} />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Loan Amount</Text>
          </View>
          <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.currencyPrefix, { color: ACCENT }]}>₹</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={principal}
              onChangeText={setPrincipal}
              keyboardType="numeric"
              placeholder="500000"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.quickAmounts}>
            {['1L', '5L', '10L', '25L', '50L', '1Cr'].map(label => {
              const val = { '1L': '100000', '5L': '500000', '10L': '1000000', '25L': '2500000', '50L': '5000000', '1Cr': '10000000' }[label]!;
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.quickBtn, principal === val && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
                  onPress={() => setPrincipal(val)}
                >
                  <Text style={[styles.quickBtnText, { color: principal === val ? ACCENT : colors.textMuted }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Rate & Tenure row */}
        <View style={styles.rowFields}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <View style={styles.fieldHeader}>
              <Ionicons name="trending-up-outline" size={16} color={ACCENT} />
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Rate (%)</Text>
            </View>
            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
                placeholder="8.5"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>%</Text>
            </View>
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <View style={styles.fieldHeader}>
              <Ionicons name="time-outline" size={16} color={ACCENT} />
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Tenure</Text>
            </View>
            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, flex: 1 }]}
                value={tenure}
                onChangeText={setTenure}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.unitToggle}>
                {(['months', 'years'] as const).map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, tenureUnit === u && { backgroundColor: ACCENT }]}
                    onPress={() => {
                      if (u !== tenureUnit) {
                        const val = parseInt(tenure) || 0;
                        setTenure(String(u === 'years' ? Math.round(val / 12) || 1 : val * 12));
                        setTenureUnit(u);
                      }
                    }}
                  >
                    <Text style={[styles.unitBtnText, { color: tenureUnit === u ? '#fff' : colors.textMuted }]}>
                      {u === 'months' ? 'M' : 'Y'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Result */}
      {result && (
        <>
          {/* EMI Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroEmiSection}>
                <Text style={styles.heroSubLabel}>Monthly EMI</Text>
                <Text style={styles.heroEmiValue}>₹{fmtDec(result.EMI)}</Text>
                <Text style={styles.heroTenureInfo}>
                  for {tenureUnit === 'years' ? `${tenure} years` : `${tenure} months`}
                  {tenureUnit === 'months' && parseInt(tenure) >= 12 ? ` (${(parseInt(tenure) / 12).toFixed(1)} yrs)` : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={shareResult}>
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Donut visual */}
            <View style={styles.donutRow}>
              <View style={styles.donutContainer}>
                <View style={styles.donutOuter}>
                  <View style={[styles.donutSegment, { backgroundColor: INTEREST_CLR }]} />
                  <View style={[styles.donutOverlay, { backgroundColor: PRINCIPAL_CLR, width: `${result.principalPct}%` }]} />
                </View>
                <View style={[styles.donutCenter, { backgroundColor: ACCENT2 }]}>
                  <Text style={styles.donutCenterPct}>{result.principalPct.toFixed(0)}%</Text>
                  <Text style={styles.donutCenterLabel}>Principal</Text>
                </View>
              </View>

              <View style={styles.donutLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: PRINCIPAL_CLR }]} />
                  <View>
                    <Text style={styles.legendLabel}>Principal</Text>
                    <Text style={styles.legendVal}>₹{fmt(parseFloat(principal))}</Text>
                  </View>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: INTEREST_CLR }]} />
                  <View>
                    <Text style={styles.legendLabel}>Interest</Text>
                    <Text style={styles.legendVal}>₹{fmt(result.interest)}</Text>
                  </View>
                </View>
                <View style={[styles.legendDivider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#fff' }]} />
                  <View>
                    <Text style={styles.legendLabel}>Total</Text>
                    <Text style={[styles.legendVal, { fontSize: 16 }]}>₹{fmt(result.total)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Insights */}
          <View style={styles.insightRow}>
            <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="calculator-outline" size={18} color={ACCENT} />
              <Text style={[styles.insightValue, { color: colors.text }]}>{(result.interest / parseFloat(principal) * 100).toFixed(1)}%</Text>
              <Text style={[styles.insightLabel, { color: colors.textMuted }]}>Interest ratio</Text>
            </View>
            <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="flag-outline" size={18} color={PRINCIPAL_CLR} />
              <Text style={[styles.insightValue, { color: colors.text }]}>
                {result.halfMonth ? `${result.halfMonth} mo` : '—'}
              </Text>
              <Text style={[styles.insightLabel, { color: colors.textMuted }]}>50% paid off</Text>
            </View>
            <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="cash-outline" size={18} color={INTEREST_CLR} />
              <Text style={[styles.insightValue, { color: colors.text }]}>₹{fmt(result.rows[0]?.interest ?? 0)}</Text>
              <Text style={[styles.insightLabel, { color: colors.textMuted }]}>1st mo interest</Text>
            </View>
          </View>

          {/* Principal vs Interest bar */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Payment Breakdown</Text>
            <View style={styles.breakdownBar}>
              <View style={[styles.barSegment, { flex: result.principalPct, backgroundColor: PRINCIPAL_CLR, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
              <View style={[styles.barSegment, { flex: 100 - result.principalPct, backgroundColor: INTEREST_CLR, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
            </View>
            <View style={styles.breakdownLabels}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: PRINCIPAL_CLR }]} />
                <Text style={[styles.breakdownText, { color: colors.text }]}>Principal</Text>
                <Text style={[styles.breakdownPct, { color: PRINCIPAL_CLR }]}>{result.principalPct.toFixed(1)}%</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownDot, { backgroundColor: INTEREST_CLR }]} />
                <Text style={[styles.breakdownText, { color: colors.text }]}>Interest</Text>
                <Text style={[styles.breakdownPct, { color: INTEREST_CLR }]}>{(100 - result.principalPct).toFixed(1)}%</Text>
              </View>
            </View>
          </View>

          {/* Amortization Schedule */}
          <TouchableOpacity
            style={[styles.scheduleToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowSchedule(!showSchedule)}
          >
            <Ionicons name="document-text-outline" size={18} color={ACCENT} />
            <Text style={[styles.scheduleToggleText, { color: colors.text }]}>Amortization Schedule</Text>
            <Ionicons name={showSchedule ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {showSchedule && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* View mode toggle */}
              <View style={[styles.viewToggle, { borderColor: colors.border }]}>
                {([
                  { k: 'summary' as const, lb: 'Summary' },
                  { k: 'yearly' as const, lb: 'Yearly' },
                  { k: 'monthly' as const, lb: 'Monthly' },
                ]).map(v => (
                  <TouchableOpacity
                    key={v.k}
                    style={[styles.viewBtn, viewMode === v.k && { backgroundColor: ACCENT }]}
                    onPress={() => setViewMode(v.k)}
                  >
                    <Text style={[styles.viewBtnText, { color: viewMode === v.k ? '#fff' : colors.textMuted }]}>{v.lb}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {viewMode === 'summary' && (
                <View>
                  {/* Yearly progress bars */}
                  {result.yearlyRows.map((yr, i) => {
                    const yrTotal = yr.principal + yr.interest;
                    const pPct = yrTotal > 0 ? (yr.principal / yrTotal) * 100 : 0;
                    return (
                      <View key={yr.year} style={[styles.yearRow, i < result.yearlyRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        <Text style={[styles.yearLabel, { color: colors.textMuted }]}>Yr {yr.year}</Text>
                        <View style={styles.yearBarWrap}>
                          <View style={styles.yearBar}>
                            <View style={[styles.yearBarFill, { flex: pPct, backgroundColor: PRINCIPAL_CLR }]} />
                            <View style={[styles.yearBarFill, { flex: 100 - pPct, backgroundColor: INTEREST_CLR }]} />
                          </View>
                        </View>
                        <Text style={[styles.yearBalance, { color: colors.text }]}>₹{fmt(yr.balance)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {viewMode === 'yearly' && (
                <View>
                  <View style={[styles.tableHead, { backgroundColor: colors.bg }]}>
                    {['Year', 'Principal', 'Interest', 'Balance'].map(h => (
                      <Text key={h} style={[styles.th, { color: colors.textMuted }]}>{h}</Text>
                    ))}
                  </View>
                  {result.yearlyRows.map(yr => (
                    <View key={yr.year} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.td, { color: colors.textMuted }]}>{yr.year}</Text>
                      <Text style={[styles.td, { color: PRINCIPAL_CLR }]}>₹{fmt(yr.principal)}</Text>
                      <Text style={[styles.td, { color: INTEREST_CLR }]}>₹{fmt(yr.interest)}</Text>
                      <Text style={[styles.td, { color: colors.text }]}>₹{fmt(yr.balance)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {viewMode === 'monthly' && (
                <View>
                  <View style={[styles.tableHead, { backgroundColor: colors.bg }]}>
                    {['#', 'Principal', 'Interest', 'Balance'].map(h => (
                      <Text key={h} style={[styles.th, { color: colors.textMuted }]}>{h}</Text>
                    ))}
                  </View>
                  <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                    {result.rows.map(r => (
                      <View key={r.month} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.td, { color: colors.textMuted }]}>{r.month}</Text>
                        <Text style={[styles.td, { color: PRINCIPAL_CLR }]}>₹{fmt(r.principal)}</Text>
                        <Text style={[styles.td, { color: INTEREST_CLR }]}>₹{fmt(r.interest)}</Text>
                        <Text style={[styles.td, { color: colors.text }]}>₹{fmt(r.balance)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Presets
    presetsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    presetChip: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: Radii.lg, borderWidth: 1 },
    presetLabel: { fontSize: 11, fontFamily: Fonts.semibold },

    // Input card
    inputCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    fieldGroup: { marginBottom: Spacing.md },
    fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    fieldLabel: { fontSize: 12, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
    inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, height: 48 },
    currencyPrefix: { fontSize: 18, fontFamily: Fonts.bold, marginRight: 4 },
    input: { flex: 1, fontSize: 16, fontFamily: Fonts.semibold, paddingVertical: 0 },
    inputSuffix: { fontSize: 14, fontFamily: Fonts.semibold, marginLeft: 4 },
    quickAmounts: { flexDirection: 'row', gap: 6, marginTop: Spacing.sm },
    quickBtn: { flex: 1, paddingVertical: 5, borderRadius: Radii.md, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    quickBtnText: { fontSize: 11, fontFamily: Fonts.semibold },
    rowFields: { flexDirection: 'row', gap: Spacing.md },
    unitToggle: { flexDirection: 'row', backgroundColor: c.border, borderRadius: Radii.sm, padding: 2, marginLeft: 4 },
    unitBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.sm },
    unitBtnText: { fontSize: 11, fontFamily: Fonts.bold },

    // Hero card
    heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg, backgroundColor: ACCENT2, overflow: 'hidden' },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
    heroEmiSection: {},
    heroSubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: Fonts.medium, marginBottom: 2 },
    heroEmiValue: { fontSize: 34, fontFamily: Fonts.bold, color: '#fff', letterSpacing: -0.5 },
    heroTenureInfo: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.regular, marginTop: 4 },
    shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

    // Donut
    donutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    donutContainer: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
    donutOuter: { width: 90, height: 90, borderRadius: 45, overflow: 'hidden', flexDirection: 'row' },
    donutSegment: { flex: 1, height: '100%' },
    donutOverlay: { height: '100%', position: 'absolute', left: 0, top: 0 },
    donutCenter: { position: 'absolute', width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
    donutCenterPct: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
    donutCenterLabel: { fontSize: 8, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.7)' },
    donutLegend: { flex: 1, gap: Spacing.sm },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 11, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.65)' },
    legendVal: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    legendDivider: { height: 1, marginVertical: 2 },

    // Insights
    insightRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    insightCard: { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, gap: 4 },
    insightValue: { fontSize: 14, fontFamily: Fonts.bold },
    insightLabel: { fontSize: 9, fontFamily: Fonts.medium, textAlign: 'center' },

    // Breakdown bar
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
    breakdownBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: Spacing.md },
    barSegment: { height: '100%' },
    breakdownLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    breakdownDot: { width: 8, height: 8, borderRadius: 4 },
    breakdownText: { fontSize: 13, fontFamily: Fonts.medium },
    breakdownPct: { fontSize: 13, fontFamily: Fonts.bold },

    // Schedule toggle
    scheduleToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.lg },
    scheduleToggleText: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold },

    // View toggle
    viewToggle: { flexDirection: 'row', borderRadius: Radii.md, borderWidth: 1, padding: 2, gap: 2, marginBottom: Spacing.lg },
    viewBtn: { flex: 1, paddingVertical: 7, borderRadius: Radii.sm, alignItems: 'center' },
    viewBtnText: { fontSize: 12, fontFamily: Fonts.semibold },

    // Year summary
    yearRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: Spacing.sm },
    yearLabel: { width: 36, fontSize: 11, fontFamily: Fonts.bold },
    yearBarWrap: { flex: 1 },
    yearBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
    yearBarFill: { height: '100%' },
    yearBalance: { width: 72, fontSize: 11, fontFamily: Fonts.semibold, textAlign: 'right' },

    // Table
    tableHead: { flexDirection: 'row', padding: Spacing.sm, borderRadius: Radii.sm, marginBottom: 4 },
    th: { flex: 1, fontSize: 10, fontFamily: Fonts.bold, textAlign: 'right' },
    tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: Spacing.sm, borderBottomWidth: 1 },
    td: { flex: 1, fontSize: 11, fontFamily: Fonts.regular, textAlign: 'right' },
  });
