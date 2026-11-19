// Pure vanilla Node.js static server - Zero dependencies required!
// Works immediately with your installed Node.js runtime.
//
// Optional environment variables:
//   PORT=8080       change the listening port
//   HOST=127.0.0.1  change the binding address (use 0.0.0.0 for LAN testing)
//   NO_OPEN=1       disable auto-opening the browser

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = /^\d+$/.test(process.env.PORT || '') ? Number(process.env.PORT) : 8080;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let pathname;

  try {
    // decodeURIComponent throws on malformed sequences such as "%ZZ".
    pathname = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('400 Bad Request');
    return;
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  // Resolve to an absolute path and confirm it stays inside the project folder.
  const filePath = path.resolve(ROOT_DIR, '.' + pathname);
  const relative = path.relative(ROOT_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=UTF-8',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = path.basename(filePath) === 'manifest.json'
      ? 'application/manifest+json; charset=UTF-8'
      : (MIME_TYPES[ext] || 'application/octet-stream');

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}/index.html`;
  console.log('Starting Voice Translator server...');
  console.log(`Server running at ${url}`);
  console.log('Press Ctrl+C to stop.');

  if (!process.env.NO_OPEN) {
    // Auto-open in the default browser.
    const startCmd = process.platform === 'win32'
      ? `start "" "${url}"`
      : `open "${url}"`;
    exec(startCmd, (error) => {
      if (error) console.log(`Open your browser and navigate to: ${url}`);
    });
  }
});
