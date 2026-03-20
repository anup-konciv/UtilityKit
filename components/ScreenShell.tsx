import { useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

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
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { backgroundColor: colors.surface }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightSlot}>{rightAction ?? <View style={{ width: 38 }} />}</View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
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
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      gap: Spacing.sm,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    rightSlot: { width: 38, alignItems: 'flex-end' },
    scroll: { flex: 1 },
    scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.huge },
    flat: { flex: 1, padding: Spacing.lg },
  });
