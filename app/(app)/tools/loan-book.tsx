import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#7C3AED';
const STORAGE_KEY = 'uk_loan_book';

type Payment = { amount: number; date: string };
type Loan = { id: string; type: 'given' | 'taken'; person: string; amount: number; remaining: number; date: string; reason: string; settled: boolean; settledDate: string | null; payments: Payment[] };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDate(iso: string) { const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function daysBetween(a: string, b: string) { return Math.round((new Date(b+'T00:00:00').getTime()-new Date(a+'T00:00:00').getTime())/86400000); }

export default function LoanBookScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [filter, setFilter] = useState<'all'|'given'|'taken'|'settled'>('all');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [payingId, setPayingId] = useState<string|null>(null);
  const [payAmt, setPayAmt] = useState('');

  // Form
  const [loanType, setLoanType] = useState<'given'|'taken'>('given');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => { loadJSON<Loan[]>(STORAGE_KEY, []).then(setLoans); }, []);
  const persist = useCallback((d: Loan[]) => { setLoans(d); saveJSON(STORAGE_KEY, d); }, []);

  const resetForm = () => { setPerson(''); setAmount(''); setReason(''); setShowForm(false); };

  const addLoan = () => {
    if (!person.trim() || !amount.trim()) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    const loan: Loan = { id: uid(), type: loanType, person: person.trim(), amount: amt, remaining: amt, date: todayISO(), reason: reason.trim(), settled: false, settledDate: null, payments: [] };
    persist([loan, ...loans]);
    resetForm();
  };

  const addPayment = (id: string) => {
    const pay = parseFloat(payAmt) || 0;
    if (pay <= 0) return;
    persist(loans.map(l => {
      if (l.id !== id) return l;
      const newRemaining = Math.max(0, l.remaining - pay);
      const newPayments = [...l.payments, { amount: pay, date: todayISO() }];
      return { ...l, remaining: newRemaining, payments: newPayments, settled: newRemaining === 0, settledDate: newRemaining === 0 ? todayISO() : null };
    }));
    setPayingId(null);
    setPayAmt('');
  };

  const settle = (id: string) => persist(loans.map(l => l.id === id ? { ...l, settled: true, settledDate: todayISO(), remaining: 0 } : l));
  const deleteLoan = (id: string) => persist(loans.filter(l => l.id !== id));

  const filtered = useMemo(() => {
    let list = loans;
    if (filter === 'given') list = list.filter(l => l.type === 'given' && !l.settled);
    if (filter === 'taken') list = list.filter(l => l.type === 'taken' && !l.settled);
    if (filter === 'settled') list = list.filter(l => l.settled);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(l => l.person.toLowerCase().includes(q)); }
    return list;
  }, [loans, filter, search]);

  const totalGiven = loans.filter(l => l.type === 'given' && !l.settled).reduce((s, l) => s + l.remaining, 0);
  const totalTaken = loans.filter(l => l.type === 'taken' && !l.settled).reduce((s, l) => s + l.remaining, 0);
  const netBalance = totalGiven - totalTaken;

  return (
    <ScreenShell title="Loan Book" accentColor={ACCENT}>
      {/* Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{fmt(totalGiven)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>To Receive</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#EF4444' }]}>{fmt(totalTaken)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>To Pay</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: netBalance >= 0 ? '#10B981' : '#EF4444' }]}>{netBalance >= 0 ? '+' : ''}{fmt(netBalance)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Net</Text>
          </View>
        </View>
      </View>

      {/* Filter + Add */}
      <View style={styles.filterRow}>
        {(['all','given','taken','settled'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, { backgroundColor: filter === f ? ACCENT+'22' : colors.glass, borderColor: filter === f ? ACCENT : colors.border }]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, { color: filter === f ? ACCENT : colors.textMuted }]}>{f === 'all' ? 'All' : f === 'given' ? 'Given' : f === 'taken' ? 'Taken' : 'Settled'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: ACCENT }]} onPress={() => { resetForm(); setShowForm(true); }}>
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <TextInput style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={search} onChangeText={setSearch} placeholder="Search by name..." placeholderTextColor={colors.textMuted} />

      {/* Add form */}
      {showForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>New Loan</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeBtn, { backgroundColor: loanType === 'given' ? '#10B981'+'22' : colors.glass, borderColor: loanType === 'given' ? '#10B981' : colors.border }]} onPress={() => setLoanType('given')}>
              <Text style={[styles.typeText, { color: loanType === 'given' ? '#10B981' : colors.textMuted }]}>I Gave</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, { backgroundColor: loanType === 'taken' ? '#EF4444'+'22' : colors.glass, borderColor: loanType === 'taken' ? '#EF4444' : colors.border }]} onPress={() => setLoanType('taken')}>
              <Text style={[styles.typeText, { color: loanType === 'taken' ? '#EF4444' : colors.textMuted }]}>I Took</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={person} onChangeText={setPerson} placeholder="Person name" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={reason} onChangeText={setReason} placeholder="Reason (optional)" placeholderTextColor={colors.textMuted} />
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}><Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={addLoan}><Text style={styles.saveText}>Add Loan</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loan list */}
      {filtered.map(loan => {
        const isOld = !loan.settled && daysBetween(loan.date, todayISO()) > 30;
        const paidPct = loan.amount > 0 ? ((loan.amount - loan.remaining) / loan.amount) * 100 : 0;
        return (
          <View key={loan.id} style={[styles.loanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.loanHeader}>
              <View style={[styles.typeBadge, { backgroundColor: (loan.type === 'given' ? '#10B981' : '#EF4444') + '18' }]}>
                <Text style={[styles.typeBadgeText, { color: loan.type === 'given' ? '#10B981' : '#EF4444' }]}>{loan.type === 'given' ? 'Given' : 'Taken'}</Text>
              </View>
              <Text style={[styles.loanPerson, { color: colors.text }]}>{loan.person}</Text>
              {isOld && <Ionicons name="alert-circle" size={14} color="#F59E0B" />}
              {loan.settled && <View style={[styles.settledBadge, { backgroundColor: '#10B981'+'18' }]}><Text style={[styles.settledText, { color: '#10B981' }]}>Settled</Text></View>}
            </View>
            <View style={styles.loanAmtRow}>
              <Text style={[styles.loanAmount, { color: loan.type === 'given' ? '#10B981' : '#EF4444' }]}>{fmt(loan.amount)}</Text>
              {!loan.settled && loan.remaining !== loan.amount && <Text style={[styles.loanRemaining, { color: colors.textMuted }]}>Remaining: {fmt(loan.remaining)}</Text>}
            </View>
            {!loan.settled && paidPct > 0 && (
              <View style={[styles.progressBg, { backgroundColor: colors.glass }]}>
                <View style={[styles.progressFill, { width: `${paidPct}%` as any, backgroundColor: '#10B981' }]} />
              </View>
            )}
            <View style={styles.loanMeta}>
              <Text style={[styles.loanDate, { color: colors.textMuted }]}>{fmtDate(loan.date)}</Text>
              {loan.reason ? <Text style={[styles.loanReason, { color: colors.textMuted }]} numberOfLines={1}>{loan.reason}</Text> : null}
            </View>

            {/* Payment input */}
            {payingId === loan.id && (
              <View style={styles.payRow}>
                <TextInput style={[styles.payInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={payAmt} onChangeText={setPayAmt} placeholder="Amount" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                <TouchableOpacity style={[styles.payBtn, { backgroundColor: '#10B981' }]} onPress={() => addPayment(loan.id)}><Text style={styles.payBtnText}>Pay</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPayingId(null)}><Ionicons name="close" size={20} color={colors.textMuted} /></TouchableOpacity>
              </View>
            )}

            {!loan.settled && (
              <View style={styles.loanActions}>
                <TouchableOpacity style={[styles.actionChip, { borderColor: colors.border }]} onPress={() => { setPayingId(loan.id); setPayAmt(''); }}>
                  <Text style={[styles.actionChipText, { color: ACCENT }]}>+ Payment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChip, { borderColor: colors.border }]} onPress={() => settle(loan.id)}>
                  <Text style={[styles.actionChipText, { color: '#10B981' }]}>Settle</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteLoan(loan.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            {loan.settled && (
              <TouchableOpacity onPress={() => deleteLoan(loan.id)} style={{ alignSelf: 'flex-end' }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={48} color={ACCENT+'40'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No loans recorded. Tap + to add one.</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 18, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    divider: { width: 1, height: 30 },
    filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, alignItems: 'center' },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    filterText: { fontSize: 11, fontFamily: Fonts.medium },
    addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
    searchInput: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.lg },
    typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    typeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1, alignItems: 'center' },
    typeText: { fontSize: 13, fontFamily: Fonts.semibold },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    formBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, borderWidth: 1, alignItems: 'center' },
    cancelText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    loanCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    loanHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.sm },
    typeBadgeText: { fontSize: 10, fontFamily: Fonts.bold },
    loanPerson: { fontSize: 15, fontFamily: Fonts.bold, flex: 1 },
    settledBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.sm },
    settledText: { fontSize: 10, fontFamily: Fonts.bold },
    loanAmtRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md },
    loanAmount: { fontSize: 22, fontFamily: Fonts.bold },
    loanRemaining: { fontSize: 12, fontFamily: Fonts.medium },
    progressBg: { height: 4, borderRadius: 2, marginTop: Spacing.sm, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    loanMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    loanDate: { fontSize: 11, fontFamily: Fonts.regular },
    loanReason: { fontSize: 11, fontFamily: Fonts.regular, flex: 1 },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
    payInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.sm, borderRadius: Radii.md, borderWidth: 1 },
    payBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: Radii.md },
    payBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
    loanActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, alignItems: 'center' },
    actionChip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    actionChipText: { fontSize: 11, fontFamily: Fonts.semibold },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
