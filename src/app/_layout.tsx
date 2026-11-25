import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DeviceProvider } from '@/devices/DeviceContext';
import { colors } from '@/components/ui';

export default function RootLayout() {
  return (
    <DeviceProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" options={{ title: 'Devices' }} />
        <Stack.Screen name="device" options={{ title: 'Device' }} />
      </Stack>
    </DeviceProvider>
  );
}
