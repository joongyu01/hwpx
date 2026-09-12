#!/usr/bin/env node
// 내용(JSON) + 서식(hwpx) → 공문 hwpx
//
//   node build.js 내용.json                         기본 서식으로 현재 폴더에 저장
//   node build.js 내용.json -o 결과.hwpx             저장 경로 지정
//   node build.js 내용.json --out-dir ./out          폴더만 지정(파일명 자동)
//   node build.js 내용.json --template 우리팀.hwpx   다른 서식 사용
//   node build.js 내용.json --check                  검사만 하고 저장하지 않음
const fs = require('fs');
const path = require('path');
const core = require('./core.js');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const input = args.find((a, i) => !a.startsWith('-') && !['-o', '--out-dir', '--template'].includes(args[i - 1]));

if (!input) {
  console.error('사용: node build.js <내용.json> [-o 결과.hwpx | --out-dir 폴더] [--template 서식.hwpx] [--check]');
  process.exit(1);
}

(async () => {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new Error('JSON 을 읽을 수 없습니다: ' + e.message);
  }

  const { errors, warnings } = core.validateSpec(spec);
  warnings.forEach((w) => console.warn('주의: ' + w));
  if (errors.length) {
    errors.forEach((e) => console.error('오류: ' + e));
    process.exit(2);
  }
  if (args.includes('--check')) { console.log('검사 통과'); return; }

  const templatePath = opt('--template') || path.join(__dirname, '..', 'templates', 'default.hwpx');
  const template = await core.loadTemplate(new Uint8Array(fs.readFileSync(templatePath)));
  const bytes = await core.buildHwpx(spec, template);

  const out = opt('-o') || path.join(opt('--out-dir') || process.cwd(), core.suggestFileName(spec));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, bytes);
  console.log('저장: ' + path.resolve(out));
})().catch((e) => { console.error(e.message); process.exit(1); });
