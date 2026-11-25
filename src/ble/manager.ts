// ble-plx singleton, permissions, scanning.
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { SERVICE_UUID } from './constants';

let manager: BleManager | null = null;

export function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

/** Android runtime permissions. iOS prompts on first BLE use (Info.plist via config plugin). */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
  if (api >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(res).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/** Resolve when the adapter is PoweredOn; reject on Unsupported/Unauthorized or after timeoutMs. */
export function waitPoweredOn(timeoutMs = 5000): Promise<void> {
  const m = getManager();
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.remove();
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Bluetooth is off')), timeoutMs);
    const sub = m.onStateChange((state) => {
      if (state === State.PoweredOn) finish();
      else if (state === State.Unsupported) finish(new Error('Bluetooth LE not supported'));
      else if (state === State.Unauthorized) finish(new Error('Bluetooth permission denied'));
    }, true);
  });
}

export interface ScanResult {
  id: string;
  name: string;
  rssi: number | null;
}

/** Scan by service UUID (not by name). Returns a stop function. */
export function startScan(onDevice: (d: ScanResult) => void, onError: (e: Error) => void): () => void {
  const m = getManager();
  m.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (error, device: Device | null) => {
    if (error) {
      onError(error);
      return;
    }
    if (device) {
      onDevice({ id: device.id, name: device.localName ?? device.name ?? 'Unnamed', rssi: device.rssi });
    }
  }).catch(onError);
  return () => {
    m.stopDeviceScan().catch(() => {});
  };
}
