import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Spacing, Radii } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

export default function SignupScreen() {
  const { signIn } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit =
    name.length > 0 && email.length > 0 && password.length >= 6 && passwordsMatch;

  const handleSignup = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setTimeout(async () => {
      await signIn();
      setLoading(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Atmosphere glows */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <Ionicons name="person-add" size={32} color={colors.accent} />
              </View>
            </View>
            <Text style={styles.appName}>Join UtilityKit</Text>
            <Text style={styles.tagline}>Create your account to get started</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create account</Text>

            {/* Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoComplete="name"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && password.length < 6 && (
                <Text style={styles.hint}>Must be at least 6 characters</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputRow,
                  confirmPassword.length > 0 &&
                    !passwordsMatch && {
                      borderColor: colors.error,
                    },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(!showConfirm)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Text style={styles.errorHint}>Passwords do not match</Text>
              )}
            </View>

            {/* Sign up button */}
            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              onPress={handleSignup}
              disabled={loading || !canSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}> Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    glowTop: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 999,
      top: -100,
      left: -80,
      backgroundColor: withAlpha(colors.accent, '18'),
    },
    glowBottom: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 999,
      bottom: -60,
      right: -80,
      backgroundColor: withAlpha(colors.accent, '10'),
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xxl,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },

    /* Brand */
    brand: {
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    logoOuter: {
      width: 80,
      height: 80,
      borderRadius: Radii.xl,
      backgroundColor: withAlpha(colors.accent, '14'),
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, '28'),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    logoInner: {
      width: 56,
      height: 56,
      borderRadius: Radii.lg,
      backgroundColor: withAlpha(colors.accent, '18'),
      justifyContent: 'center',
      alignItems: 'center',
    },
    appName: {
      fontFamily: Fonts.bold,
      fontSize: 28,
      color: colors.text,
      letterSpacing: -0.5,
    },
    tagline: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: colors.textMuted,
      marginTop: Spacing.xs,
    },

    /* Card */
    card: {
      backgroundColor: withAlpha(colors.surface, 'E8'),
      borderRadius: Radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.lg,
    },
    cardTitle: {
      fontFamily: Fonts.bold,
      fontSize: 22,
      color: colors.text,
    },

    /* Fields */
    field: {
      gap: Spacing.xs + 2,
    },
    label: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      color: colors.textSub,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      height: 52,
      gap: Spacing.sm + 2,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontFamily: Fonts.medium,
      fontSize: 15,
      height: '100%',
    },
    hint: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.textMuted,
    },
    errorHint: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.error,
    },

    /* Buttons */
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      height: 52,
      borderRadius: Radii.md,
      backgroundColor: colors.accent,
      marginTop: Spacing.xs,
    },
    primaryBtnDisabled: {
      backgroundColor: withAlpha(colors.accent, '40'),
    },
    primaryBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 16,
      color: '#fff',
    },

    /* Footer */
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: Spacing.xl,
    },
    footerText: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: colors.textMuted,
    },
    footerLink: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: colors.accent,
    },
  });
