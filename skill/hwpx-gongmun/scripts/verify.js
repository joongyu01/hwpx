// 만든 hwpx 가 한글에서 열릴 조건을 갖췄는지 기계적으로 점검한다.
//   node scripts/verify.js 결과.hwpx [--text]
// 점검: XML 문법, 서식 번호 참조 범위와 연속성, 글꼴 참조, 표 번호 중복, 줄 배치 정보, zip 첫 항목 mimetype 무압축
const fs = require('fs');
const core = require('./core.js');

const file = process.argv[2];
if (!file) { console.error('사용: node scripts/verify.js 결과.hwpx [--text]'); process.exit(1); }

function checkXml(name, xml) {
  // 가벼운 태그 짝 검사 (의존성 없이)
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<?') || m[0].startsWith('<!')) continue;
    if (m[3] === '/') continue;
    if (m[1] === '/') {
      const top = stack.pop();
      if (top !== m[2]) return name + ': 태그 짝 오류 </' + m[2] + '> (열린 태그 ' + top + ')';
    } else stack.push(m[2]);
  }
  return stack.length ? name + ': 닫히지 않은 태그 ' + stack.slice(-3).join(',') : null;
}

(async () => {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const problems = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  const firstName = new TextDecoder().decode(bytes.subarray(30, 30 + dv.getUint16(26, true)));
  if (firstName !== 'mimetype' || dv.getUint16(8, true) !== 0) problems.push('zip 첫 항목이 무압축 mimetype 이 아닙니다.');

  const { files } = await core.unzip(bytes);
  const td = new TextDecoder();
  const h = td.decode(files['Contents/header.xml']);
  const s = td.decode(files['Contents/section0.xml']);
  for (const [n, x] of [['header.xml', h], ['section0.xml', s], ['content.hpf', td.decode(files['Contents/content.hpf'])]]) {
    const e = checkXml(n, x); if (e) problems.push(e);
  }

  const ids = (tag) => Array.from(h.matchAll(new RegExp('<hh:' + tag + ' id="(\\d+)"', 'g')), (x) => +x[1]);
  const lists = [['charPr', 'charProperties', 0], ['paraPr', 'paraProperties', 0], ['borderFill', 'borderFills', 1], ['tabPr', 'tabProperties', 0]];
  const counts = {};
  for (const [tag, list, base] of lists) {
    const cnt = +(h.match(new RegExp('<hh:' + list + ' itemCnt="(\\d+)"')) || [0, -1])[1];
    const got = ids(tag);
    counts[tag] = cnt;
    if (got.length !== cnt || got.some((v, i) => v !== base + i)) problems.push(tag + ' 번호가 0/1부터 연속되지 않거나 itemCnt(' + cnt + ')와 다릅니다.');
  }
  const refCheck = (xml, attr, limit, base, where) => {
    const bad = Array.from(xml.matchAll(new RegExp(attr + '="(\\d+)"', 'g')), (x) => +x[1]).filter((v) => v < base || v >= limit + base);
    if (bad.length) problems.push(where + ' 의 ' + attr + ' 가 없는 번호를 참조: ' + [...new Set(bad)].slice(0, 5).join(','));
  };
  refCheck(s, 'charPrIDRef', counts.charPr, 0, 'section');
  refCheck(s, 'paraPrIDRef', counts.paraPr, 0, 'section');
  refCheck(s + h, 'borderFillIDRef', counts.borderFill, 1, 'section/header');
  refCheck(h, 'tabPrIDRef', counts.tabPr, 0, 'header');

  for (const lang of ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER']) {
    const cnt = +(h.match(new RegExp('<hh:fontface lang="' + lang + '" fontCnt="(\\d+)"')) || [0, 0])[1];
    const a = lang.toLowerCase();
    const bad = Array.from(h.matchAll(/<hh:fontRef [^>]*\/>/g)).map((x) => +(x[0].match(new RegExp('\\b' + a + '="(\\d+)"')) || [0, 0])[1]).filter((v) => v >= cnt);
    if (bad.length) problems.push('글꼴(' + lang + ') 참조 범위 초과: ' + bad.slice(0, 3).join(','));
  }

  const tbl = Array.from(s.matchAll(/<hp:tbl id="(\d+)"/g), (x) => x[1]);
  if (tbl.length !== new Set(tbl).size) problems.push('표 번호(hp:tbl id)가 겹칩니다.');

  let lineIssues = 0;
  for (const m of s.matchAll(/<hp:p\b[^>]*>((?:(?!<hp:p\b)[\s\S])*?)<\/hp:p>/g)) {
    const body = m[1];
    if (!body.includes('<hp:linesegarray>')) continue;
    const len = Array.from(body.matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g)).reduce((a, t) => a + t[1].length, 0);
    const pos = Array.from(body.matchAll(/textpos="(\d+)"/g), (x) => +x[1]);
    if (pos.length && Math.max(...pos) > len + 2) lineIssues++;
  }
  if (lineIssues) problems.push('글자 수보다 뒤를 가리키는 줄 배치 정보가 ' + lineIssues + '곳 있습니다(한글이 파일을 거부할 수 있음).');
  if (/\{\{[A-Z0-9_]+\}\}/.test(s)) problems.push('채워지지 않은 자리표시자가 남아 있습니다: ' + s.match(/\{\{[A-Z0-9_]+\}\}/)[0]);

  if (process.argv.includes('--text')) {
    console.log(Array.from(s.matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g), (x) => x[1].replace(/<hp:lineBreak\/>/g, ' / ')).filter((t) => t.trim()).join('\n'));
  }
  if (problems.length) { problems.forEach((p) => console.error('문제: ' + p)); process.exit(2); }
  console.log('점검 통과: ' + file);
})().catch((e) => { console.error(e.message); process.exit(1); });
