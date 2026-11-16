import { Check, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';

import { GhostButton } from '@/components/ui/GhostButton';
import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { lightColors, radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  visible: boolean;
  onCancel: () => void;
  /** Prefills the name field; the customer corrects it if needed. */
  customerName?: string;
  onSubmit: (signatureSvg: string, signer: { name: string; consent: boolean }) => Promise<void>;
};

/** A full name: at least two letters once trimmed. Mirrors the server's check. */
function nameLooksFull(name: string): boolean {
  return (name.match(/\p{L}/gu) ?? []).length >= 2;
}

/**
 * The signature pad is a WebView, so the active palette has to be passed in
 * explicitly. The pad itself stays paper-white with an ink-black pen in both
 * modes: the stored SVG is later rendered on the white contract, and a
 * cream-on-black stroke would come out invisible there.
 */
const pad = { paper: lightColors.surface, pen: lightColors.ink };

function webStyleFor(colors: Colors): string {
  return `
  .m-signature-pad { box-shadow: none; border: 1px solid ${colors.divider}; border-radius: 14px; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body, html { background-color: ${pad.paper}; }
`;
}

export function SignatureModal({ visible, customerName, onCancel, onSubmit }: Props) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const webStyle = useMemo(() => webStyleFor(colors), [colors]);
  const ref = useRef<SignatureViewRef>(null);
  const [submitting, setSubmitting] = useState(false);
  const [empty, setEmpty] = useState(true);
  // Signing in person is the customer's own act on the contractor's phone, so
  // it asks what the signing web page asks: their name, and that they agree
  // to sign electronically. Both start fresh each time the sheet opens.
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    if (visible) {
      setName(customerName ?? '');
      setConsent(false);
      setEmpty(true);
    }
  }, [visible, customerName]);
  const ready = !empty && consent && nameLooksFull(name);

  const handleConfirm = () => {
    // `readSignature` triggers onOK with the SVG string below.
    ref.current?.readSignature();
  };

  const handleOK = async (svg: string) => {
    if (!svg) return;
    setSubmitting(true);
    try {
      await onSubmit(svg, { name: name.trim(), consent });
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
        <View style={[styles.sheet, { paddingBottom: spacing.xxxl + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Sign here</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              style={styles.closeButton}
              hitSlop={10}
            >
              <X size={22} color={colors.ink2} strokeWidth={2} />
            </Pressable>
          </View>

          <Input
            label="Customer's full name"
            placeholder="First and last name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="off"
            maxLength={120}
          />

          <View style={styles.canvasWrap}>
            <SignatureScreen
              ref={ref}
              onOK={handleOK}
              onEmpty={() => setEmpty(true)}
              onBegin={() => setEmpty(false)}
              webStyle={webStyle}
              dataURL=""
              imageType="image/svg+xml"
              backgroundColor={pad.paper}
              penColor={pad.pen}
            />
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((c) => !c)}
            style={styles.consentRow}
          >
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent ? <Check size={20} color={colors.ink} strokeWidth={2} /> : null}
            </View>
            <Text style={styles.consentText}>
              I agree to sign this agreement electronically. My signature makes it binding.
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <GhostButton label="Clear" onPress={handleClear} style={styles.footerButton} />
            <PrimaryButton
              label={submitting ? 'Signing…' : 'Confirm & sign'}
              onPress={handleConfirm}
              disabled={!ready}
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
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
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
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
      backgroundColor: pad.paper,
    },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 60,
    },
    checkbox: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.ink3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxOn: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    consentText: {
      flex: 1,
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      lineHeight: 20,
      color: colors.ink2,
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
      backgroundColor: colors.veil,
    },
  });
