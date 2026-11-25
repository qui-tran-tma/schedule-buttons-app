import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useDevice } from '@/devices/DeviceContext';
import { channelLabel } from '@/devices/schedules';
import { Channel } from '@/proto/power_board';
import { relayFilter, ScheduleSection } from './ScheduleSection';
import { Card, styles } from './ui';

export function PowerBoardPanel() {
  const { info, status, state, request } = useDevice();
  const [busy, setBusy] = useState<Channel | null>(null);
  const count = Math.min(info?.relayCount || 3, 3);
  const channels = [Channel.CHANNEL_1, Channel.CHANNEL_2, Channel.CHANNEL_3].slice(0, count);

  const setRelay = async (channel: Channel, powerOn: boolean) => {
    setBusy(channel);
    try {
      await request({ $case: 'setRelay', setRelay: { channel, powerOn } });
    } catch {
      // shown in banner
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card title="Relays">
        {channels.map((ch) => {
          const on = status?.relays.find((r) => r.channel === ch)?.powerOn ?? false;
          return (
            <View key={ch} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 4 }]}>
              <View>
                <Text style={[styles.text, { fontWeight: '600' }]}>{channelLabel(ch)}</Text>
                <Text style={styles.muted}>{on ? 'Power ON' : 'Power OFF'}</Text>
              </View>
              <Switch
                accessibilityLabel={`${channelLabel(ch)} power`}
                value={on}
                disabled={state !== 'connected' || busy !== null}
                onValueChange={(v) => void setRelay(ch, v)}
              />
            </View>
          );
        })}
      </Card>
      {channels.map((ch) => (
        <ScheduleSection
          key={ch}
          title={`${channelLabel(ch)} schedules`}
          filter={relayFilter(ch)}
          newAction={{ $case: 'relay', relay: { channel: ch, powerOn: false } }}
        />
      ))}
    </View>
  );
}
