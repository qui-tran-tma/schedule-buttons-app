import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { requestBlePermissions, ScanResult, startScan, waitPoweredOn } from '@/ble/manager';
import { Banner, Btn, colors, styles } from '@/components/ui';
import { errorMessage, useDevice } from '@/devices/DeviceContext';

// Battery devices deep-sleep up to 60 s between 2 s advertising windows
// (DeviceInfo.sleep_interval_s). Scan long enough to catch one wake.
const SCAN_MS = 75000;

export default function DevicesScreen() {
  const { connect } = useDevice();
  const [devices, setDevices] = useState<Record<string, ScanResult>>({});
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Stop the native scan (refs only, no state). */
  const stopNative = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const stop = useCallback(() => {
    stopNative();
    setScanning(false);
  }, [stopNative]);

  const scan = useCallback(async () => {
    stopNative();
    try {
      if (!(await requestBlePermissions())) throw new Error('Bluetooth permission denied');
      await waitPoweredOn();
    } catch (e) {
      setScanning(false);
      setError(errorMessage(e));
      return;
    }
    setError(null);
    setDevices({});
    setScanning(true);
    stopRef.current = startScan(
      (d) => setDevices((prev) => ({ ...prev, [d.id]: d })),
      (e) => {
        setError(`Scan failed: ${e.message}`);
        stop();
      },
    );
    timerRef.current = setTimeout(stop, SCAN_MS);
  }, [stop, stopNative]);

  // Auto-scan once on mount. Deferred so no setState runs synchronously in the effect.
  useEffect(() => {
    const t = setTimeout(() => void scan(), 0);
    return () => {
      clearTimeout(t);
      stopNative();
    };
  }, [scan, stopNative]);

  const open = (d: ScanResult) => {
    stop();
    void connect(d.id, d.name);
    router.push('/device');
  };

  const list = Object.values(devices).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      {error && <Banner kind="error" text={error} onClose={() => setError(null)} />}
      <Btn title={scanning ? 'Scanning…' : 'Scan'} busy={scanning} onPress={() => void scan()} />
      <FlatList
        data={list}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>
            {scanning
              ? 'Looking for devices… Battery devices wake about once a minute.'
              : 'No devices found. Power the board and scan again.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Connect to ${item.name}`}
            onPress={() => open(item)}
            style={({ pressed }) => ({
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[styles.text, { fontWeight: '600', fontSize: 17 }]}>{item.name}</Text>
            <Text style={styles.muted}>
              {item.id} · RSSI {item.rssi ?? '?'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
