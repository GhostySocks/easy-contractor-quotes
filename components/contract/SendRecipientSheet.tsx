import { Mail, MessageSquare, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GhostButton } from '@/components/ui/GhostButton';
import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export type Recipient = {
  name: string;
  email: string;
  phone: string;
};

export type SendChannels = {
  email: boolean;
  sms: boolean;
};

type Props = {
  visible: boolean;
  initialRecipient: Recipient;
  onCancel: () => void;
  onSend: (recipient: Recipient, channels: SendChannels) => Promise<void>;
};

export function SendRecipientSheet({ visible, initialRecipient, onCancel, onSend }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [name, setName] = useState(initialRecipient.name);
  const [email, setEmail] = useState(initialRecipient.email);
  const [phone, setPhone] = useState(initialRecipient.phone);
  const [emailOn, setEmailOn] = useState(!!initialRecipient.email);
  const [smsOn, setSmsOn] = useState(!!initialRecipient.phone);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialRecipient.name);
      setEmail(initialRecipient.email);
      setPhone(initialRecipient.phone);
      setEmailOn(!!initialRecipient.email);
      setSmsOn(!!initialRecipient.phone);
    }
  }, [visible, initialRecipient]);

  const errors = useMemo(
    () => validate({ email, phone, emailOn, smsOn }),
    [email, phone, emailOn, smsOn],
  );
  const canSend = !submitting && (emailOn || smsOn) && !errors.email && !errors.phone;

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      await onSend(
        { name: name.trim(), email: email.trim(), phone: phone.trim() },
        { email: emailOn, sms: smsOn },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Send to customer</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onCancel}
                style={styles.closeButton}
              >
                <X size={22} color={colors.ink2} strokeWidth={2} />
              </Pressable>
            </View>

            <Input
              label="Customer name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email ?? undefined}
            />

            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
              error={errors.phone ?? undefined}
            />

            <View style={styles.channels}>
              <ChannelToggle
                icon="mail"
                label="Email"
                on={emailOn}
                onToggle={() => setEmailOn((v) => !v)}
              />
              <ChannelToggle
                icon="sms"
                label="Text"
                on={smsOn}
                onToggle={() => setSmsOn((v) => !v)}
              />
            </View>

            <Text style={styles.hint}>
              Text messages open in your native Messages app so the customer gets it from your
              number. Email goes from us, branded to your business.
            </Text>

            <View style={styles.footer}>
              <GhostButton label="Cancel" onPress={onCancel} style={styles.footerButton} />
              <PrimaryButton
                label={submitting ? 'Sending…' : 'Send quote'}
                onPress={handleSend}
                disabled={!canSend}
                loading={submitting}
                style={styles.footerButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ChannelToggle({
  icon,
  label,
  on,
  onToggle,
}: {
  icon: 'mail' | 'sms';
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const Icon = icon === 'mail' ? Mail : MessageSquare;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label} channel`}
      onPress={onToggle}
      style={[styles.channel, on && styles.channelOn]}
    >
      <Icon size={18} color={on ? colors.ink : colors.ink3} strokeWidth={2} />
      <Text style={[styles.channelLabel, on && styles.channelLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[-\d\s().]{7,}$/;

function validate(input: { email: string; phone: string; emailOn: boolean; smsOn: boolean }): {
  email: string | null;
  phone: string | null;
} {
  const email =
    input.emailOn && input.email.trim() && !EMAIL_RE.test(input.email.trim())
      ? 'Looks incomplete'
      : null;
  const phone =
    input.smsOn && input.phone.trim() && !PHONE_RE.test(input.phone.trim())
      ? 'Looks incomplete'
      : null;
  return { email, phone };
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'flex-end',
    },
    sheetWrap: {
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
    channels: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    channel: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 48,
      borderRadius: radii.md,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    channelOn: {
      backgroundColor: colors.goldTint,
      borderColor: colors.gold,
    },
    channelLabel: {
      fontSize: typography.sizes.bodySmall,
      fontWeight: '600',
      color: colors.ink2,
    },
    channelLabelOn: {
      color: colors.ink,
      fontWeight: '700',
    },
    hint: {
      fontSize: typography.sizes.label,
      color: colors.ink3,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    footerButton: { flex: 1 },
  });
