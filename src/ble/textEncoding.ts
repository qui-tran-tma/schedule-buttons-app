// @bufbuild/protobuf needs globalThis.TextEncoder/TextDecoder for proto strings
// (DeviceInfo.fw_version). Install a minimal UTF-8 fallback only if the JS engine lacks them.
type G = { TextEncoder?: unknown; TextDecoder?: unknown };
const g = globalThis as unknown as G;

if (typeof g.TextEncoder === 'undefined') {
  g.TextEncoder = class {
    readonly encoding = 'utf-8';
    encode(input = ''): Uint8Array {
      const s = unescape(encodeURIComponent(input));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }
  };
}

if (typeof g.TextDecoder === 'undefined') {
  g.TextDecoder = class {
    readonly encoding = 'utf-8';
    decode(input?: Uint8Array): string {
      if (!input) return '';
      let s = '';
      for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]);
      try {
        return decodeURIComponent(escape(s));
      } catch {
        return s;
      }
    }
  };
}

export {};
