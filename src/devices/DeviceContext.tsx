// Connection + latest Status for the one connected board.
import { AppState } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BoardClient } from '@/ble/client';
import { RequestPayload } from '@/ble/codec';
import { IDLE_TIMEOUT_MS, KEEPALIVE_MS } from '@/ble/constants';
import { getManager, requestBlePermissions, waitPoweredOn } from '@/ble/manager';
import { DeviceInfo, Response, Status } from '@/proto/power_board';

export type ConnState = 'disconnected' | 'connecting' | 'connected';

interface DeviceContextValue {
  deviceId: string | null;
  deviceName: string | null;
  state: ConnState;
  info: DeviceInfo | null;
  status: Status | null;
  /** Bumped on every seq=0 notification (press finished, schedule fired). */
  notifyCount: number;
  error: string | null;
  setError(msg: string | null): void;
  connect(id: string, name: string): Promise<void>;
  reconnect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Send a request; errors are surfaced in `error` and rethrown. */
  request(payload: RequestPayload): Promise<Response>;
}

const Ctx = createContext<DeviceContextValue | null>(null);

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<BoardClient | null>(null);
  /** Last user request or app background/foreground switch. Keepalives do not count. */
  const lastActivityRef = useRef(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [state, setState] = useState<ConnState>('disconnected');
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [notifyCount, setNotifyCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onResponse = useCallback((r: Response) => {
    if (r.payload?.$case === 'status') setStatus(r.payload.status);
    if (r.payload?.$case === 'info') setInfo(r.payload.info);
    if (r.seq === 0) setNotifyCount((n) => n + 1);
  }, []);

  const connect = useCallback(
    async (id: string, name: string) => {
      await clientRef.current?.disconnect();
      clientRef.current = null;
      setDeviceId(id);
      setDeviceName(name);
      setInfo(null);
      setStatus(null);
      setError(null);
      setState('connecting');
      lastActivityRef.current = Date.now();
      try {
        if (!(await requestBlePermissions())) throw new Error('Bluetooth permission denied');
        await waitPoweredOn();
        const client = new BoardClient(getManager(), id, {
          onResponse,
          onDisconnect: () => {
            if (clientRef.current === client) {
              clientRef.current = null;
              setState('disconnected');
            }
          },
        });
        clientRef.current = client;
        await client.connect();
        await client.request({ $case: 'getInfo', getInfo: {} });
        await client.request({
          $case: 'setTime',
          setTime: { unixS: Math.floor(Date.now() / 1000), utcOffsetMin: -new Date().getTimezoneOffset() },
        });
        await client.request({ $case: 'getStatus', getStatus: {} });
        setState('connected');
      } catch (e) {
        setError(`Connect failed: ${errorMessage(e)}`);
        await clientRef.current?.disconnect();
        clientRef.current = null;
        setState('disconnected');
      }
    },
    [onResponse],
  );

  const reconnect = useCallback(async () => {
    if (deviceId) await connect(deviceId, deviceName ?? deviceId);
  }, [connect, deviceId, deviceName]);

  const disconnect = useCallback(async () => {
    const c = clientRef.current;
    clientRef.current = null;
    setState('disconnected');
    await c?.disconnect();
  }, []);

  const request = useCallback(async (payload: RequestPayload) => {
    const c = clientRef.current;
    if (!c) {
      const e = new Error('Not connected');
      setError(e.message);
      throw e;
    }
    lastActivityRef.current = Date.now();
    try {
      return await c.request(payload);
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }, []);

  useEffect(() => () => void clientRef.current?.disconnect(), []);

  // Hold the link while connected, foreground or background, until the user disconnects
  // or IDLE_TIMEOUT_MS passes with no user request. Keepalive GetStatus resets the board's
  // own idle_disconnect_s timer (60-180 s on battery boards).
  useEffect(() => {
    if (state !== 'connected') return;
    const idleCheck = () => {
      if (Date.now() - lastActivityRef.current < IDLE_TIMEOUT_MS) return false;
      setError(`Disconnected after ${IDLE_TIMEOUT_MS / 60000} min idle`);
      void disconnect();
      return true;
    };
    const timer = setInterval(() => {
      if (idleCheck()) return;
      clientRef.current?.request({ $case: 'getStatus', getStatus: {} }).catch(() => {
        // Ignore: a lost link reports through onDisconnect.
      });
    }, KEEPALIVE_MS);
    const sub = AppState.addEventListener('change', (s) => {
      // iOS suspends JS timers in background: check elapsed time on return first.
      if (s === 'active' && idleCheck()) return;
      // Switching away (or back) restarts the 5 min window.
      if (s === 'active' || s === 'background') lastActivityRef.current = Date.now();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [state, disconnect]);

  const value = useMemo<DeviceContextValue>(
    () => ({
      deviceId,
      deviceName,
      state,
      info,
      status,
      notifyCount,
      error,
      setError,
      connect,
      reconnect,
      disconnect,
      request,
    }),
    [deviceId, deviceName, state, info, status, notifyCount, error, connect, reconnect, disconnect, request],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDevice(): DeviceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDevice outside DeviceProvider');
  return v;
}
