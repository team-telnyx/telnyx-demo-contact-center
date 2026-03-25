import express from 'express';
import multer from 'multer';
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { authenticate } from '../src/middleware/auth.js';
import Settings from '../models/Settings.js';

const router = express.Router();

const TELNYX_STORAGE_REGION = 'us-central-1';
const TELNYX_STORAGE_ENDPOINT = `https://${TELNYX_STORAGE_REGION}.telnyxcloudstorage.com`;

// Multer config: memory storage, 10MB max, audio files only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3', 'audio/x-wav'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only mp3, wav, ogg, and webm audio files are allowed'));
    }
  },
});

router.use(authenticate);

// Helper: get S3-compatible Telnyx Storage client
async function getStorageClient() {
  const row = await Settings.findByPk('orgTelnyxApiKey');
  if (!row?.value) throw new Error('No organization Telnyx API key configured.');
  return new S3Client({
    endpoint: TELNYX_STORAGE_ENDPOINT,
    region: TELNYX_STORAGE_REGION,
    credentials: {
      accessKeyId: row.value,
      secretAccessKey: row.value,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

// Helper: get bucket name from settings
async function getBucketName() {
  const row = await Settings.findByPk('storageBucketName');
  if (!row?.value) throw new Error('No storage bucket configured. Set it in Admin > Settings.');
  return row.value;
}

// Helper: get/save audio files metadata
async function getAudioFilesMeta() {
  const row = await Settings.findByPk('audioFiles');
  if (!row?.value) return [];
  try { return JSON.parse(row.value); } catch { return []; }
}
async function saveAudioFilesMeta(files) {
  await Settings.upsert({ key: 'audioFiles', value: JSON.stringify(files) });
}

// GET /api/audio - List audio files
router.get('/', async (_req, res) => {
  try {
    const files = await getAudioFilesMeta();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio - Upload audio file to Telnyx Storage
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const s3 = await getStorageClient();
    const bucketName = await getBucketName();
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Upload directly via S3 PutObject
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    // Public URL for the file
    const publicUrl = `${TELNYX_STORAGE_ENDPOINT}/${bucketName}/${fileName}`;

    // Save metadata
    const files = await getAudioFilesMeta();
    const fileMeta = {
      fileName,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.username,
    };
    files.push(fileMeta);
    await saveAudioFilesMeta(files);

    console.log(`[Audio] Uploaded ${fileName} to bucket ${bucketName}`);
    res.status(201).json({ file: fileMeta });
  } catch (err) {
    console.error('[Audio] Upload failed:', err.name, err.message, err.Code, err.$metadata);
    res.status(500).json({ error: `${err.name}: ${err.message}` });
  }
});

// DELETE /api/audio/:filename - Delete audio file
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const s3 = await getStorageClient();
    const bucketName = await getBucketName();

    // Delete from Telnyx Storage
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: filename,
      }));
    } catch (err) {
      console.warn(`[Audio] Could not delete ${filename} from storage:`, err.message);
    }

    // Remove from metadata
    const files = await getAudioFilesMeta();
    const filtered = files.filter((f) => f.fileName !== filename);
    await saveAudioFilesMeta(filtered);

    console.log(`[Audio] Deleted ${filename}`);
    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error('[Audio] Delete failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audio/create-bucket - Create the storage bucket
router.post('/create-bucket', async (req, res) => {
  try {
    const s3 = await getStorageClient();
    const bucketName = await getBucketName();

    // Create bucket
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`[Audio] Created bucket: ${bucketName}`);

    // Set public read policy
    try {
      await s3.send(new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucketName}/*`,
          }],
        }),
      }));
      console.log(`[Audio] Set public read policy on ${bucketName}`);
    } catch (policyErr) {
      console.warn(`[Audio] Could not set public policy:`, policyErr.message);
    }

    res.json({ message: `Bucket "${bucketName}" created successfully` });
  } catch (err) {
    // Bucket may already exist
    if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists' || err.Code === 'BucketAlreadyOwnedByYou') {
      return res.json({ message: `Bucket "${await getBucketName()}" already exists` });
    }
    console.error('[Audio] Create bucket failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
