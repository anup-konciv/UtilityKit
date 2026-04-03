import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = '#10B981';

// ── Types ─────────────────────────────────────────────────────────────────────
type TabId = 'sip' | 'lumpsum' | 'mix' | 'returns' | 'compare';
type CompFreq = 'annually' | 'semi-annually' | 'quarterly' | 'monthly';
type Colors = ReturnType<typeof useAppTheme>['colors'];
type CalcResult = { invested: number; returns: number; maturity: number };

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtPct(n: number, digits = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}
const toNum = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;

// ── Calculations ──────────────────────────────────────────────────────────────
const FREQ: Record<CompFreq, number> = {
  annually: 1, 'semi-annually': 2, quarterly: 4, monthly: 12,
};

function sipResult(monthly: number, rate: number, years: number): CalcResult | null {
  if (monthly <= 0 || years <= 0) return null;
  const r = rate / 12 / 100;
  const n = years * 12;
  const maturity = r === 0
    ? monthly * n
    : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const invested = monthly * n;
  return { invested, returns: maturity - invested, maturity };
}

function stepUpSIPResult(monthly: number, rate: number, years: number, stepUp: number): CalcResult | null {
  if (monthly <= 0 || years <= 0) return null;
  const r = rate / 12 / 100;
  let maturity = 0, invested = 0;
  for (let y = 0; y < years; y++) {
    const sip = monthly * Math.pow(1 + stepUp / 100, y);
    for (let m = 0; m < 12; m++) {
      const periods = (years - y) * 12 - m;
      maturity += sip * Math.pow(1 + r, periods);
      invested += sip;
    }
  }
  return { invested, returns: maturity - invested, maturity };
}

function lumpsumResult(amount: number, rate: number, years: number, freq: CompFreq): CalcResult | null {
  if (amount <= 0 || years <= 0) return null;
  const n = FREQ[freq];
  const r = rate / 100 / n;
  const maturity = amount * Math.pow(1 + r, n * years);
  return { invested: amount, returns: maturity - amount, maturity };
}

function mixResult(monthly: number, lump: number, rate: number, years: number): CalcResult | null {
  const s = monthly > 0 ? sipResult(monthly, rate, years) : null;
  const l = lump > 0    ? lumpsumResult(lump, rate, years, 'annually') : null;
  if (!s && !l) return null;
  const invested = (s?.invested ?? 0) + (l?.invested ?? 0);
  const maturity  = (s?.maturity  ?? 0) + (l?.maturity  ?? 0);
  return { invested, returns: maturity - invested, maturity };
}

function returnsAnalysis(invested: number, current: number, years: number) {
  if (invested <= 0 || current <= 0) return null;
  const gain     = current - invested;
  const absRet   = (gain / invested) * 100;
  const multiple = current / invested;
  const cagr     = years > 0 ? (Math.pow(current / invested, 1 / years) - 1) * 100 : null;
  return { gain, absRet, multiple, cagr };
}

function goalSIP(target: number, rate: number, years: number): number {
  const r = rate / 12 / 100;
  const n = years * 12;
  if (r === 0) return target / n;
  return target / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

function goalLumpsum(target: number, rate: number, years: number): number {
  if (rate === 0) return target;
  return target / Math.pow(1 + rate / 100, years);
}

// ── Shared UI pieces ──────────────────────────────────────────────────────────
function Field({
  label, value, onChange, prefix, suffix, hint, colors,
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; hint?: string; colors: Colors;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[fi.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={[fi.row, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        {prefix ? <Text style={[fi.affix, { color: colors.textMuted }]}>{prefix}</Text> : null}
        <TextInput
          style={[fi.input, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />
        {suffix ? <Text style={[fi.affix, { color: colors.textMuted }]}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={[fi.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const fi = StyleSheet.create({
  label: { fontFamily: Fonts.medium, fontSize: 13, marginBottom: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 48 },
  input: { flex: 1, fontFamily: Fonts.semibold, fontSize: 16 },
  affix: { fontFamily: Fonts.medium, fontSize: 14 },
  hint:  { fontFamily: Fonts.regular, fontSize: 11, marginTop: 3 },
});

function PillGroup({
  options, value, onChange, colors,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: Colors;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: Spacing.md, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[pg.pill, { borderColor: colors.border },
            value === o.value && { backgroundColor: ACCENT, borderColor: ACCENT }]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[pg.pillText, { color: value === o.value ? '#fff' : colors.textMuted }]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const pg = StyleSheet.create({
  pill:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1.5 },
  pillText: { fontFamily: Fonts.medium, fontSize: 12 },
});

function CalcBtn({ onPress, colors }: { onPress: () => void; colors: Colors }) {
  return (
    <TouchableOpacity
      style={[cb.btn, { backgroundColor: ACCENT }]}
      onPress={onPress}
    >
      <Text style={cb.text}>Calculate</Text>
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  btn:  { height: 48, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  text: { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
});

function ResultCards({ result, colors }: { result: CalcResult; colors: Colors }) {
  const positive = result.returns >= 0;
  const investedPct = Math.min((result.invested / result.maturity) * 100, 100);
  const wealthRatio = ((result.returns / result.invested) * 100).toFixed(1);

  return (
    <View style={[rc.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Three metric tiles */}
      <View style={rc.row}>
        <View style={[rc.tile, { backgroundColor: colors.bg }]}>
          <Text style={[rc.tileLabel, { color: colors.textMuted }]}>Invested</Text>
          <Text style={[rc.tileValue, { color: colors.text }]}>{fmtINR(result.invested)}</Text>
        </View>
        <View style={[rc.tile, { backgroundColor: positive ? '#F0FDF4' : '#FEF2F2' }]}>
          <Text style={[rc.tileLabel, { color: colors.textMuted }]}>Returns</Text>
          <Text style={[rc.tileValue, { color: positive ? '#10B981' : '#EF4444' }]}>
            {fmtINR(Math.abs(result.returns))}
          </Text>
        </View>
        <View style={[rc.tile, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[rc.tileLabel, { color: colors.textMuted }]}>Maturity</Text>
          <Text style={[rc.tileValue, { color: '#3B82F6' }]}>{fmtINR(result.maturity)}</Text>
        </View>
      </View>

      {/* Breakdown bar */}
      <View style={rc.barWrap}>
        <View style={[rc.bar, { backgroundColor: colors.border }]}>
          <View style={[rc.barFill, { width: `${investedPct}%` as any }]} />
          <View style={[rc.barReturns, { width: `${100 - investedPct}%` as any, backgroundColor: positive ? '#10B981' : '#EF4444' }]} />
        </View>
        <View style={rc.legend}>
          <View style={rc.legendItem}>
            <View style={[rc.dot, { backgroundColor: ACCENT }]} />
            <Text style={[rc.legendText, { color: colors.textMuted }]}>
              Invested ({investedPct.toFixed(1)}%)
            </Text>
          </View>
          <View style={rc.legendItem}>
            <View style={[rc.dot, { backgroundColor: positive ? '#10B981' : '#EF4444' }]} />
            <Text style={[rc.legendText, { color: colors.textMuted }]}>
              Returns ({(100 - investedPct).toFixed(1)}%)
            </Text>
          </View>
        </View>
      </View>

      {/* Wealth gain insight */}
      <View style={[rc.insight, { backgroundColor: positive ? '#F0FDF4' : '#FEF2F2', borderColor: positive ? '#BBF7D0' : '#FECACA' }]}>
        <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={16} color={positive ? '#10B981' : '#EF4444'} />
        <Text style={[rc.insightText, { color: positive ? '#065F46' : '#991B1B' }]}>
          {positive
            ? `Wealth gain of ${wealthRatio}% — your money grows ${(result.maturity / result.invested).toFixed(2)}× on investment`
            : `Loss of ${Math.abs(parseFloat(wealthRatio)).toFixed(1)}% on your investment`}
        </Text>
      </View>
    </View>
  );
}

const rc = StyleSheet.create({
  wrap:        { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.lg },
  row:         { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  tile:        { flex: 1, borderRadius: Radii.lg, padding: Spacing.sm, alignItems: 'center', gap: 3 },
  tileLabel:   { fontFamily: Fonts.regular, fontSize: 11, textAlign: 'center' },
  tileValue:   { fontFamily: Fonts.bold, fontSize: 13, textAlign: 'center' },
  barWrap:     { marginBottom: Spacing.md },
  bar:         { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  barFill:     { backgroundColor: ACCENT, height: '100%' },
  barReturns:  { height: '100%' },
  legend:      { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontFamily: Fonts.regular, fontSize: 11 },
  insight:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.sm, borderRadius: Radii.md, borderWidth: 1 },
  insightText: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 18 },
});

// ── SIP Tab ───────────────────────────────────────────────────────────────────
function SIPTab({ colors }: { colors: Colors }) {
  const [mode, setMode]       = useState<'regular' | 'stepup'>('regular');
  const [monthly, setMonthly] = useState('5000');
  const [rate, setRate]       = useState('12');
  const [years, setYears]     = useState('10');
  const [stepUp, setStepUp]   = useState('10');
  const [result, setResult]   = useState<CalcResult | null>(null);

  const calculate = () => {
    const r = mode === 'regular'
      ? sipResult(toNum(monthly), toNum(rate), toNum(years))
      : stepUpSIPResult(toNum(monthly), toNum(rate), toNum(years), toNum(stepUp));
    setResult(r);
  };

  return (
    <ScrollView contentContainerStyle={ts.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <PillGroup
        options={[{ label: 'Regular SIP', value: 'regular' }, { label: 'Step-up SIP', value: 'stepup' }]}
        value={mode} onChange={(v) => { setMode(v as any); setResult(null); }} colors={colors}
      />
      <Field label="Monthly Investment" value={monthly} onChange={setMonthly} prefix="₹" colors={colors} hint="Amount invested every month" />
      <Field label="Expected Annual Return" value={rate} onChange={setRate} suffix="%" colors={colors} hint="Historical equity avg: 12–15%" />
      <Field label="Investment Duration" value={years} onChange={setYears} suffix="yrs" colors={colors} />
      {mode === 'stepup' && (
        <Field label="Annual Step-up" value={stepUp} onChange={setStepUp} suffix="%" colors={colors} hint="Increase SIP by this % each year" />
      )}
      <CalcBtn onPress={calculate} colors={colors} />
      {result && <ResultCards result={result} colors={colors} />}
    </ScrollView>
  );
}

// ── Lumpsum Tab ───────────────────────────────────────────────────────────────
function LumpsumTab({ colors }: { colors: Colors }) {
  const [amount, setAmount]   = useState('100000');
  const [rate, setRate]       = useState('12');
  const [years, setYears]     = useState('10');
  const [freq, setFreq]       = useState<CompFreq>('annually');
  const [result, setResult]   = useState<CalcResult | null>(null);

  const calculate = () => setResult(lumpsumResult(toNum(amount), toNum(rate), toNum(years), freq));

  const freqOptions = [
    { label: 'Annual', value: 'annually' },
    { label: 'Semi-annual', value: 'semi-annually' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  return (
    <ScrollView contentContainerStyle={ts.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Field label="Investment Amount" value={amount} onChange={setAmount} prefix="₹" colors={colors} />
      <Field label="Expected Annual Return" value={rate} onChange={setRate} suffix="%" colors={colors} />
      <Field label="Investment Duration" value={years} onChange={setYears} suffix="yrs" colors={colors} />
      <Text style={[fi.label, { color: colors.textMuted, marginBottom: 6 }]}>Compounding Frequency</Text>
      <PillGroup options={freqOptions} value={freq} onChange={(v) => { setFreq(v as CompFreq); setResult(null); }} colors={colors} />
      <CalcBtn onPress={calculate} colors={colors} />
      {result && <ResultCards result={result} colors={colors} />}
    </ScrollView>
  );
}

// ── Mix Tab ───────────────────────────────────────────────────────────────────
function MixTab({ colors }: { colors: Colors }) {
  const [monthly, setMonthly] = useState('5000');
  const [lump, setLump]       = useState('50000');
  const [rate, setRate]       = useState('12');
  const [years, setYears]     = useState('10');
  const [result, setResult]   = useState<CalcResult | null>(null);

  const calculate = () => setResult(mixResult(toNum(monthly), toNum(lump), toNum(rate), toNum(years)));

  return (
    <ScrollView contentContainerStyle={ts.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={[ts.infoBox, { backgroundColor: colors.accentLight, borderColor: colors.accent + '40' }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
        <Text style={[ts.infoText, { color: colors.accent }]}>
          Combine a one-time lumpsum with monthly SIP for maximum growth.
        </Text>
      </View>
      <Field label="Monthly SIP Amount" value={monthly} onChange={setMonthly} prefix="₹" colors={colors} hint="Set 0 to skip SIP" />
      <Field label="One-time Lumpsum" value={lump} onChange={setLump} prefix="₹" colors={colors} hint="Set 0 to skip lumpsum" />
      <Field label="Expected Annual Return" value={rate} onChange={setRate} suffix="%" colors={colors} />
      <Field label="Investment Duration" value={years} onChange={setYears} suffix="yrs" colors={colors} />
      <CalcBtn onPress={calculate} colors={colors} />
      {result && (
        <>
          <ResultCards result={result} colors={colors} />
          {toNum(monthly) > 0 && toNum(lump) > 0 && (() => {
            const sipOnly  = sipResult(toNum(monthly), toNum(rate), toNum(years));
            const lumpOnly = lumpsumResult(toNum(lump), toNum(rate), toNum(years), 'annually');
            return (
              <View style={[ts.breakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[ts.breakdownTitle, { color: colors.text }]}>Contribution Breakdown</Text>
                {sipOnly && (
                  <View style={ts.breakdownRow}>
                    <Text style={[ts.breakdownLabel, { color: colors.textMuted }]}>SIP portion</Text>
                    <Text style={[ts.breakdownValue, { color: colors.text }]}>{fmtINR(sipOnly.maturity)}</Text>
                  </View>
                )}
                {lumpOnly && (
                  <View style={ts.breakdownRow}>
                    <Text style={[ts.breakdownLabel, { color: colors.textMuted }]}>Lumpsum portion</Text>
                    <Text style={[ts.breakdownValue, { color: colors.text }]}>{fmtINR(lumpOnly.maturity)}</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </>
      )}
    </ScrollView>
  );
}

// ── Returns Tab ───────────────────────────────────────────────────────────────
function ReturnsTab({ colors }: { colors: Colors }) {
  const [invested, setInvested] = useState('100000');
  const [current, setCurrent]   = useState('180000');
  const [years, setYears]       = useState('5');
  const [result, setResult]     = useState<ReturnType<typeof returnsAnalysis> | null>(null);

  const calculate = () => setResult(returnsAnalysis(toNum(invested), toNum(current), toNum(years)));

  const positive = (result?.gain ?? 0) >= 0;

  return (
    <ScrollView contentContainerStyle={ts.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Field label="Total Amount Invested" value={invested} onChange={setInvested} prefix="₹" colors={colors} hint="Sum of all investments made" />
      <Field label="Current Value" value={current} onChange={setCurrent} prefix="₹" colors={colors} hint="Present market value of portfolio" />
      <Field label="Investment Period" value={years} onChange={setYears} suffix="yrs" colors={colors} hint="Set 0 to skip CAGR calculation" />
      <CalcBtn onPress={calculate} colors={colors} />

      {result && (
        <View style={[ts.retCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <RetMetric
            label="Absolute Return"
            value={fmtPct(result.absRet)}
            sub="Total gain on invested capital"
            positive={positive}
            colors={colors}
          />
          {result.cagr !== null && (
            <RetMetric
              label="CAGR"
              value={fmtPct(result.cagr)}
              sub="Compounded annual growth rate"
              positive={positive}
              colors={colors}
            />
          )}
          <RetMetric
            label="Profit / Loss"
            value={`${positive ? '+' : ''}${fmtINR(result.gain)}`}
            sub={`Current value: ${fmtINR(toNum(current))}`}
            positive={positive}
            colors={colors}
          />
          <RetMetric
            label="Wealth Multiple"
            value={`${result.multiple.toFixed(2)}×`}
            sub={result.multiple >= 2
              ? `Money doubled ${Math.floor(result.multiple / 2 * 10) / 10}× over`
              : result.multiple >= 1 ? 'Positive growth' : 'Capital erosion'}
            positive={positive}
            colors={colors}
          />

          {result.cagr !== null && (
            <View style={[ts.cagrGuide, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[ts.cagrTitle, { color: colors.text }]}>Return Benchmark</Text>
              {[
                { label: 'Savings Account', range: '3–4%',  flag: Math.abs(result.cagr) < 4 },
                { label: 'FD / Debt Fund',  range: '6–8%',  flag: Math.abs(result.cagr) >= 4  && Math.abs(result.cagr) < 9 },
                { label: 'Balanced Fund',   range: '9–12%', flag: Math.abs(result.cagr) >= 9  && Math.abs(result.cagr) < 13 },
                { label: 'Equity / MF',     range: '12–18%',flag: Math.abs(result.cagr) >= 13 && Math.abs(result.cagr) < 20 },
                { label: 'Small Cap / High Risk', range: '18%+', flag: Math.abs(result.cagr) >= 20 },
              ].map((b) => (
                <View key={b.label} style={[ts.benchRow, b.flag && { backgroundColor: ACCENT + '18', borderRadius: 6 }]}>
                  <Text style={[ts.benchLabel, { color: b.flag ? ACCENT : colors.textMuted }]}>{b.label}</Text>
                  <Text style={[ts.benchRange, { color: b.flag ? ACCENT : colors.textMuted }]}>{b.range}</Text>
                  {b.flag && <Ionicons name="checkmark-circle" size={14} color={ACCENT} />}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function RetMetric({ label, value, sub, positive, colors }: { label: string; value: string; sub: string; positive: boolean; colors: Colors }) {
  return (
    <View style={[ts.retRow, { borderBottomColor: colors.border }]}>
      <View>
        <Text style={[ts.retLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[ts.retSub, { color: colors.textMuted }]}>{sub}</Text>
      </View>
      <Text style={[ts.retValue, { color: positive ? '#10B981' : '#EF4444' }]}>{value}</Text>
    </View>
  );
}

// ── Compare Tab ───────────────────────────────────────────────────────────────
function CompareTab({ colors }: { colors: Colors }) {
  const [mode, setMode]       = useState<'sip' | 'lumpsum'>('sip');
  const [amount, setAmount]   = useState('10000');
  const [years, setYears]     = useState('15');
  const [r1, setR1]           = useState('8');
  const [r2, setR2]           = useState('12');
  const [r3, setR3]           = useState('16');
  const [results, setResults] = useState<{ rate: number; result: CalcResult }[] | null>(null);

  const calculate = () => {
    const a = toNum(amount), y = toNum(years);
    const calc = (rate: number) => mode === 'sip'
      ? sipResult(a, rate, y)
      : lumpsumResult(a, rate, y, 'annually');
    const out = [toNum(r1), toNum(r2), toNum(r3)].map((rate) => ({ rate, result: calc(rate)! })).filter((x) => x.result);
    setResults(out.length ? out : null);
  };

  const SCENARIO_COLORS = ['#F59E0B', '#10B981', '#6366F1'];
  const SCENARIO_LABELS = ['Conservative', 'Moderate', 'Aggressive'];

  return (
    <ScrollView contentContainerStyle={ts.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <PillGroup
        options={[{ label: 'Monthly SIP', value: 'sip' }, { label: 'Lumpsum', value: 'lumpsum' }]}
        value={mode} onChange={(v) => { setMode(v as any); setResults(null); }} colors={colors}
      />
      <Field
        label={mode === 'sip' ? 'Monthly SIP Amount' : 'Investment Amount'}
        value={amount} onChange={setAmount} prefix="₹" colors={colors}
      />
      <Field label="Duration" value={years} onChange={setYears} suffix="yrs" colors={colors} />

      <Text style={[fi.label, { color: colors.textMuted, marginBottom: 8 }]}>Return Rate Scenarios (%)</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.md }}>
        {[
          { label: 'Conservative', val: r1, set: setR1, color: SCENARIO_COLORS[0] },
          { label: 'Moderate',     val: r2, set: setR2, color: SCENARIO_COLORS[1] },
          { label: 'Aggressive',   val: r3, set: setR3, color: SCENARIO_COLORS[2] },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1 }}>
            <Text style={[ts.scenLabel, { color: s.color }]}>{s.label}</Text>
            <View style={[fi.row, { borderColor: s.color + '60', backgroundColor: colors.inputBg }]}>
              <TextInput
                style={[fi.input, { color: colors.text, textAlign: 'center' }]}
                value={s.val}
                onChangeText={s.set}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[fi.affix, { color: colors.textMuted }]}>%</Text>
            </View>
          </View>
        ))}
      </View>

      <CalcBtn onPress={calculate} colors={colors} />

      {results && (
        <View style={{ marginTop: Spacing.lg, gap: 12 }}>
          {results.map((r, i) => (
            <View key={r.rate} style={[ts.scenCard, { backgroundColor: colors.surface, borderColor: SCENARIO_COLORS[i] + '50' }]}>
              <View style={ts.scenHeader}>
                <Text style={[ts.scenName, { color: SCENARIO_COLORS[i] }]}>{SCENARIO_LABELS[i]} · {r.rate}% p.a.</Text>
                <Text style={[ts.scenMaturity, { color: colors.text }]}>{fmtINR(r.result.maturity)}</Text>
              </View>
              <View style={ts.scenMeta}>
                <Text style={[ts.scenMetaText, { color: colors.textMuted }]}>Invested: {fmtINR(r.result.invested)}</Text>
                <Text style={[ts.scenMetaText, { color: '#10B981' }]}>Returns: {fmtINR(r.result.returns)}</Text>
                <Text style={[ts.scenMetaText, { color: colors.textMuted }]}>
                  {((r.result.returns / r.result.invested) * 100).toFixed(1)}% gain
                </Text>
              </View>
              <View style={[ts.scenBar, { backgroundColor: colors.border }]}>
                <View style={[ts.scenBarFill, {
                  width: `${(r.result.invested / r.result.maturity) * 100}%` as any,
                  backgroundColor: SCENARIO_COLORS[i] + '80',
                }]} />
                <View style={[ts.scenBarFill, {
                  width: `${(r.result.returns / r.result.maturity) * 100}%` as any,
                  backgroundColor: SCENARIO_COLORS[i],
                }]} />
              </View>
            </View>
          ))}

          {results.length > 1 && (
            <View style={[ts.diffCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[ts.diffTitle, { color: colors.text }]}>Difference Analysis</Text>
              <View style={ts.diffRow}>
                <Text style={[ts.diffLabel, { color: colors.textMuted }]}>
                  {SCENARIO_LABELS[results.length - 1]} vs {SCENARIO_LABELS[0]}
                </Text>
                <Text style={[ts.diffValue, { color: '#10B981' }]}>
                  +{fmtINR(results[results.length - 1].result.maturity - results[0].result.maturity)} more
                </Text>
              </View>
              <Text style={[ts.diffSub, { color: colors.textMuted }]}>
                Higher return rate generates {((results[results.length - 1].result.maturity / results[0].result.maturity - 1) * 100).toFixed(1)}% more wealth over {years} years
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'sip',      label: 'SIP',     icon: 'trending-up-outline'  },
  { id: 'lumpsum',  label: 'Lumpsum', icon: 'wallet-outline'       },
  { id: 'mix',      label: 'Mix',     icon: 'git-merge-outline'    },
  { id: 'returns',  label: 'Returns', icon: 'analytics-outline'    },
  { id: 'compare',  label: 'Compare', icon: 'bar-chart-outline'    },
];

export default function InvestmentCalculatorScreen() {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<TabId>('sip');

  return (
    <ScreenShell title="Investment Calculator" accentColor={ACCENT} scrollable={false}>
      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ms.tabBar}
        style={[ms.tabScroll, { borderBottomColor: colors.border }]}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity key={t.id} style={[ms.tab, active && ms.tabActive, active && { borderBottomColor: ACCENT }]} onPress={() => setTab(t.id)}>
              <Ionicons name={t.icon as any} size={15} color={active ? ACCENT : colors.textMuted} />
              <Text style={[ms.tabLabel, { color: active ? ACCENT : colors.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'sip'     && <SIPTab     colors={colors} />}
        {tab === 'lumpsum' && <LumpsumTab colors={colors} />}
        {tab === 'mix'     && <MixTab     colors={colors} />}
        {tab === 'returns' && <ReturnsTab colors={colors} />}
        {tab === 'compare' && <CompareTab colors={colors} />}
      </View>
    </ScreenShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  tabScroll: { borderBottomWidth: 1, flexGrow: 0 },
  tabBar:    { gap: 4 },
  tab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabLabel:  { fontFamily: Fonts.semibold, fontSize: 13 },
});

const ts = StyleSheet.create({
  scroll:         { paddingTop: Spacing.lg, paddingBottom: Spacing.huge },
  infoBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
  infoText:       { flex: 1, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18 },
  breakdown:      { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.md },
  breakdownTitle: { fontFamily: Fonts.semibold, fontSize: 13, marginBottom: Spacing.sm },
  breakdownRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontFamily: Fonts.regular, fontSize: 13 },
  breakdownValue: { fontFamily: Fonts.bold, fontSize: 13 },

  retCard:   { borderRadius: Radii.xl, borderWidth: 1, overflow: 'hidden', marginTop: Spacing.lg },
  retRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1 },
  retLabel:  { fontFamily: Fonts.semibold, fontSize: 14, marginBottom: 2 },
  retSub:    { fontFamily: Fonts.regular, fontSize: 11 },
  retValue:  { fontFamily: Fonts.bold, fontSize: 18 },

  cagrGuide:  { margin: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md },
  cagrTitle:  { fontFamily: Fonts.bold, fontSize: 13, marginBottom: Spacing.sm },
  benchRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4, gap: 6 },
  benchLabel: { flex: 1, fontFamily: Fonts.regular, fontSize: 12 },
  benchRange: { fontFamily: Fonts.semibold, fontSize: 12 },

  scenLabel:   { fontFamily: Fonts.semibold, fontSize: 11, marginBottom: 4 },
  scenCard:    { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md },
  scenHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  scenName:    { fontFamily: Fonts.semibold, fontSize: 13 },
  scenMaturity:{ fontFamily: Fonts.bold, fontSize: 18 },
  scenMeta:    { flexDirection: 'row', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  scenMetaText:{ fontFamily: Fonts.regular, fontSize: 11 },
  scenBar:     { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  scenBarFill: { height: '100%' },

  diffCard:  { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md },
  diffTitle: { fontFamily: Fonts.bold, fontSize: 13, marginBottom: Spacing.sm },
  diffRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  diffLabel: { fontFamily: Fonts.regular, fontSize: 13 },
  diffValue: { fontFamily: Fonts.bold, fontSize: 15 },
  diffSub:   { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18 },
});
