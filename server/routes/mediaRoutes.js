import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve hold music
router.get('/queue-music', (req, res) => {
  try {
    // Look for hold-music.mp3 in the server root (two levels up from routes/)
    const audioPath = path.join(__dirname, '..', 'hold-music.mp3');
    
    if (fs.existsSync(audioPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      fs.createReadStream(audioPath).pipe(res);
    } else {
      console.error(`Hold music file not found at: ${audioPath}`);
      res.status(404).send('Audio file not found');
    }
  } catch (error) {
    console.error('Error serving hold music:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
