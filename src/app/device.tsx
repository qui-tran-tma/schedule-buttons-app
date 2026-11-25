import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { ButtonTesterPanel } from '@/components/ButtonTesterPanel';
import { DeviceHeader } from '@/components/DeviceHeader';
import { PowerBoardPanel } from '@/components/PowerBoardPanel';
import { ScheduledButtonPanel } from '@/components/ScheduledButtonPanel';
import { ScrollServoPanel } from '@/components/ScrollServoPanel';
import { styles } from '@/components/ui';
import { UnknownPanel } from '@/components/UnknownPanel';
import { useDevice } from '@/devices/DeviceContext';
import { Profile } from '@/proto/power_board';

export default function DeviceScreen() {
  const { deviceName, state, info, disconnect } = useDevice();

  // Leaving the device screen ends the session. Backgrounding the app does not:
  // DeviceProvider keeps the link alive and drops it after IDLE_TIMEOUT_MS idle.
  useEffect(() => () => void disconnect(), [disconnect]);

  let body;
  if (!info) {
    body =
      state === 'connecting' ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <Text style={styles.muted}>Not connected.</Text>
      );
  } else if (info.profile === Profile.PROFILE_POWER_BOARD) {
    body = <PowerBoardPanel />;
  } else if (info.profile === Profile.PROFILE_BUTTON_TESTER) {
    body = <ButtonTesterPanel />;
  } else if (info.profile === Profile.PROFILE_SCHEDULED_BUTTON) {
    body = <ScheduledButtonPanel />;
  } else if (info.profile === Profile.PROFILE_SCROLL_SERVO) {
    body = <ScrollServoPanel />;
  } else {
    body = <UnknownPanel />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: deviceName ?? 'Device' }} />
      <DeviceHeader />
      {body}
    </ScrollView>
  );
}
