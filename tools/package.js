// 배포 파일을 dist/ 에 만든다.
//   dist/hwpx-gongmun.skill   Claude 스킬 묶음(zip). claude.ai 스킬 올리기나 ~/.claude/skills 에 풀어 쓴다.
//   dist/공문생성기.html       인터넷 없이 더블클릭으로 여는 웹 생성기
const fs = require('fs');
const path = require('path');
const core = require('../skill/hwpx-gongmun/scripts/core.js');

const root = path.join(__dirname, '..');
const skillDir = path.join(root, 'skill', 'hwpx-gongmun');
const dist = path.join(root, 'dist');

function walk(dir, base) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    return e.isDirectory() ? walk(abs, rel) : [{ abs, rel }];
  });
}

(async () => {
  fs.mkdirSync(dist, { recursive: true });
  const entries = walk(skillDir, 'hwpx-gongmun').map(({ abs, rel }) => ({ name: rel, data: new Uint8Array(fs.readFileSync(abs)) }));
  // 일반 zip 이므로 mimetype 규칙과 무관하게 전부 압축한다.
  const bytes = await core.zip(entries);
  fs.writeFileSync(path.join(dist, 'hwpx-gongmun.skill'), bytes);
  fs.copyFileSync(path.join(root, 'web', 'index.html'), path.join(dist, '공문생성기.html'));
  console.log('dist/hwpx-gongmun.skill', entries.length + '개 파일', Math.round(bytes.length / 1024) + 'KB');
  console.log('dist/공문생성기.html');
})().catch((e) => { console.error(e); process.exit(1); });
