import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { RequestPayload } from '@/ble/codec';
import { useDevice } from '@/devices/DeviceContext';
import { cmToMm, formatCm, inRange } from '@/devices/scroll';
import { Btn, Card, Field, styles } from './ui';

// Board only notifies when a move ends; poll while moving to show live position.
const POLL_MS = 500;
const byCmKey = (deviceId: string) => `scroll.byCm.${deviceId}`;

export function ScrollServoPanel() {
  const { deviceId, info, status, state, request } = useDevice();
  const scroll = status?.scroll;
  const moving = scroll?.moving ?? false;
  const minMm = info?.scrollMinMm ?? 0;
  const maxMm = info?.scrollMaxMm ?? 0;
  const connected = state === 'connected';

  const [sending, setSending] = useState(false);
  const [byCm, setByCm] = useState('5');
  const [toCm, setToCm] = useState('0');
  const [setCm, setSetCm] = useState('0');
  /** Loop = clockwise by distance, then back to 0. True while the outbound move runs. */
  const [looping, setLooping] = useState(false);
  const loopCancel = useRef(false);
  const byLoaded = useRef(false);

  // Remember the Scroll by distance per device across connects.
  useEffect(() => {
    if (!deviceId) return;
    byLoaded.current = false;
    let cancelled = false;
    AsyncStorage.getItem(byCmKey(deviceId))
      .then((v) => {
        if (!cancelled && v !== null) setByCm(v);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) byLoaded.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId || !byLoaded.current) return;
    AsyncStorage.setItem(byCmKey(deviceId), byCm).catch(() => {});
  }, [deviceId, byCm]);


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
  const atZero = scroll !== undefined && pos === 0;
  const loopOk = atZero && cwOk;

  // Board rejects ScrollTo while moving (busy), so wait for the outbound move to end.
  const startLoop = async () => {
    loopCancel.current = false;
    setLooping(true);
    try {
      let r = await request({ $case: 'moveScroll', moveScroll: { deltaMm: byMm! } });
      const isMoving = () => r.payload?.$case === 'status' && (r.payload.status.scroll?.moving ?? false);
      while (isMoving() && !loopCancel.current) {
        await new Promise((ok) => setTimeout(ok, POLL_MS));
        r = await request({ $case: 'getStatus', getStatus: {} });
      }
      if (!loopCancel.current) await request({ $case: 'scrollTo', scrollTo: { positionMm: 0 } });
    } catch {
      // banner; disconnect also lands here
    } finally {
      setLooping(false);
    }
  };
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
          onPress={() => {
            loopCancel.current = true;
            void send({ $case: 'stopScroll', stopScroll: {} });
          }}
        />
      </Card>

      <Card title="Scroll by">
        <Field label="Distance" suffix="cm" value={byCm} onChangeText={setByCm} keyboardType="decimal-pad" />
        <View style={styles.row}>
          <Btn
            title={looping ? 'Looping…' : '⟳ Loop'}
            disabled={busy || moving || looping || !loopOk}
            onPress={() => void startLoop()}
          />
          <Btn
            title="↻ Clockwise"
            disabled={busy || looping || !cwOk}
            onPress={() => void send({ $case: 'moveScroll', moveScroll: { deltaMm: byMm! } })}
          />
          <Btn
            title="↺ Reverse"
            variant="secondary"
            disabled={busy || looping || !ccwOk}
            onPress={() => void send({ $case: 'moveScroll', moveScroll: { deltaMm: -byMm! } })}
          />
        </View>
        {byValid && (!cwOk || !ccwOk) && <Text style={styles.muted}>Would leave range {range}.</Text>}
        <Text style={styles.muted}>
          Loop: clockwise by distance, then back to 0 cm (push and release).
          {scroll && !atZero && !moving ? ' Only from 0 cm: go to 0 cm first.' : ''}
        </Text>
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
