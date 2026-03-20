const { createServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Cert locations to try in order
const CERT_PATHS = [
  { key: '/etc/letsencrypt/live/telnyx.solutions/privkey.pem', cert: '/etc/letsencrypt/live/telnyx.solutions/fullchain.pem' },
  { key: path.join(__dirname, 'certs', 'key.pem'), cert: path.join(__dirname, 'certs', 'cert.pem') },
];

function readCerts() {
  for (const { key, cert } of CERT_PATHS) {
    try {
      if (fs.existsSync(key) && fs.existsSync(cert)) {
        return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
      }
    } catch { /* try next */ }
  }
  return null;
}

function generateSelfSignedCerts() {
  const certsDir = path.join(__dirname, 'certs');
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  console.log('Generating self-signed certificate...');
  fs.mkdirSync(certsDir, { recursive: true });
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`,
    { stdio: 'pipe' }
  );
  console.log('Self-signed certificate created at client/certs/');
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

app.prepare().then(() => {
  let httpsOpts = readCerts();

  if (!httpsOpts) {
    try {
      httpsOpts = generateSelfSignedCerts();
    } catch (err) {
      console.warn('Could not generate self-signed certs:', err.message);
    }
  }

  if (httpsOpts) {
    const server = createServer(httpsOpts, (req, res) => {
      handle(req, res, parse(req.url, true));
    });
    server.listen(port, hostname, () => {
      console.log(`> HTTPS Ready on https://localhost:${port}`);
    });
  } else {
    console.log('No TLS available, falling back to HTTP');
    const server = createHttpServer((req, res) => {
      handle(req, res, parse(req.url, true));
    });
    server.listen(port, hostname, () => {
      console.log(`> HTTP Ready on http://localhost:${port}`);
    });
  }
});
