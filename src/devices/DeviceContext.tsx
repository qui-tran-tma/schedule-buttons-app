// Connection + latest Status for the one connected board.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BoardClient } from '@/ble/client';
import { RequestPayload } from '@/ble/codec';
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
    try {
      return await c.request(payload);
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }, []);

  useEffect(() => () => void clientRef.current?.disconnect(), []);

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
