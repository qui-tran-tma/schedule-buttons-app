// Pure encode/decode of the BLE frames. No ble-plx here (unit-testable).
import './textEncoding';
import { ErrorCode, Request, Response } from '@/proto/power_board';
import { MAX_FRAME } from './constants';

export type RequestPayload = NonNullable<Request['payload']>;
export type ResponsePayload = NonNullable<Response['payload']>;

export function encodeRequest(seq: number, payload: RequestPayload): Uint8Array {
  const bytes = Request.encode({ seq, payload }).finish();
  if (bytes.length > MAX_FRAME) {
    throw new Error(`request frame ${bytes.length} B exceeds ${MAX_FRAME} B`);
  }
  return bytes;
}

export function decodeResponse(bytes: Uint8Array): Response {
  return Response.decode(bytes);
}

const ERROR_TEXT: Record<ErrorCode, string> = {
  [ErrorCode.ERROR_NONE]: 'OK',
  [ErrorCode.ERROR_DECODE]: 'Board could not decode the request',
  [ErrorCode.ERROR_BAD_CHANNEL]: 'No such relay channel',
  [ErrorCode.ERROR_UNKNOWN_REQUEST]: 'Board does not know this request (firmware too old?)',
  [ErrorCode.ERROR_BAD_BUTTON]: 'No such button',
  [ErrorCode.ERROR_BAD_ARGS]: 'Value out of range',
  [ErrorCode.ERROR_BUSY]: 'Device is busy (pressing or moving) - stop it first',
  [ErrorCode.ERROR_UNSUPPORTED]: 'Not supported on this device profile',
  [ErrorCode.ERROR_BAD_SCHEDULE]: 'Bad schedule (slot, empty slot or wrong action)',
  [ErrorCode.ERROR_STORAGE]: 'Board flash write failed',
  [ErrorCode.UNRECOGNIZED]: 'Unknown error',
};

export function errorText(code: ErrorCode): string {
  return ERROR_TEXT[code] ?? `Error ${code}`;
}

export class BoardError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly response?: Response,
  ) {
    super(errorText(code));
    this.name = 'BoardError';
  }
}

export class RequestTimeoutError extends Error {
  constructor(readonly seq: number, readonly kind: string) {
    super(`No reply to ${kind} (seq ${seq}) within timeout`);
    this.name = 'RequestTimeoutError';
  }
}
