import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

export const colors = {
  bg: '#f4f5f7',
  card: '#ffffff',
  text: '#16181d',
  muted: '#667085',
  border: '#d0d5dd',
  primary: '#1f6feb',
  danger: '#d92d20',
  warnBg: '#fff4e5',
  warnText: '#8a4b00',
  errBg: '#fdecea',
  ok: '#12b76a',
};

type Variant = 'primary' | 'secondary' | 'danger';

export function Btn(props: {
  title: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}) {
  const { title, onPress, disabled, busy, variant = 'primary', style } = props;
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.card;
  const fg = variant === 'secondary' ? colors.text : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        variant === 'secondary' && styles.btnSecondary,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.card}>
      {(title || right) && (
        <View style={styles.cardHead}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Banner({ kind, text, onClose }: { kind: 'warn' | 'error'; text: string; onClose?(): void }) {
  const warn = kind === 'warn';
  return (
    <View style={[styles.banner, { backgroundColor: warn ? colors.warnBg : colors.errBg }]}>
      <Text style={[styles.bannerText, { color: warn ? colors.warnText : colors.danger }]}>{text}</Text>
      {onClose && (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} hitSlop={12}>
          <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Field(props: TextInputProps & { label: string; suffix?: string }) {
  const { label, suffix, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput keyboardType="number-pad" style={[styles.input, style]} {...rest} />
        {suffix ? <Text style={styles.muted}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  btn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { borderWidth: 1, borderColor: colors.border },
  btnText: { fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, gap: 8 },
  bannerText: { flex: 1, fontSize: 14 },
  field: { gap: 4, flexGrow: 1 },
  fieldLabel: { fontSize: 13, color: colors.muted },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 64,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  mono: { fontFamily: 'Menlo', fontSize: 12, color: colors.text },
});
