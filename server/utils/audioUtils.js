const fs = require('fs');
const path = require('path');

/**
 * Get base64 encoded hold music MP3
 * This loads the MP3 file once and caches it in memory
 */
let cachedBase64Audio = null;

function getHoldMusicBase64() {
  if (cachedBase64Audio) {
    return cachedBase64Audio;
  }

  try {
    const audioPath = path.join(__dirname, '..', 'hold-music.mp3');
    const audioBuffer = fs.readFileSync(audioPath);
    cachedBase64Audio = audioBuffer.toString('base64');
    console.log('✅ Hold music loaded and encoded to base64 (size:', Math.round(cachedBase64Audio.length / 1024), 'KB)');
    return cachedBase64Audio;
  } catch (error) {
    console.error('❌ Error loading hold music file:', error.message);
    return null;
  }
}

module.exports = {
  getHoldMusicBase64
};
