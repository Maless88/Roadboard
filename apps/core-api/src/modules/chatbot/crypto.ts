import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';


const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;


function loadKey(): Buffer {

  const raw = process.env.CHATBOT_KEY;

  if (!raw) {
    throw new Error('CHATBOT_KEY environment variable is not set');
  }

  const key = Buffer.from(raw, 'base64');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`CHATBOT_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length})`);
  }

  return key;
}


// Encrypt plaintext with AES-256-GCM and return a self-contained
// base64 string in the form `iv | ciphertext | authTag`.
export function encryptApiKey(plaintext: string): string {

  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, enc, tag]).toString('base64');
}


export function decryptApiKey(payload: string): string {

  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');

  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Encrypted payload is malformed');
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);

  return dec.toString('utf8');
}
