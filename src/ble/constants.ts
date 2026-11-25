// BLE contract. See ../../../CLAUDE.md and schedule-power-board/proto/power_board.proto.
export const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
/** app -> board, write with response, one encoded Request per write */
export const RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
/** board -> app, notify, one encoded Response per notification */
export const TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export const ANDROID_MTU = 185;
/** protocol::kMaxFrame on the board */
export const MAX_FRAME = 128;
export const REQUEST_TIMEOUT_MS = 3000;
/** App drops the link after this long with no user request (also covers time in background). */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
/** Keepalive GetStatus period. Below the shortest board idle_disconnect_s (60 s) so the board never drops first. */
export const KEEPALIVE_MS = 20 * 1000;
