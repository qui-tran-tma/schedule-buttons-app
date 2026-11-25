// One connected board: RX write, TX notify, seq matching via PendingRequests.
import { Platform } from 'react-native';
import { BleManager, Subscription } from 'react-native-ble-plx';
import { Response } from '@/proto/power_board';
import { base64ToBytes, bytesToBase64 } from './base64';
import { decodeResponse, encodeRequest, RequestPayload } from './codec';
import { ANDROID_MTU, REQUEST_TIMEOUT_MS, RX_UUID, SERVICE_UUID, TX_UUID } from './constants';
import { PendingRequests } from './pending';

export interface ClientEvents {
  /** Every decoded Response, solicited or not (seq 0). */
  onResponse(r: Response): void;
  onDisconnect(error: Error | null): void;
}

export class BoardClient {
  private readonly pending = new PendingRequests();
  private subs: Subscription[] = [];
  /** Serialize requests: one in flight at a time keeps the board and Android GATT queue simple. */
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly manager: BleManager,
    readonly deviceId: string,
    private readonly events: ClientEvents,
  ) {}

  async connect(): Promise<void> {
    const device = await this.manager.connectToDevice(this.deviceId, {
      requestMTU: Platform.OS === 'android' ? ANDROID_MTU : undefined,
      timeout: 10000,
    });
    await device.discoverAllServicesAndCharacteristics();

    this.subs.push(
      this.manager.onDeviceDisconnected(this.deviceId, (error) => {
        this.teardown(new Error('Disconnected'));
        this.events.onDisconnect(error);
      }),
    );
    this.subs.push(
      this.manager.monitorCharacteristicForDevice(this.deviceId, SERVICE_UUID, TX_UUID, (error, ch) => {
        if (error || !ch?.value) return;
        let response: Response;
        try {
          response = decodeResponse(base64ToBytes(ch.value));
        } catch {
          return; // drop undecodable frame
        }
        this.pending.handle(response);
        this.events.onResponse(response);
      }),
    );
  }

  /** Send one Request; resolves with the matching Response, rejects on timeout / ErrorCode. */
  request(payload: RequestPayload, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
    const run = async () => {
      if (this.closed) throw new Error('Not connected');
      const seq = this.pending.nextSeq();
      const frame = encodeRequest(seq, payload);
      const reply = this.pending.wait(seq, payload.$case, timeoutMs);
      try {
        await this.manager.writeCharacteristicWithResponseForDevice(
          this.deviceId,
          SERVICE_UUID,
          RX_UUID,
          bytesToBase64(frame),
        );
      } catch (e) {
        this.pending.fail(seq, e instanceof Error ? e : new Error(String(e)));
      }
      return reply;
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  async disconnect(): Promise<void> {
    this.teardown(new Error('Disconnected'));
    await this.manager.cancelDeviceConnection(this.deviceId).catch(() => {});
  }

  private teardown(error: Error) {
    if (this.closed) return;
    this.closed = true;
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.pending.rejectAll(error);
  }
}
