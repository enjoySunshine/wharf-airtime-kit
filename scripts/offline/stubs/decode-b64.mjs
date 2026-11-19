/**
 * @videojs/vhs-utils/es/decode-b64-to-uint8-array.js 的离线替身。
 */
export default function decodeB64ToUint8Array(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
