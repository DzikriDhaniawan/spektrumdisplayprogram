const https = require('https');

// Gunakan persistent Keep-Alive TLS Agent agar tidak perlu ulang koneksi SSL/TLS ke Google Drive
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 32,
  maxFreeSockets: 10
});

function fetchFromDrive(targetUrl, rangeHeader, req, res, redirectCount = 0) {
  if (redirectCount > 5) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Too many redirects');
    }
    return;
  }

  const options = {
    agent: keepAliveAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Connection': 'keep-alive'
    }
  };

  if (rangeHeader) {
    options.headers['Range'] = rangeHeader;
  }

  const driveReq = https.get(targetUrl, options, (driveRes) => {
    // Handle redirects (301, 302, 303, 307, 308)
    if (driveRes.statusCode >= 300 && driveRes.statusCode < 400 && driveRes.headers.location) {
      driveRes.resume();
      return fetchFromDrive(driveRes.headers.location, rangeHeader, req, res, redirectCount + 1);
    }

    const headers = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=86400, immutable'
    };

    if (driveRes.headers['content-range']) {
      headers['Content-Range'] = driveRes.headers['content-range'];
    }
    if (driveRes.headers['content-length']) {
      headers['Content-Length'] = driveRes.headers['content-length'];
    }

    res.writeHead(driveRes.statusCode || 200, headers);
    driveRes.pipe(res);

    // Hentikan unduhan dari Google Drive segera jika user menutup/mengganti video
    req.on('close', () => {
      driveRes.destroy();
      driveReq.destroy();
    });
  });

  driveReq.on('error', (err) => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Stream error: ' + err.message);
    }
  });

  req.on('close', () => {
    driveReq.destroy();
  });
}

module.exports = function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const driveId = (req.query && req.query.id) || reqUrl.searchParams.get('id');

  if (!driveId || !/^[a-zA-Z0-9_-]+$/.test(driveId)) {
    res.statusCode = 400;
    return res.end('Invalid or missing Google Drive File ID');
  }

  // Teruskan Range header asli dari browser secara langsung (continuous streaming tanpa dipotong-potong 3MB)
  const clientRange = req.headers.range || 'bytes=0-';
  const driveUrl = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;

  fetchFromDrive(driveUrl, clientRange, req, res);
};
