import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || 'uploads';

function getUploadDir(): string {
  const now = new Date();
  const dir = path.join(
    UPLOAD_ROOT,
    now.getFullYear().toString(),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0'),
  );
  return dir;
}

const storage = multer.diskStorage({
  destination: async (req: any, file: any, cb: any) => {
    const dir = getUploadDir();
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomUUID();
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'text/plain',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function fileFilter(req: any, file: any, cb: any) {
  if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
  cb(null, true);
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

export function isImageFile(mimetype: string): boolean { return mimetype.startsWith('image/'); }
export function isAudioFile(mimetype: string): boolean { return mimetype.startsWith('audio/'); }

export function getFileCategory(mimetype: string): string {
  if (isImageFile(mimetype)) return 'image';
  if (isAudioFile(mimetype)) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  return 'file';
}

export function getFileUrl(filepath: string): string {
  const relative = filepath.replace(UPLOAD_ROOT, '').replace(/^\/+/, '');
  return `/uploads/${relative}`;
}

export async function deleteFile(filepath: string) {
  try { await fs.unlink(filepath); } catch (err: any) { if (err.code !== 'ENOENT') throw err; }
}

export async function validateFileMagic(filePath: string, expectedMime: string): Promise<boolean> {
  const handle = await fs.open(filePath, 'r');
  const buffer = Buffer.alloc(12);
  await handle.read(buffer, 0, 12, 0);
  await handle.close();

  const header = buffer.toString('ascii', 0, 4);

  if (expectedMime === 'image/png' && !buffer.toString('ascii', 0, 4).startsWith('\x89PNG')) return false;
  if (expectedMime === 'image/jpeg' && (buffer[0] !== 0xFF || buffer[1] !== 0xD8)) return false;
  if (expectedMime === 'image/gif' && !header.startsWith('GIF8')) return false;
  if (expectedMime === 'image/webp' && !header.startsWith('RIFF')) return false;
  if (expectedMime === 'application/pdf' && !header.startsWith('%PDF')) return false;

  return true;
}

export { UPLOAD_ROOT, MAX_FILE_SIZE, MAX_IMAGE_SIZE };

/**
 * Download a media file from a URL (e.g. MMS attachment) and store it locally.
 * Returns { filePath, fileUrl, fileName }.
 */
export async function downloadAndStoreMedia(
  url: string,
  mimeType: string = 'application/octet-stream',
): Promise<{ filePath: string; fileUrl: string; fileName: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download media: ${res.status} ${res.statusText}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const dir = getUploadDir();
  await fs.mkdir(dir, { recursive: true });

  const ext = mimeTypeToExtension(mimeType);
  const unique = crypto.randomUUID();
  const fileName = `mms_${unique}${ext}`;
  const filePath = path.join(dir, fileName);

  await fs.writeFile(filePath, buffer);

  const fileUrl = getFileUrl(filePath);
  return { filePath, fileUrl, fileName };
}

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
  };
  return map[mimeType] || '.bin';
}
