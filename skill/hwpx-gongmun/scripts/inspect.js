#!/usr/bin/env node
// hwpx 본문 문단 목록을 출력한다. 새 서식을 원형으로 만들 때 어떤 문단을 복제할지 고르는 데 쓴다.
//   node inspect.js 문서.hwpx            문단 목록(번호, 문단모양, 글자모양, 표 여부, 글자)
//   node inspect.js 문서.hwpx 12 30      12번·30번 문단의 XML 원문
const fs = require('fs');
const core = require('./core.js');

const [file, ...picks] = process.argv.slice(2);
if (!file) { console.error('사용: node inspect.js <문서.hwpx> [문단번호...]'); process.exit(1); }

(async () => {
  const { files } = await core.unzip(new Uint8Array(fs.readFileSync(file)));
  const xml = new TextDecoder().decode(files['Contents/section0.xml']);
  const paras = core.topParagraphs(xml);

  if (picks.length) {
    for (const n of picks) {
      console.log('\n===== 문단 ' + n + ' =====');
      console.log(paras[+n].xml.replace(/></g, '>\n<'));
    }
    return;
  }

  try {
    const tpl = core.parseTemplate(files);
    console.log('생성기용 서식입니다. 원형: ' + Object.keys(tpl.proto).join(', '));
    console.log('머리 자리표시자: ' + tpl.placeholders.join(', ') + '\n');
  } catch (e) {
    console.log('생성기용 서식이 아닙니다: ' + e.message + '\n');
  }

  paras.forEach((p, i) => {
    const pp = (p.xml.match(/paraPrIDRef="(\d+)"/) || [])[1];
    const cps = Array.from(new Set(Array.from(p.xml.matchAll(/charPrIDRef="(\d+)"/g), (m) => m[1])));
    const text = Array.from(p.xml.matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g), (m) => m[1]).join('');
    const flags = [/<hp:tbl\b/.test(p.xml) ? '표' : '', /<hp:pic\b/.test(p.xml) ? '그림' : '', /<hp:rect\b|<hp:container\b/.test(p.xml) ? '도형' : ''].filter(Boolean).join(',');
    console.log('[' + String(i).padStart(3) + '] 문단모양=' + pp + ' 글자모양=' + cps.join(',') + (flags ? ' <' + flags + '>' : '') + '  ' + text.slice(0, 90));
  });
})().catch((e) => { console.error(e.message); process.exit(1); });
