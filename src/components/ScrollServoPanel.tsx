import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { RequestPayload } from '@/ble/codec';
import { useDevice } from '@/devices/DeviceContext';
import { cmToMm, formatCm, inRange } from '@/devices/scroll';
import { Btn, Card, Field, styles } from './ui';

// Board only notifies when a move ends; poll while moving to show live position.
const POLL_MS = 500;

export function ScrollServoPanel() {
  const { info, status, state, request } = useDevice();
  const scroll = status?.scroll;
  const moving = scroll?.moving ?? false;
  const minMm = info?.scrollMinMm ?? 0;
  const maxMm = info?.scrollMaxMm ?? 0;
  const connected = state === 'connected';

  const [sending, setSending] = useState(false);
  const [byCm, setByCm] = useState('5');
  const [toCm, setToCm] = useState('0');
  const [setCm, setSetCm] = useState('0');

  useEffect(() => {
    if (!connected || !moving) return;
    const t = setInterval(() => void request({ $case: 'getStatus', getStatus: {} }).catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [connected, moving, request]);

  const send = async (p: RequestPayload) => {
    setSending(true);
    try {
      await request(p);
    } catch {
      // banner
    } finally {
      setSending(false);
    }
  };

  const pos = scroll?.positionMm ?? 0;
  const byMm = cmToMm(byCm);
  const byValid = byMm !== null && byMm > 0;
  const cwOk = byValid && inRange(pos + byMm!, minMm, maxMm);
  const ccwOk = byValid && inRange(pos - byMm!, minMm, maxMm);
  const toMm = cmToMm(toCm);
  const toValid = toMm !== null && inRange(toMm, minMm, maxMm);
  const setMm = cmToMm(setCm);
  const setValid = setMm !== null && inRange(setMm, minMm, maxMm);
  const busy = !connected || sending;
  const range = `${formatCm(minMm)} - ${formatCm(maxMm)}`;

  return (
    <View style={{ gap: 12 }}>
      <Card title="String position">
        <Text style={[styles.text, { fontSize: 28, fontWeight: '700' }]}>{scroll ? formatCm(pos) : '-'}</Text>
        <Text style={styles.muted}>
          {moving ? `Moving to ${formatCm(scroll!.targetMm)}…` : 'Idle'} · range {range}
        </Text>
        <Btn
          title="Stop"
          variant="danger"
          disabled={!connected || !moving}
          onPress={() => void send({ $case: 'stopScroll', stopScroll: {} })}
        />
      </Card>

      <Card title="Scroll by">
        <Field label="Distance" suffix="cm" value={byCm} onChangeText={setByCm} keyboardType="decimal-pad" />
        <View style={styles.row}>
          <Btn
            title="↻ Clockwise"
            disabled={busy || !cwOk}
            onPress={() => void send({ $case: 'moveScroll', moveScroll: { deltaMm: byMm! } })}
          />
          <Btn
            title="↺ Reverse"
            variant="secondary"
            disabled={busy || !ccwOk}
            onPress={() => void send({ $case: 'moveScroll', moveScroll: { deltaMm: -byMm! } })}
          />
        </View>
        {byValid && (!cwOk || !ccwOk) && <Text style={styles.muted}>Would leave range {range}.</Text>}
      </Card>

      <Card title="Go to position">
        <Field label={`Target (${range})`} suffix="cm" value={toCm} onChangeText={setToCm} keyboardType="decimal-pad" />
        <Btn
          title={toValid ? `Go to ${formatCm(toMm!)}` : 'Out of range'}
          disabled={busy || !toValid}
          onPress={() => void send({ $case: 'scrollTo', scrollTo: { positionMm: toMm! } })}
        />
      </Card>

      <Card title="Calibrate">
        <Text style={styles.muted}>
          Position is estimated from run time and drifts. Wind the string to a known mark, then tell the
          board where it is.
        </Text>
        <Field label="Current position" suffix="cm" value={setCm} onChangeText={setSetCm} keyboardType="decimal-pad" />
        <Btn
          title={setValid ? `Set position to ${formatCm(setMm!)}` : 'Out of range'}
          variant="secondary"
          disabled={busy || moving || !setValid}
          onPress={() => void send({ $case: 'zeroScroll', zeroScroll: { positionMm: setMm! } })}
        />
      </Card>
    </View>
  );
}
