import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { pickSeededValue, withAlpha } from '@/lib/color-utils';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#9333EA';

type Product = { id: string; name: string; price: string; quantity: string; unit: string };
type ProductAnalysis = {
  id: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
  baseUnit: string;
  unitPrice: number;
};

const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'L', 'fl oz', 'pcs'] as const;
const PRODUCT_COLORS = [
  { primary: '#F97316', soft: '#FFF7ED' },
  { primary: '#0EA5E9', soft: '#EFF6FF' },
  { primary: '#10B981', soft: '#ECFDF5' },
  { primary: '#EC4899', soft: '#FDF2F8' },
  { primary: '#F59E0B', soft: '#FFFBEB' },
];

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function toBaseUnit(quantity: number, unit: string) {
  switch (unit) {
    case 'kg':
      return { value: quantity * 1000, base: 'g' };
    case 'lb':
      return { value: quantity * 453.592, base: 'g' };
    case 'oz':
      return { value: quantity * 28.3495, base: 'g' };
    case 'L':
      return { value: quantity * 1000, base: 'ml' };
    case 'fl oz':
      return { value: quantity * 29.5735, base: 'ml' };
    default:
      return { value: quantity, base: unit };
  }
}

function formatUnitPrice(item: ProductAnalysis) {
  if (item.unitPrice < 0.01) {
    return `${(item.unitPrice * 1000).toFixed(2)} / 1000 ${item.baseUnit}`;
  }

  return `${item.unitPrice.toFixed(4)} / ${item.baseUnit}`;
}

export default function UnitPriceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [products, setProducts] = useState<Product[]>([
    { id: uid(), name: 'Everyday Pack', price: '79', quantity: '500', unit: 'g' },
    { id: uid(), name: 'Family Pack', price: '139', quantity: '1000', unit: 'g' },
  ]);
  const history = useToolHistory<Product[]>('unit-price', { max: 8 });

  const updateProduct = useCallback((id: string, field: keyof Product, value: string) => {
    setProducts((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }, []);

  const addProduct = useCallback(() => {
    setProducts((current) => [
      ...current,
      {
        id: uid(),
        name: `Option ${String.fromCharCode(65 + current.length)}`,
        price: '',
        quantity: '',
        unit: 'g',
      },
    ]);
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts((current) => (current.length > 2 ? current.filter((item) => item.id !== id) : current));
  }, []);

  const analysis = useMemo(() => {
    const items = products
      .map((product) => {
        const price = Number.parseFloat(product.price);
        const quantity = Number.parseFloat(product.quantity);

        if (!price || !quantity || price <= 0 || quantity <= 0) return null;

        const base = toBaseUnit(quantity, product.unit);

        return {
          id: product.id,
          name: product.name.trim() || 'Untitled product',
          price,
          qty: quantity,
          unit: product.unit,
          baseUnit: base.base,
          unitPrice: price / base.value,
        } satisfies ProductAnalysis;
      })
      .filter(Boolean) as ProductAnalysis[];

    const groups = new Map<string, ProductAnalysis[]>();

    items.forEach((item) => {
      const existing = groups.get(item.baseUnit) ?? [];
      groups.set(item.baseUnit, [...existing, item]);
    });

    const bestIds = new Set<string>();
    const summaryRows: { baseUnit: string; items: ProductAnalysis[] }[] = [];

    groups.forEach((group, baseUnit) => {
      const sorted = [...group].sort((left, right) => left.unitPrice - right.unitPrice);
      if (sorted.length > 1) {
        bestIds.add(sorted[0].id);
      }
      summaryRows.push({ baseUnit, items: sorted });
    });

    summaryRows.sort((left, right) => left.baseUnit.localeCompare(right.baseUnit));

    return { items, bestIds, summaryRows, hasComparableGroup: summaryRows.some((group) => group.items.length > 1) };
  }, [products]);

  return (
    <ScreenShell title="Price Compare" accentColor={ACCENT}>
      <LinearGradient
        colors={['#581C87', '#9333EA', '#DDD6FE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Smart Shopping</Text>
        <Text style={styles.heroTitle}>
          {analysis.hasComparableGroup ? `${analysis.bestIds.size} best deal${analysis.bestIds.size === 1 ? '' : 's'} found` : 'Compare like-for-like products'}
        </Text>
        <Text style={styles.heroCopy}>
          Match products by their true unit price so you can see which pack actually gives the better value.
        </Text>
      </LinearGradient>

      {products.map((product) => {
        const palette = pickSeededValue(PRODUCT_COLORS, product.id);
        const item = analysis.items.find((entry) => entry.id === product.id);
        const isBest = analysis.bestIds.has(product.id);

        return (
          <View
            key={product.id}
            style={[
              styles.productCard,
              {
                backgroundColor: colors.card,
                borderColor: isBest ? withAlpha(palette.primary, '44') : colors.border,
              },
            ]}
          >
            <View style={styles.productTopRow}>
              <View style={[styles.productAccent, { backgroundColor: palette.primary }]} />
              <View style={styles.productHeaderText}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text }]}
                  value={product.name}
                  onChangeText={(value) => updateProduct(product.id, 'name', value)}
                  placeholder="Product name"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.productTag, { color: palette.primary }]}>
                  {isBest ? 'Best in group' : 'Compare option'}
                </Text>
              </View>
              {products.length > 2 ? (
                <TouchableOpacity onPress={() => removeProduct(product.id)} style={styles.removeButton}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Price</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={product.price}
                  onChangeText={(value) => updateProduct(product.id, 'price', value)}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Quantity</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={product.quantity}
                  onChangeText={(value) => updateProduct(product.id, 'quantity', value)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.unitRow}>
              {UNITS.map((unit) => {
                const active = product.unit === unit;
                return (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.unitChip,
                      active
                        ? { backgroundColor: palette.primary, borderColor: palette.primary }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => updateProduct(product.id, 'unit', unit)}
                  >
                    <Text style={[styles.unitChipText, { color: active ? '#FFFFFF' : colors.textMuted }]}>{unit}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.unitPriceBanner,
                {
                  backgroundColor: withAlpha(palette.primary, colors.bg === '#0B1120' ? '18' : '10'),
                  borderColor: withAlpha(palette.primary, '24'),
                },
              ]}
            >
              <Text style={[styles.unitPriceLabel, { color: colors.textMuted }]}>Unit Price</Text>
              <Text style={[styles.unitPriceValue, { color: colors.text }]}>
                {item ? formatUnitPrice(item) : 'Add price and quantity'}
              </Text>
            </View>
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <TouchableOpacity style={[styles.addButton, { borderColor: withAlpha(ACCENT, '38'), flex: 1 }]} onPress={addProduct}>
          <Ionicons name="add" size={20} color={ACCENT} />
          <Text style={[styles.addButtonText, { color: ACCENT }]}>Add Product</Text>
        </TouchableOpacity>
        {analysis.hasComparableGroup && (
          <TouchableOpacity
            style={[styles.addButton, { borderColor: withAlpha(ACCENT, '38'), flex: 1, backgroundColor: withAlpha(ACCENT, '12') }]}
            onPress={() => {
              haptics.success();
              const summary = products
                .filter((p) => p.name.trim())
                .map((p) => `${p.name} ${p.price}/${p.quantity}${p.unit}`)
                .join(' • ');
              history.push(products, summary);
            }}
          >
            <Ionicons name="bookmark-outline" size={20} color={ACCENT} />
            <Text style={[styles.addButtonText, { color: ACCENT }]}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.entries.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={[styles.summaryTitle, { color: colors.textMuted }]}>Saved Comparisons</Text>
            <TouchableOpacity onPress={() => { haptics.warning(); history.clear(); }}>
              <Text style={[{ color: ACCENT, fontFamily: Fonts.semibold, fontSize: 12 }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.entries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                borderBottomWidth: idx < history.entries.length - 1 ? 0.5 : 0,
                borderBottomColor: colors.border,
              }}
              onPress={() => {
                haptics.tap();
                setProducts(entry.value);
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
              <Text style={[{ color: colors.text, fontFamily: Fonts.semibold, fontSize: 12, flex: 1 }]} numberOfLines={2}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.summaryTitle, { color: colors.textMuted }]}>Comparison Summary</Text>
        {analysis.summaryRows.length === 0 ? (
          <Text style={[styles.summaryEmpty, { color: colors.textMuted }]}>
            Enter product details to see grouped best deals.
          </Text>
        ) : (
          analysis.summaryRows.map((group) => (
            <View key={group.baseUnit} style={styles.groupBlock}>
              <Text style={[styles.groupTitle, { color: colors.text }]}>Compared as {group.baseUnit}</Text>
              {group.items.map((item, index) => {
                const isBest = analysis.bestIds.has(item.id);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.summaryRow,
                      index < group.items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null,
                    ]}
                  >
                    <View style={styles.summaryLeft}>
                      <Ionicons name={isBest ? 'trophy' : 'pricetag-outline'} size={16} color={isBest ? '#F59E0B' : colors.textMuted} />
                      <Text style={[styles.summaryName, { color: colors.text }]}>{item.name}</Text>
                    </View>
                    <Text style={[styles.summaryValue, { color: isBest ? ACCENT : colors.textMuted }]}>
                      {formatUnitPrice(item)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#EDE9FE',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 30,
      lineHeight: 36,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#F5F3FF',
    },
    productCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    productTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    productAccent: {
      width: 10,
      alignSelf: 'stretch',
      borderRadius: Radii.pill,
    },
    productHeaderText: {
      flex: 1,
      gap: 4,
    },
    nameInput: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      padding: 0,
    },
    productTag: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    removeButton: {
      paddingTop: 2,
    },
    fieldGrid: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    field: {
      flex: 1,
      gap: Spacing.sm,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    unitRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    unitChip: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    unitChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    unitPriceBanner: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: 4,
    },
    unitPriceLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    unitPriceValue: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    addButton: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderRadius: Radii.xl,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    addButtonText: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    summaryCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    summaryTitle: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    summaryEmpty: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
    },
    groupBlock: {
      gap: Spacing.sm,
    },
    groupTitle: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    summaryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: 1,
    },
    summaryName: {
      fontSize: 14,
      fontFamily: Fonts.medium,
    },
    summaryValue: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
  });
