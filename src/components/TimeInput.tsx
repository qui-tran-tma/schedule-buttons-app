import { Text, View } from 'react-native';
import { Btn, styles } from './ui';

/** Simple HH:MM stepper (minute_of_day 0..1439). */
export function TimeInput({ value, onChange }: { value: number; onChange(v: number): void }) {
  const h = Math.floor(value / 60);
  const m = value % 60;
  const set = (hh: number, mm: number) => onChange(((hh + 24) % 24) * 60 + ((mm + 60) % 60));
  return (
    <View style={[styles.row, { justifyContent: 'center' }]}>
      <Stepper label={String(h).padStart(2, '0')} onDec={() => set(h - 1, m)} onInc={() => set(h + 1, m)} />
      <Text style={{ fontSize: 28, fontWeight: '700' }}>:</Text>
      <Stepper
        label={String(m).padStart(2, '0')}
        onDec={() => set(h, m - 5)}
        onInc={() => set(h, m + 5)}
        onDec1={() => set(h, m - 1)}
        onInc1={() => set(h, m + 1)}
      />
    </View>
  );
}

function Stepper(props: { label: string; onDec(): void; onInc(): void; onDec1?(): void; onInc1?(): void }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={styles.row}>
        {props.onInc1 && <Btn title="+1" variant="secondary" onPress={props.onInc1} />}
        <Btn title={props.onInc1 ? '+5' : '+'} variant="secondary" onPress={props.onInc} />
      </View>
      <Text style={{ fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{props.label}</Text>
      <View style={styles.row}>
        {props.onDec1 && <Btn title="-1" variant="secondary" onPress={props.onDec1} />}
        <Btn title={props.onDec1 ? '-5' : '-'} variant="secondary" onPress={props.onDec} />
      </View>
    </View>
  );
}
