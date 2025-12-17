/**
 * Get base64 encoded hold music MP3
 * This loads the MP3 file once and caches it in memory
 *
 * In Cloudflare Workers, this will return null since file system access is not available
 */
let cachedBase64Audio = null;

export async function getHoldMusicBase64() {
  if (cachedBase64Audio) {
    return cachedBase64Audio;
  }

  // Check if we're in a Node.js environment (has fs module)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // Dynamic imports for Node.js-only modules
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

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

  // In Workers environment, return null (hold music feature not available)
  console.warn('⚠️ Hold music not available in Cloudflare Workers environment');
  return null;
}
