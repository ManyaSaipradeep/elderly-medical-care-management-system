import 'server-only';
import sharp from 'sharp';
import { one } from './db';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['jpeg', 'png', 'webp']);

/**
 * Validates by decoding (not by file name or browser-sent type), resizes to 900 px,
 * and re-encodes to JPEG. Re-encoding drops all metadata, including phone GPS location.
 * Returns the stored photo id, null when no file was sent, or 'invalid'.
 */
export async function savePhoto(circleId: string, file: FormDataEntryValue | null): Promise<string | null | 'invalid'> {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (file.size > MAX_BYTES) return 'invalid';
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !ALLOWED.has(meta.format)) return 'invalid';
    const out = await sharp(input).rotate().resize(900, 900, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const row = await one<{ id: string }>('insert into photos (circle_id, mime, bytes) values ($1, $2, $3) returning id', [circleId, 'image/jpeg', out]);
    return row!.id;
  } catch {
    return 'invalid';
  }
}
