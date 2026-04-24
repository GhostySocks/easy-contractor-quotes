import { X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';

import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (signatureSvg: string) => Promise<void>;
};

const WEBVIEW_STYLE = `
  .m-signature-pad { box-shadow: none; border: 1px solid ${colors.divider}; border-radius: 14px; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body, html { background-color: ${colors.surface}; }
`;

export function SignatureModal({ visible, onCancel, onSubmit }: Props) {
  const ref = useRef<SignatureViewRef>(null);
  const [submitting, setSubmitting] = useState(false);
  const [empty, setEmpty] = useState(true);

  const handleConfirm = () => {
    // `readSignature` triggers onOK with the SVG string below.
    ref.current?.readSignature();
  };

  const handleOK = async (svg: string) => {
    if (!svg) return;
    setSubmitting(true);
    try {
      await onSubmit(svg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    ref.current?.clearSignature();
    setEmpty(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Sign here</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              style={styles.closeButton}
            >
              <X size={22} color={colors.ink2} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.canvasWrap}>
            <SignatureScreen
              ref={ref}
              onOK={handleOK}
              onEmpty={() => setEmpty(true)}
              onBegin={() => setEmpty(false)}
              webStyle={WEBVIEW_STYLE}
              dataURL=""
              imageType="image/svg+xml"
              backgroundColor={colors.surface}
              penColor={colors.ink}
            />
          </View>

          <Text style={styles.hint}>
            Draw your signature above. By signing, you agree to the terms of the contract.
          </Text>

          <View style={styles.footer}>
            <GhostButton label="Clear" onPress={handleClear} style={styles.footerButton} />
            <PrimaryButton
              label={submitting ? 'Signing…' : 'Confirm & sign'}
              onPress={handleConfirm}
              disabled={empty}
              loading={submitting}
              style={styles.footerButton}
            />
          </View>

          {submitting ? (
            <View style={styles.submittingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasWrap: {
    height: 260,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  hint: {
    fontSize: typography.sizes.label,
    color: colors.ink3,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  footerButton: { flex: 1 },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
