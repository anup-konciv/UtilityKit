import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#9333EA';

type Product = { id: string; name: string; price: string; quantity: string; unit: string };

const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'L', 'fl oz', 'pcs'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function toBaseUnit(qty: number, unit: string): { value: number; base: string } {
  switch (unit) {
    case 'kg': return { value: qty * 1000, base: 'g' };
    case 'lb': return { value: qty * 453.592, base: 'g' };
    case 'oz': return { value: qty * 28.3495, base: 'g' };
    case 'L': return { value: qty * 1000, base: 'ml' };
    case 'fl oz': return { value: qty * 29.5735, base: 'ml' };
    default: return { value: qty, base: unit };
  }
}

export default function UnitPriceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [products, setProducts] = useState<Product[]>([
    { id: uid(), name: 'Product A', price: '', quantity: '', unit: 'g' },
    { id: uid(), name: 'Product B', price: '', quantity: '', unit: 'g' },
  ]);

  const updateProduct = useCallback((id: string, field: keyof Product, value: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, []);

  const addProduct = () => {
    setProducts(prev => [...prev, { id: uid(), name: `Product ${String.fromCharCode(65 + prev.length)}`, price: '', quantity: '', unit: 'g' }]);
  };

  const removeProduct = (id: string) => {
    if (products.length <= 2) return;
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const analysis = useMemo(() => {
    const items = products.map(p => {
      const price = parseFloat(p.price);
      const qty = parseFloat(p.quantity);
      if (!price || !qty || price <= 0 || qty <= 0) return null;
      const base = toBaseUnit(qty, p.unit);
      const unitPrice = price / base.value;
      return { id: p.id, name: p.name, price, qty, unit: p.unit, unitPrice, baseUnit: base.base, baseQty: base.value };
    }).filter(Boolean) as { id: string; name: string; price: number; qty: number; unit: string; unitPrice: number; baseUnit: string; baseQty: number }[];

    if (items.length < 2) return null;

    // Only compare items with same base unit
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const list = groups.get(item.baseUnit) || [];
      list.push(item);
      groups.set(item.baseUnit, list);
    }

    let bestId: string | null = null;
    let bestPrice = Infinity;
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      for (const item of group) {
        if (item.unitPrice < bestPrice) {
          bestPrice = item.unitPrice;
          bestId = item.id;
        }
      }
    }

    return { items, bestId };
  }, [products]);

  return (
    <ScreenShell title="Price Compare" accentColor={ACCENT}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Compare products by their unit price to find the best deal.
      </Text>

      {products.map((product, idx) => {
        const item = analysis?.items.find(i => i.id === product.id);
        const isBest = analysis?.bestId === product.id;

        return (
          <View
            key={product.id}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: isBest ? ACCENT : colors.border },
              isBest && { borderWidth: 2 },
            ]}
          >
            {isBest && (
              <View style={[styles.bestBadge, { backgroundColor: ACCENT }]}>
                <Ionicons name="trophy" size={12} color="#fff" />
                <Text style={styles.bestBadgeText}>Best Deal</Text>
              </View>
            )}

            {products.length > 2 && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(product.id)}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            <TextInput
              style={[styles.nameInput, { color: colors.text }]}
              value={product.name}
              onChangeText={v => updateProduct(product.id, 'name', v)}
              placeholder="Product name"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Price</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={product.price}
                  onChangeText={v => updateProduct(product.id, 'price', v)}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Quantity</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={product.quantity}
                  onChangeText={v => updateProduct(product.id, 'quantity', v)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.unitRow}>
              {UNITS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, product.unit === u && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                  onPress={() => updateProduct(product.id, 'unit', u)}
                >
                  <Text style={[styles.unitBtnText, { color: product.unit === u ? '#fff' : colors.textMuted }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {item && (
              <View style={[styles.priceResult, { backgroundColor: isBest ? ACCENT + '15' : colors.surface }]}>
                <Text style={[styles.priceResultText, { color: isBest ? ACCENT : colors.text }]}>
                  {item.unitPrice < 0.01
                    ? `${(item.unitPrice * 1000).toFixed(2)} per 1000 ${item.baseUnit}`
                    : `${item.unitPrice.toFixed(4)} per ${item.baseUnit}`}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={addProduct}>
        <Ionicons name="add" size={20} color={ACCENT} />
        <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Product</Text>
      </TouchableOpacity>

      {analysis && analysis.items.length >= 2 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.summaryTitle}>Comparison Summary</Text>
          {analysis.items.map((item, i) => {
            const isBest = item.id === analysis.bestId;
            const savings = analysis.bestId && !isBest
              ? ((item.unitPrice - (analysis.items.find(x => x.id === analysis.bestId)?.unitPrice || 0)) / item.unitPrice * 100)
              : 0;
            return (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={[styles.summaryName, { color: isBest ? ACCENT : colors.text }]}>
                  {isBest ? '🏆 ' : ''}{item.name}
                </Text>
                <Text style={[styles.summaryPrice, { color: isBest ? ACCENT : colors.textMuted }]}>
                  {item.unitPrice.toFixed(4)}/{item.baseUnit}
                  {savings > 0 ? ` (+${savings.toFixed(1)}%)` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    hint: { fontSize: 12, fontFamily: Fonts.regular, textAlign: 'center', marginBottom: Spacing.lg },
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md, position: 'relative' },
    bestBadge: { position: 'absolute', top: -10, left: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.pill },
    bestBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
    removeBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 1 },
    nameInput: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: Spacing.md, padding: 0 },
    fieldRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
    fieldLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.sm, fontSize: 16, fontFamily: Fonts.bold },
    unitRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: Spacing.md },
    unitBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1, borderColor: c.border },
    unitBtnText: { fontSize: 11, fontFamily: Fonts.semibold },
    priceResult: { padding: Spacing.sm, borderRadius: Radii.md, alignItems: 'center' },
    priceResultText: { fontSize: 14, fontFamily: Fonts.bold },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: Radii.lg, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: Spacing.lg },
    addBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    summaryCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg },
    summaryTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    summaryName: { fontSize: 14, fontFamily: Fonts.semibold },
    summaryPrice: { fontSize: 12, fontFamily: Fonts.medium },
  });
