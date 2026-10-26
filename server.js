const http = require('http');
const fs = require('fs');
const path = require('path');
const streamHandler = require('./api/stream');

const PORT = 3456;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Route streaming proxy Google Drive
  if (reqUrl.pathname === '/api/stream') {
    return streamHandler(req, res);
  }

  // Serve static files
  let safePath = decodeURIComponent(reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname);
  let filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Server proxy sudah berjalan di http://localhost:${PORT}`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  Digital Signage Stream Proxy Aktif!`);
  console.log(`  URL Lokal : http://localhost:${PORT}`);
  console.log(`  Stream API: http://localhost:${PORT}/api/stream`);
  console.log(`===================================================`);
});
