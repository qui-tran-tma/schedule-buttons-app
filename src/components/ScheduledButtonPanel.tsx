import { useState } from 'react';
import { Text, View } from 'react-native';
import { SCHEDULED_PRESS } from '@/devices/buttons';
import { useDevice } from '@/devices/DeviceContext';
import { ScheduleSection } from './ScheduleSection';
import { Btn, Card, styles } from './ui';

const BUTTON_ID = 1;

export function ScheduledButtonPanel() {
  const { status, state, request } = useDevice();
  const pressing = status?.buttons.find((b) => b.buttonId === BUTTON_ID)?.pressing ?? false;
  const [sending, setSending] = useState(false);

  const pressNow = async () => {
    setSending(true);
    try {
      await request({ $case: 'pressButton', pressButton: { buttonId: BUTTON_ID, ...SCHEDULED_PRESS } });
    } catch {
      // banner
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card title="Button 1">
        <Text style={styles.text}>{pressing ? 'Pressing…' : 'Idle'}</Text>
        <View style={styles.row}>
          <Btn
            title="Press now"
            busy={sending}
            disabled={state !== 'connected' || pressing}
            onPress={() => void pressNow()}
          />
          <Btn
            title="Stop"
            variant="danger"
            disabled={state !== 'connected' || !pressing}
            onPress={() => void request({ $case: 'stopButton', stopButton: { buttonId: BUTTON_ID } }).catch(() => {})}
          />
        </View>
      </Card>
      <ScheduleSection
        title="Press schedules"
        newAction={{ $case: 'press', press: { buttonId: BUTTON_ID, ...SCHEDULED_PRESS } }}
      />
    </View>
  );
}
