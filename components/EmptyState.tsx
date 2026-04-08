import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

type Props = {
  /** Ionicon name. Defaults to a friendly sparkles glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Headline. Keep it under ~30 chars. */
  title: string;
  /** Optional one-line subtext explaining what to do next. */
  hint?: string;
  /** Optional CTA button label. */
  actionLabel?: string;
  /** CTA handler. Required if `actionLabel` is set. */
  onAction?: () => void;
  /** Accent colour. Defaults to the theme accent. */
  accent?: string;
  /** Compact mode for inline use inside cards / tabs. */
  compact?: boolean;
};

/**
 * Shared empty-state used across every list-based tool. Replaces the
 * scattered `<Text>No items yet</Text>` snippets with a consistent,
 * theme-aware, optionally-actionable empty state.
 */
export default function EmptyState({
  icon = 'sparkles-outline',
  title,
  hint,
  actionLabel,
  onAction,
  accent,
  compact,
}: Props) {
  const { colors } = useAppTheme();
  const a = accent ?? colors.accent;
  const styles = useMemo(() => createStyles(colors, a, !!compact), [colors, a, compact]);

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <View style={styles.iconHalo} />
        <View style={styles.iconRing}>
          <Ionicons name={icon} size={compact ? 26 : 34} color={a} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.cta} onPress={onAction} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.ctaText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  accent: string,
  compact: boolean
) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: compact ? Spacing.xl : Spacing.huge,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    iconWrap: {
      width: compact ? 64 : 84,
      height: compact ? 64 : 84,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    iconHalo: {
      position: 'absolute',
      width: compact ? 64 : 84,
      height: compact ? 64 : 84,
      borderRadius: 999,
      backgroundColor: withAlpha(accent, '14'),
    },
    iconRing: {
      width: compact ? 48 : 64,
      height: compact ? 48 : 64,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(accent, '20'),
      borderWidth: 1,
      borderColor: withAlpha(accent, '40'),
    },
    title: {
      fontSize: compact ? 15 : 17,
      fontFamily: Fonts.bold,
      color: colors.text,
      textAlign: 'center',
    },
    hint: {
      fontSize: compact ? 12 : 13,
      fontFamily: Fonts.regular,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 18,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderRadius: Radii.pill,
      backgroundColor: accent,
      marginTop: Spacing.sm,
    },
    ctaText: {
      fontSize: 13,
      fontFamily: Fonts.bold,
      color: '#fff',
    },
  });
