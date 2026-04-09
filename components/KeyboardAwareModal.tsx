/**
 * Drop-in replacement for React Native's `<Modal>` that wraps its children
 * in a `KeyboardAvoidingView`. This ensures TextInputs inside modals stay
 * visible above the on-screen keyboard on both iOS and Android — something
 * the ScreenShell-level KAV can't do because Modals mount outside the
 * component tree.
 *
 * Usage: swap `<Modal ...>` for `<KeyboardAwareModal ...>` — the props
 * interface is identical.
 */
import type { ReactNode } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  type ModalProps,
} from 'react-native';

type Props = ModalProps & { children: ReactNode };

export default function KeyboardAwareModal({ children, ...modalProps }: Props) {
  return (
    <Modal {...modalProps}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}
