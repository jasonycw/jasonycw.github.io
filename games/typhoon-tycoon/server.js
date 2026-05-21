const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.argv[2], 10) || 8080;
const MAX_RETRIES = 5;

const types = {
  '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const root = path.resolve(__dirname, '..', '..');

function startServer(port, attempt) {
  const server = http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url.endsWith('/')) url += 'index.html';
    let fp = path.normalize(path.join(root, url));
    if (!fp.startsWith(root + path.sep) && fp !== root) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(fp, (err, c) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      let ext = path.extname(fp);
      if (fp.endsWith('main.js')) {
        const hash = crypto.createHash('md5').update(c).digest('hex');
        console.log('Serving main.js MD5:', hash, 'Size:', c.length);
      }
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(c);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} in use (attempt ${attempt}/${MAX_RETRIES}). Retrying in 1s...`);
      if (attempt < MAX_RETRIES) {
        server.close();
        setTimeout(() => startServer(port, attempt + 1), 1000);
      } else {
        console.error(`Gave up after ${MAX_RETRIES} attempts. Try a different port: node server.js <port>`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => { console.log('\nShutting down...'); server.close(); process.exit(0); });
  process.on('SIGTERM', () => { server.close(); process.exit(0); });
}

startServer(PORT, 1);
