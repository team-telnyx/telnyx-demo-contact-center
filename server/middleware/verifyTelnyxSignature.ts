import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Verify Telnyx webhook signature (Ed25519).
 */

let warned = false;

function buildEd25519PublicKey(base64Raw: string): crypto.KeyObject {
  const raw = Buffer.from(base64Raw, 'base64');
  if (raw.length !== 32) {
    throw new Error(
      `TELNYX_PUBLIC_KEY must decode to 32 raw bytes (got ${raw.length}). ` +
      'Paste the public key from the Telnyx portal exactly as shown.',
    );
  }
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const spki = Buffer.concat([spkiPrefix, raw]);
  return crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

export function verifyTelnyxSignature(publicKeyBase64: string | undefined) {
  const disabled = process.env.WEBHOOK_VERIFY_DISABLED === 'true' || !publicKeyBase64;
  if (disabled) {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (!warned) {
        warned = true;
        console.warn(
          '[verifyTelnyxSignature] ⚠️  Webhook signature verification is DISABLED ' +
          '(set TELNYX_PUBLIC_KEY and remove WEBHOOK_VERIFY_DISABLED to enable).',
        );
      }
      if (Buffer.isBuffer(req.body)) {
        try { req.body = JSON.parse(req.body.toString('utf8')); } catch (_) {}
      }
      next();
    };
  }

  let publicKey: crypto.KeyObject;
  try {
    publicKey = buildEd25519PublicKey(publicKeyBase64);
  } catch (err: any) {
    return (_req: Request, res: Response, _next: NextFunction) => res.status(500).json({ error: err.message });
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['telnyx-signature-ed25519'] as string | undefined;
    const timestamp = req.headers['telnyx-timestamp'] as string | undefined;

    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing Telnyx signature headers' });
    }

    const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(ageSec) || ageSec > 300) {
      return res.status(401).json({ error: 'Stale or invalid timestamp' });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf8');

    const signed = Buffer.concat([
      Buffer.from(`${timestamp}|`, 'utf8'),
      rawBody,
    ]);

    let valid = false;
    try {
      valid = crypto.verify(null, signed, publicKey, Buffer.from(signature, 'base64'));
    } catch (err) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    if (!valid) {
      return res.status(401).json({ error: 'Invalid Telnyx signature' });
    }

    try { req.body = JSON.parse(rawBody.toString('utf8')); } catch (_) {}
    next();
  };
}
