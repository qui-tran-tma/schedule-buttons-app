import { Text, View } from 'react-native';
import { IDLE_TIMEOUT_MS } from '@/ble/constants';
import { useDevice } from '@/devices/DeviceContext';
import { formatBoardClock } from '@/devices/schedules';
import { Profile } from '@/proto/power_board';
import { Banner, Btn, Card, colors, styles } from './ui';

const PROFILE_NAMES: Record<number, string> = {
  [Profile.PROFILE_POWER_BOARD]: 'Power board',
  [Profile.PROFILE_BUTTON_TESTER]: 'Button tester',
  [Profile.PROFILE_SCHEDULED_BUTTON]: 'Scheduled button',
  [Profile.PROFILE_SCROLL_SERVO]: 'Scroll servo',
};

export function profileName(p: Profile | undefined): string {
  return p === undefined ? '-' : (PROFILE_NAMES[p] ?? `Unknown (${p})`);
}

export function DeviceHeader() {
  const { deviceName, state, info, status, error, setError, reconnect, disconnect } = useDevice();
  const dot = state === 'connected' ? colors.ok : state === 'connecting' ? '#f79009' : colors.danger;
  return (
    <View style={{ gap: 8 }}>
      <Card
        title={deviceName ?? 'Device'}
        right={
          state === 'disconnected' ? (
            <Btn title="Reconnect" onPress={() => void reconnect()} />
          ) : state === 'connected' ? (
            <Btn title="Disconnect" variant="secondary" onPress={() => void disconnect()} />
          ) : null
        }
      >
        <View style={styles.row}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
          <Text style={styles.text}>{state}</Text>
          {info && (
            <Text style={styles.muted}>
              {profileName(info.profile)} · fw {info.fwVersion || '?'}
            </Text>
          )}
        </View>
        {info && info.sleepIntervalS > 0 && (
          <Text style={styles.muted}>
            Battery device: full power while connected. App disconnects after {IDLE_TIMEOUT_MS / 60000} min
            idle, then the board sleeps (wakes every {info.sleepIntervalS}s).
          </Text>
        )}
        {status && (
          <Text style={styles.muted}>
            Board clock: {formatBoardClock(status.unixS, status.utcOffsetMin)} · up {status.uptimeS}s
          </Text>
        )}
      </Card>
      {status && status.unixS === 0 && (
        <Banner kind="warn" text="Board clock is not set - schedules are paused. Reconnect to sync the time." />
      )}
      {error && <Banner kind="error" text={error} onClose={() => setError(null)} />}
    </View>
  );
}
