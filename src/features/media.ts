/**
 * Photos are resized to at most 1280 px and saved as JPEG (quality 0.6) — a few hundred KB on a
 * slow connection. Photos and voice notes are kept in the app's documents folder until uploaded.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { getDb } from '../db/client';
import { queueAttachment, type AttachmentKind } from '../sync/attachments';
import { uuidv7 } from '../lib/uuid';

export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.6;

function folder(): Directory {
  const d = new Directory(Paths.document, 'attachments');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

/** Long side → 1280 px (never upscaled). */
export function resizeFor(width: number, height: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_SIDE) return null;
  return width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE };
}

/** Camera or gallery → compressed copy in app storage → upload queue. Returns the attachment clientId. */
export async function takePhoto(source: 'camera' | 'gallery', kind: AttachmentKind): Promise<string | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  const ctx = ImageManipulator.manipulate(asset.uri);
  const size = resizeFor(asset.width, asset.height);
  if (size) ctx.resize(size);
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  const dest = new File(folder(), `${uuidv7()}.jpg`);
  await new File(saved.uri).move(dest);
  return queueAttachment(getDb(), { localUri: dest.uri, kind, mimeType: 'image/jpeg' });
}

/** A finished recording → app storage → upload queue. */
export async function keepVoiceNote(uri: string): Promise<string> {
  const dest = new File(folder(), `${uuidv7()}.m4a`);
  await new File(uri).move(dest);
  return queueAttachment(getDb(), { localUri: dest.uri, kind: 'VOICE_NOTE', mimeType: 'audio/mp4' });
}
