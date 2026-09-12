// 실제 결재 문서(hwpx)에서 내용·실명을 걷어내고 자리표시자와 원형 문단을 심어 기본 서식을 만든다.
// 사용: node tools/make-template.js <원본.hwpx> <출력.hwpx>
const fs = require('fs');
const path = require('path');
const core = require('../skill/hwpx-gongmun/scripts/core.js');

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('사용: node tools/make-template.js <원본.hwpx> <출력.hwpx>'); process.exit(1); }

const te = new TextEncoder();
const td = new TextDecoder();

function replaceOnce(xml, from, to, label) {
  const i = xml.indexOf(from);
  if (i < 0) throw new Error('찾지 못함: ' + (label || from));
  return xml.slice(0, i) + to + xml.slice(i + from.length);
}
function replaceAll(xml, from, to, label) {
  if (!xml.includes(from)) throw new Error('찾지 못함: ' + (label || from));
  return xml.split(from).join(to);
}
const T = (s) => '<hp:t>' + s + '</hp:t>';

function onlyFirstPara(tc, text, pp) {
  const open = tc.match(/^[\s\S]*?<hp:subList\b[^>]*>/)[0];
  const close = tc.slice(tc.lastIndexOf('</hp:subList>'));
  let p = tc.slice(open.length).match(/<hp:p\b[\s\S]*?<\/hp:p>/)[0];
  p = p.replace(/<hp:t>[\s\S]*?<\/hp:t>/, T(text));
  if (pp != null) p = p.replace(/paraPrIDRef="\d+"/, 'paraPrIDRef="' + pp + '"');
  return open + p + close;
}

(async () => {
  const { files, order } = await core.unzip(new Uint8Array(fs.readFileSync(src)));
  const sec = td.decode(files['Contents/section0.xml']);
  const P = core.topParagraphs(sec);

  /* ---- 머리 부분(결재표·표지·머리띠·요약상자) ---- */
  let head = sec.slice(0, P[20].start);
  head = replaceAll(head, T('AI전환팀장'), T('{{POS2}}'));
  head = replaceAll(head, T('AI전환팀'), T('{{TEAM}}'));
  head = replaceOnce(head, T('담당'), T('{{POS1}}'));
  head = replaceOnce(head, T('사업이사'), T('{{POS3}}'));
  head = replaceOnce(head, T('신준규'), T('{{NAME1}}'));
  head = replaceOnce(head, T('송지훈'), T('{{NAME2}}'));
  head = replaceOnce(head, T('고성욱'), T('{{NAME3}}'));
  head = replaceAll(head, T('2026.  .  .'), T('{{YEAR}}.  .  .'));
  head = replaceOnce(head, T('비공개'), T('{{DISCLOSURE}}'));
  const coopAt = head.indexOf(T('협조자'));
  head = head.slice(0, coopAt) + replaceOnce(head.slice(coopAt), T(' '), T('{{COOP}}'), '협조자 칸');
  head = replaceOnce(head, T('「현장 위험요인 신고·조치 및 디지털 전환을 위한」'), T('{{COVER_SUBTITLE}}'));
  head = replaceOnce(head, T('「전사적 스마트 안전보건 행정을 위한」'), T('{{HEADER_SUBTITLE}}'));
  head = replaceAll(head, T('모바일 QR 안전신문고 구축 계획(안)'), T('{{TITLE}}'));
  head = replaceOnce(head, T('2026. 9.'), T('{{DATE}}'));
  head = head.replace(/<hp:t>현장 어디서나[^<]*<\/hp:t>/, T('{{SUMMARY}}'));
  head = head.replace(/<hp:run charPrIDRef="(\d+)"><hp:t>공유하는[^<]*<\/hp:t><\/hp:run>/, '<hp:run charPrIDRef="$1"/>');
  if (/신준규|송지훈|고성욱|안전신문고|위험요인/.test(head)) throw new Error('머리 부분에 원본 내용이 남아 있습니다.');

  /* ---- 하위 항목(ㅇ)용 문단 모양: □ 문단 모양을 복제해 왼쪽 여백을 준다 ---- */
  let header = td.decode(files['Contents/header.xml']);
  const base = header.match(/<hh:paraPr id="30"[\s\S]*?<\/hh:paraPr>/)[0];
  const ids = Array.from(header.matchAll(/<hh:paraPr id="(\d+)"/g), (m) => +m[1]);
  const subId = Math.max(...ids) + 1;
  const [caseXml, defXml] = base.split('<hp:default>');
  const setMargin = (x, intent, left) => x
    .replace(/<hc:intent value="-?\d+"/, '<hc:intent value="' + intent + '"')
    .replace(/<hc:left value="-?\d+"/, '<hc:left value="' + left + '"');
  const subPr = setMargin(caseXml, -2250, 3000).replace('id="30"', 'id="' + subId + '"') + '<hp:default>' + setMargin(defXml, -4500, 6000);
  header = header.replace('</hh:paraProperties>', subPr + '</hh:paraProperties>');
  header = header.replace(/<hh:paraProperties itemCnt="(\d+)"/, (_, n) => '<hh:paraProperties itemCnt="' + (+n + 1) + '"');

  /* ---- 원형 문단 ---- */
  const LS = (vs) => '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="' + vs + '" textheight="' + vs + '" baseline="' + Math.round(vs * 0.85) + '" spacing="' + Math.round(vs * 0.6) + '" horzpos="0" horzsize="48188" flags="393216"/></hp:linesegarray>';
  const para = (pp, runs, vs) => '<hp:p id="0" paraPrIDRef="' + pp + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' + runs + LS(vs) + '</hp:p>';
  const run = (cp, t) => '<hp:run charPrIDRef="' + cp + '">' + T(t) + '</hp:run>';

  const marker = para(1, run(22, '{{PROTOTYPES}}  ▼ 아래 문단은 생성기가 복제하는 원형입니다. {{ }} 글자는 그대로 두고 서식만 고치세요.'), 1200);
  const sectionHeader = P[20].xml.replace(T('Ⅰ'), T('{{SEC_NUM}}')).replace(T(' 추진배경'), T(' {{SEC_TITLE}}'));
  const blank = P[37].xml.replace('<hp:run charPrIDRef="20"/>', '<hp:run charPrIDRef="20">' + T('{{BLANK}}') + '</hp:run>');
  const box = P[44].xml
    .replace(/<hp:t>\(접근 통제\)<\/hp:t>/, T('({{BOX_LABEL}})'))
    .replace(/<hp:t> 데이터베이스[^<]*<\/hp:t>/, T(' {{BOX_TEXT}}'));
  const plain = para(30, run(17, ' □') + run(16, ' {{PLAIN}}'), 1500);
  const sub = para(subId, run(16, 'ㅇ {{SUB}}'), 1500);
  const note = P[36].xml.replace(/<hp:t>  \* [^<]*<\/hp:t>/, T('  * {{NOTE}}'));
  const plainPara = para(1, run(16, '{{PARA}}'), 1500);

  let table = P[33].xml;
  const tcs = table.match(/<hp:tc\b[\s\S]*?<\/hp:tc>/g);
  table = table.replace(tcs[0], tcs[0].replace(T('구분'), T('{{TH}}')))
    .replace(tcs[1], tcs[1].replace(T('AI전환팀(구축)'), T('{{TH}}')))
    .replace(tcs[2], tcs[2].replace(T('안전관리팀(운영)'), T('{{TH}}')))
    .replace(tcs[3], tcs[3].replace(T('내용'), T('{{TD_KEY}}')))
    .replace(tcs[4], onlyFirstPara(tcs[4], '{{TD_LIST}}'))
    .replace(tcs[5], onlyFirstPara(tcs[5], '{{TD}}', 1));

  const protos = [marker, sectionHeader, blank, box, blank, plain, sub, note, blank, table, plainPara];
  // 글자를 바꾼 문단은 옛 줄 배치 정보를 지워 한글이 다시 배치하게 한다.
  let body = head + protos.join('') + sec.slice(P[P.length - 1].end);
  body = core.topParagraphs(body).reduceRight((acc, p) => (p.xml.includes('{{')
    ? acc.slice(0, p.start) + p.xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '') + acc.slice(p.end)
    : acc), body);
  if (/신준규|송지훈|고성욱|안전신문고|위험요인/.test(body)) throw new Error('원형에 원본 내용이 남아 있습니다.');

  /* ---- 부속 파일 정리 ---- */
  let hpf = td.decode(files['Contents/content.hpf']);
  hpf = hpf.replace(/<opf:title>[\s\S]*?<\/opf:title>/, '<opf:title>공문 서식</opf:title>')
    .replace(/<opf:meta name="description" content="text">[\s\S]*?<\/opf:meta>/, '<opf:meta name="description" content="text"/>');

  const out = Object.assign({}, files, {
    'Contents/section0.xml': te.encode(body),
    'Contents/header.xml': te.encode(header),
    'Contents/content.hpf': te.encode(hpf),
    'Preview/PrvText.txt': te.encode('공문 서식 원형 (hwpx-gongmun)'),
  });
  delete out['Preview/PrvImage.png'];
  const names = ['mimetype'].concat(order.filter((n) => n !== 'mimetype' && out[n]));
  const bytes = await core.zip(names.map((name) => ({ name, data: out[name] })));
  fs.mkdirSync(path.dirname(path.resolve(dst)), { recursive: true });
  fs.writeFileSync(dst, bytes);

  const check = core.parseTemplate((await core.unzip(bytes)).files);
  console.log('서식 저장:', dst, bytes.length + ' bytes');
  console.log('원형:', Object.keys(check.proto).join(', '));
  console.log('자리표시자:', check.placeholders.join(', '));
  console.log('ㅇ 항목 문단모양 id:', subId);
})().catch((e) => { console.error(e.message); process.exit(1); });
