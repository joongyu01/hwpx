// web/ 폴더를 http://localhost:5190 으로 띄운다. index.html 은 파일을 직접 열어도 동작하므로 개발 확인용이다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'web');
const port = +process.env.PORT || 5190;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.hwpx': 'application/hwp+zip' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('http://localhost:' + port));
