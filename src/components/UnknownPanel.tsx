import { Text } from 'react-native';
import { useDevice } from '@/devices/DeviceContext';
import { Card, styles } from './ui';

export function UnknownPanel() {
  const { info, status } = useDevice();
  return (
    <Card title="Unknown device profile">
      <Text style={styles.muted}>This app version has no controls for this profile.</Text>
      <Text style={styles.mono}>{JSON.stringify({ info, status }, null, 2)}</Text>
    </Card>
  );
}
