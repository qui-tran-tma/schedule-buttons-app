import { useState } from 'react';
import { Text, View } from 'react-native';
import { clamp, DEFAULT_GAP_MS, parseNum, press, SINGLE_CLICK_HOLD_MS } from '@/devices/buttons';
import { useDevice } from '@/devices/DeviceContext';
import { PressButton } from '@/proto/power_board';
import { Btn, Card, Field, styles } from './ui';

const BUTTON_ID = 1;

export function ButtonTesterPanel() {
  const { status, state, request } = useDevice();
  const pressing = status?.buttons.find((b) => b.buttonId === BUTTON_ID)?.pressing ?? false;
  const [sending, setSending] = useState(false);
  const [nClicks, setNClicks] = useState('3');
  const [nHold, setNHold] = useState(String(SINGLE_CLICK_HOLD_MS));
  const [nGap, setNGap] = useState(String(DEFAULT_GAP_MS));
  const [holdSec, setHoldSec] = useState('6');

  const disabled = state !== 'connected' || pressing || sending;

  const send = async (p: PressButton) => {
    setSending(true);
    try {
      await request({ $case: 'pressButton', pressButton: p });
    } catch {
      // banner
    } finally {
      setSending(false);
    }
  };

  const n = parseNum(nClicks);
  const hold = parseNum(nHold);
  const gap = parseNum(nGap);
  const nValid = n !== null && Number.isInteger(n) && n >= 2 && n <= 10 && hold !== null && hold >= 50 && hold <= 30000
    && gap !== null && gap >= 100 && gap <= 10000;
  const sec = parseNum(holdSec);
  const secValid = sec !== null && sec > 5 && sec <= 30;

  return (
    <View style={{ gap: 12 }}>
      <Card title="Button 1">
        <Text style={[styles.text, { fontWeight: '600' }]}>{pressing ? 'Pressing…' : 'Idle'}</Text>
        <Btn
          title="Stop"
          variant="danger"
          disabled={state !== 'connected' || !pressing}
          onPress={() => void request({ $case: 'stopButton', stopButton: { buttonId: BUTTON_ID } }).catch(() => {})}
        />
      </Card>

      <Card title="Flic presets">
        <View style={styles.row}>
          <Btn title="1 click" disabled={disabled} onPress={() => void send(press(BUTTON_ID, 1, SINGLE_CLICK_HOLD_MS))} />
          <Btn
            title="2 clicks"
            disabled={disabled}
            onPress={() => void send(press(BUTTON_ID, 2, SINGLE_CLICK_HOLD_MS, DEFAULT_GAP_MS))}
          />
        </View>
      </Card>

      <Card title="N clicks">
        <View style={styles.row}>
          <Field label="Clicks (2-10)" value={nClicks} onChangeText={setNClicks} />
          <Field label="Hold" suffix="ms" value={nHold} onChangeText={setNHold} />
          <Field label="Gap" suffix="ms" value={nGap} onChangeText={setNGap} />
        </View>
        <Btn
          title={nValid ? `Press ${n} times` : 'Invalid values'}
          disabled={disabled || !nValid}
          onPress={() => void send(press(BUTTON_ID, clamp(n!, 2, 10), hold!, gap!))}
        />
      </Card>

      <Card title="Long hold (SOS)">
        <Field label="Hold (> 5 s)" suffix="s" value={holdSec} onChangeText={setHoldSec} keyboardType="decimal-pad" />
        <Btn
          title={secValid ? `Hold ${sec} s` : 'Hold must be 5-30 s'}
          disabled={disabled || !secValid}
          onPress={() => void send(press(BUTTON_ID, 1, Math.round(sec! * 1000)))}
        />
      </Card>
    </View>
  );
}
