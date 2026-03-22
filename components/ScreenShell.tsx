import { useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

type Props = {
  title: string;
  children: ReactNode;
  scrollable?: boolean;
  accentColor?: string;
  rightAction?: ReactNode;
};

export default function ScreenShell({
  title,
  children,
  scrollable = true,
  accentColor,
  rightAction,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accent = accentColor ?? colors.accent;

  const header = (
    <View style={styles.headerWrapper}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            {
              backgroundColor: withAlpha(accent, colors.bg === '#0B1120' ? '18' : '12'),
              borderColor: withAlpha(accent, colors.bg === '#0B1120' ? '32' : '24'),
            },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <View style={[styles.titleDot, { backgroundColor: accent }]} />
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.rightSlot}>{rightAction ?? <View style={{ width: 38 }} />}</View>
      </View>
      <View style={[styles.headerAccent, { backgroundColor: withAlpha(accent, '4A') }]} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View pointerEvents="none" style={styles.atmosphere}>
        <View style={[styles.glowPrimary, { backgroundColor: withAlpha(accent, '18') }]} />
        <View style={[styles.glowSecondary, { backgroundColor: withAlpha(accent, '10') }]} />
      </View>
      {header}
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flat}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1, overflow: 'hidden' },
    atmosphere: {
      ...StyleSheet.absoluteFillObject,
    },
    glowPrimary: {
      position: 'absolute',
      width: 240,
      height: 240,
      borderRadius: 999,
      top: -90,
      right: -70,
    },
    glowSecondary: {
      position: 'absolute',
      width: 190,
      height: 190,
      borderRadius: 999,
      top: 120,
      left: -70,
    },
    headerWrapper: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderStrong,
      backgroundColor: withAlpha(colors.surface, colors.bg === '#0B1120' ? 'F4' : 'F0'),
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
      width: '100%',
      maxWidth: 860,
      alignSelf: 'center',
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    titleDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    title: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    rightSlot: { width: 38, alignItems: 'flex-end' },
    headerAccent: {
      height: 2,
      width: '100%',
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.huge,
      gap: Spacing.lg,
      width: '100%',
      maxWidth: 860,
      alignSelf: 'center',
    },
    flat: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      width: '100%',
      maxWidth: 860,
      alignSelf: 'center',
    },
  });
