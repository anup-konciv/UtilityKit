import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './ThemeProvider';
import KeyboardAwareModal from './KeyboardAwareModal';
import { TOOLS, type ToolMeta } from '@/constants/tools-meta';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  accent: string;
  selectedIds: string[];
  /** When set, tools already in another folder get a subtle "In: X" tag. Optional. */
  folderByTool?: Record<string, string | undefined>;
  onClose: () => void;
  onSave: (ids: string[]) => void;
};

export default function ToolPickerModal({
  visible,
  title,
  accent,
  selectedIds,
  folderByTool,
  onClose,
  onSave,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    if (visible) {
      setDraft(new Set(selectedIds));
      setQuery('');
    }
  }, [visible, selectedIds]);

  const filtered = useMemo<ToolMeta[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter(
      t =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.badge.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = useCallback((id: string) => {
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ToolMeta }) => {
      const checked = draft.has(item.id);
      const owner = folderByTool?.[item.id];
      return (
        <TouchableOpacity
          style={[styles.row, checked && { borderColor: accent, backgroundColor: accent + '10' }]}
          onPress={() => toggle(item.id)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrap, { backgroundColor: item.accent + '15' }]}>
            <Ionicons name={item.icon as any} size={20} color={item.accent} />
          </View>
          <View style={styles.info}>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
            <Text style={styles.desc} numberOfLines={1}>
              {owner ? `In: ${owner}` : item.description}
            </Text>
          </View>
          <View
            style={[
              styles.check,
              checked
                ? { backgroundColor: accent, borderColor: accent }
                : { borderColor: colors.border },
            ]}
          >
            {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>
      );
    },
    [draft, toggle, accent, styles, colors, folderByTool],
  );

  const selectedCount = draft.size;

  return (
    <KeyboardAwareModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle}>
              {selectedCount} {selectedCount === 1 ? 'tool' : 'tools'} selected
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onSave(Array.from(draft))}
            style={[styles.saveBtn, { backgroundColor: accent }]}
          >
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search tools..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </KeyboardAwareModal>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerCenter: { flex: 1 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    title: { fontSize: 16, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -0.2 },
    subtitle: { fontSize: 11, fontFamily: Fonts.semibold, color: colors.textMuted, letterSpacing: 0.5 },
    saveBtn: {
      paddingHorizontal: Spacing.lg,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.3 },
    searchRow: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      height: 40,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, padding: 0 },
    list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    label: { fontSize: 14, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 2 },
    desc: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textMuted },
    check: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
