// 기본 서식(default.hwpx)에 "요약 쪽"과 "첨부 머리" 원형을 추가하고, □·ㅇ 원형에 굵게 강조 칸을 넣는다.
//
//   node tools/add-brief-prototypes.js <요약원본.hwpx> <첨부원본.hwpx> <서식.hwpx> [-o 결과.hwpx]
//
// 요약원본: 표지 다음에 [요약] 쪽(제목띠·비교 상자·□ 대분류·○ 항목·* 각주)이 있는 결재 문서
//           (AI전환팀 「착한주유소 가격 모니터링 기능 개발 및 시범 활용 계획(안)」 최종본 기준)
// 첨부원본: "첨부 1 | 제목" 머리띠가 있는 결재 문서
//           (AI전환팀 「생성형 AI 활용 현황 순회 점검 교육 결과 보고」 기준)
//
// 두 문서는 서식 번호 체계가 서식 파일과 다르다. 문단만 옮기면 모양이 깨지므로
// 원형이 쓰는 글자모양·문단모양·테두리·탭 정의를 서식 header.xml 에 새 번호로 등록하고,
// 글꼴은 이름으로 대조해 연결한 뒤 원형 문단의 번호를 바꿔 끼운다.
// make-template.js 로 기본 서식을 다시 뽑았다면 이 스크립트를 이어서 다시 실행한다.
const fs = require('fs');
const path = require('path');
const core = require('../skill/hwpx-gongmun/scripts/core.js');

const td = new TextDecoder('utf-8');
const te = new TextEncoder();

/* 원본 문서별 원형 위치(최상위 문단 번호)와 글자모양. inspect.js 로 확인한 값이다. */
const BRIEF_SRC = {
  banner: 14,     // 「부제」 + 제목(요약) 제목띠 표
  titleGap: 15,   // 제목띠 아래 좁은 빈 줄
  compare: 16,    // (기존)/(개선) 비교 상자 표
  compareGap: 17, // 비교 상자 아래 빈 줄
  headGap: 19,    // □ 대분류 아래 빈 줄
  itemGap: 22,    // ○ 항목 사이 빈 줄
  heading: 18,    // □ 대분류
  item: 27,       // ○ (라벨) 본문
  note: 21,       // * 각주
  run: { cmpLabel: 91, cmpText: 103, cmpEm: 104, bullet: 92, label: 93, text: 116, em: 122, note: 111, head: 22 },
};
const APPENDIX_SRC = { header: 73 };

function parseArgs(argv) {
  const pos = [];
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-o') out = argv[++i];
    else pos.push(argv[i]);
  }
  if (pos.length < 3) {
    console.error('사용법: node tools/add-brief-prototypes.js <요약원본.hwpx> <첨부원본.hwpx> <서식.hwpx> [-o 결과.hwpx]');
    process.exit(1);
  }
  return { briefDoc: pos[0], appendixDoc: pos[1], template: pos[2], out: out || pos[2] };
}

const load = async (p) => core.unzip(new Uint8Array(fs.readFileSync(p)));
const text = (files, name) => td.decode(files[name]);

/* ---------------- header 정의 옮기기 ---------------- */

const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];

function defOf(header, tag, id) {
  // <hh:tabPr id="0" .../> 처럼 한 줄로 닫히는 정의와 여는·닫는 태그가 있는 정의를 모두 처리한다.
  const m = header.match(new RegExp('<hh:' + tag + ' id="' + id + '"(?=[\\s/>])[^>]*?(?:/>|>[\\s\\S]*?</hh:' + tag + '>)'));
  if (!m) throw new Error('원본 header 에 ' + tag + ' ' + id + ' 정의가 없습니다.');
  return m[0];
}

function listInfo(header, listTag) {
  const m = header.match(new RegExp('<hh:' + listTag + ' itemCnt="(\\d+)">'));
  if (!m) throw new Error('서식 header 에 ' + listTag + ' 목록이 없습니다.');
  return { count: +m[1] };
}

function appendToList(header, listTag, defs) {
  if (!defs.length) return header;
  const open = new RegExp('<hh:' + listTag + ' itemCnt="(\\d+)">');
  const m = header.match(open);
  const close = '</hh:' + listTag + '>';
  const closeAt = header.indexOf(close, m.index);
  header = header.slice(0, closeAt) + defs.join('') + header.slice(closeAt);
  return header.replace(open, '<hh:' + listTag + ' itemCnt="' + (+m[1] + defs.length) + '">');
}

function transplant(srcHeader, dstHeader, paragraphs) {
  // 1) 원형 문단이 직접 참조하는 번호
  const need = { charPr: new Set(), paraPr: new Set(), borderFill: new Set(), tabPr: new Set() };
  const scan = (xml, re, set) => { for (const m of xml.matchAll(re)) set.add(m[1]); };
  for (const p of paragraphs) {
    scan(p, /charPrIDRef="(\d+)"/g, need.charPr);
    scan(p, /paraPrIDRef="(\d+)"/g, need.paraPr);
    scan(p, /borderFillIDRef="(\d+)"/g, need.borderFill);
  }
  // 2) 정의가 다시 참조하는 번호
  for (const id of need.charPr) scan(defOf(srcHeader, 'charPr', id), /borderFillIDRef="(\d+)"/g, need.borderFill);
  for (const id of need.paraPr) {
    const d = defOf(srcHeader, 'paraPr', id);
    scan(d, /borderFillIDRef="(\d+)"/g, need.borderFill);
    scan(d, /tabPrIDRef="(\d+)"/g, need.tabPr);
    const h = d.match(/<hh:heading type="(\w+)"/);
    if (h && h[1] !== 'NONE') throw new Error('paraPr ' + id + ' 가 개요·번호 문단입니다. 이 도구는 지원하지 않습니다.');
  }

  // 3) 글꼴: 언어별로 이름 대조, 없으면 추가
  const fontMap = {};
  for (const lang of LANGS) {
    const blockRe = new RegExp('<hh:fontface lang="' + lang + '" fontCnt="(\\d+)">[\\s\\S]*?</hh:fontface>');
    const sb = srcHeader.match(blockRe)[0];
    const dm = dstHeader.match(blockRe);
    let db = dm[0];
    const dstByFace = {};
    for (const m of db.matchAll(/<hh:font id="(\d+)" face="([^"]+)"/g)) dstByFace[m[2]] = m[1];
    let cnt = (db.match(/<hh:font id=/g) || []).length;
    const map = {};
    let add = '';
    for (const m of sb.matchAll(/<hh:font id="(\d+)" face="([^"]+)"[\s\S]*?<\/hh:font>/g)) {
      if (dstByFace[m[2]] != null) map[m[1]] = dstByFace[m[2]];
      else {
        map[m[1]] = String(cnt);
        dstByFace[m[2]] = String(cnt);
        add += m[0].replace(/<hh:font id="\d+"/, '<hh:font id="' + cnt + '"');
        cnt++;
      }
    }
    if (add) {
      db = db.replace(/fontCnt="\d+"/, 'fontCnt="' + cnt + '"').replace('</hh:fontface>', add + '</hh:fontface>');
      dstHeader = dstHeader.replace(dm[0], db);
    }
    fontMap[lang] = map;
  }

  // 4) 새 번호 부여 (borderFill 은 1부터, 나머지는 0부터)
  const map = { charPr: {}, paraPr: {}, borderFill: {}, tabPr: {} };
  const plan = [
    ['borderFill', 'borderFills', 1],
    ['tabPr', 'tabProperties', 0],
    ['charPr', 'charProperties', 0],
    ['paraPr', 'paraProperties', 0],
  ];
  const bodyOf = (d, tag) => d.replace(new RegExp('^<hh:' + tag + ' id="\\d+"'), '<hh:' + tag);
  const reused = { charPr: new Set(), paraPr: new Set(), borderFill: new Set(), tabPr: new Set() };
  for (const [tag, list, base] of plan) {
    let next = listInfo(dstHeader, list).count + base;
    for (const id of [...need[tag]].sort((a, b) => a - b)) {
      // 다른 번호를 참조하지 않는 탭 정의는 서식에 똑같은 것이 있으면 그 번호를 그대로 쓴다.
      if (tag === 'tabPr') {
        const body = bodyOf(defOf(srcHeader, tag, id), tag);
        const same = Array.from(dstHeader.matchAll(/<hh:tabPr id="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/hh:tabPr>)/g)).find((x) => bodyOf(x[0], tag) === body);
        if (same) { map[tag][id] = same[1]; reused[tag].add(id); continue; }
      }
      map[tag][id] = String(next++);
    }
  }
  const remapRefs = (xml) => xml
    .replace(/borderFillIDRef="(\d+)"/g, (_, i) => 'borderFillIDRef="' + map.borderFill[i] + '"')
    .replace(/tabPrIDRef="(\d+)"/g, (_, i) => 'tabPrIDRef="' + map.tabPr[i] + '"');

  for (const [tag, list] of plan) {
    const defs = [...need[tag]].filter((id) => !reused[tag].has(id)).sort((a, b) => a - b).map((id) => {
      let d = defOf(srcHeader, tag, id).replace(new RegExp('<hh:' + tag + ' id="\\d+"'), '<hh:' + tag + ' id="' + map[tag][id] + '"');
      d = remapRefs(d);
      if (tag === 'charPr') {
        d = d.replace(/<hh:fontRef [^>]*\/>/, (fr) => {
          for (const lang of LANGS) {
            const a = lang.toLowerCase();
            fr = fr.replace(new RegExp('\\b' + a + '="(\\d+)"'), (_, v) => a + '="' + fontMap[lang][v] + '"');
          }
          return fr;
        });
      }
      return d;
    });
    dstHeader = appendToList(dstHeader, list, defs);
  }

  const remapParagraph = (xml) => remapRefs(xml)
    .replace(/charPrIDRef="(\d+)"/g, (_, i) => 'charPrIDRef="' + map.charPr[i] + '"')
    .replace(/paraPrIDRef="(\d+)"/g, (_, i) => 'paraPrIDRef="' + map.paraPr[i] + '"');
  return { header: dstHeader, remapParagraph, map };
}

/* ---------------- 원형 문단 만들기 ---------------- */

const stripLines = (xml) => xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
const openTag = (xml) => xml.match(/^<hp:p\b[^>]*>/)[0].replace(/pageBreak="\d"/, 'pageBreak="0"');
const run = (cp, t) => '<hp:run charPrIDRef="' + cp + '"><hp:t>' + t + '</hp:t></hp:run>';
const para = (open, runs) => open + runs + '</hp:p>';

function replaceTexts(xml, values) {
  let i = 0;
  return xml.replace(/<hp:t>([\s\S]*?)<\/hp:t>/g, (whole, inner) => {
    if (!inner.replace(/<hp:lineBreak\/>/g, '').trim()) return whole;
    const v = values[i++];
    if (v == null) throw new Error('원형 글자 자리가 예상보다 많습니다: ' + inner);
    return '<hp:t>' + v + '</hp:t>';
  });
}

function buildBriefPrototypes(briefXml) {
  const paras = core.topParagraphs(briefXml).map((p) => stripLines(p.xml));
  const P = (k) => {
    const x = paras[BRIEF_SRC[k]];
    if (!x) throw new Error('요약원본에 ' + k + ' 문단(' + BRIEF_SRC[k] + ')이 없습니다.');
    return x;
  };
  const R = BRIEF_SRC.run;
  const gap = (k, key) => para(openTag(P(k)), run(P(k).match(/charPrIDRef="(\d+)"/)[1], '{{' + key + '}}'));

  if (!/\(요약\)/.test(P('banner'))) throw new Error('요약원본 ' + BRIEF_SRC.banner + '번 문단이 [요약] 제목띠가 아닙니다. BRIEF_SRC 번호를 확인하세요.');
  const banner = replaceTexts(P('banner'), ['{{BRIEF_SUBTITLE}}<hp:lineBreak/>', '{{BRIEF_TITLE}}']);

  const cmpSrc = P('compare');
  const cellParaOpen = cmpSrc.match(/<hp:subList\b[^>]*>(<hp:p\b[^>]*>)/)[1];
  const line = cellParaOpen + run(R.cmpLabel, '({{CMP_LABEL}}) ') + run(R.cmpText, '{{CMP_TEXT}}') + run(R.cmpEm, '{{CMP_EM}}') + '</hp:p>';
  const compare = cmpSrc.replace(/(<hp:subList\b[^>]*>)[\s\S]*?(<\/hp:subList>)/, '$1' + line + '$2');

  const heading = para(openTag(P('heading')), run(R.head, '□ {{BRIEF_HEAD}}'));
  const item = para(openTag(P('item')), run(R.bullet, ' ○ ') + run(R.label, '({{BRIEF_LABEL}}) ') + run(R.text, '{{BRIEF_TEXT}}') + run(R.em, '{{BRIEF_EM}}'));
  const note = para(openTag(P('note')), run(R.note, '   * {{BRIEF_NOTE}}'));

  return [
    banner,
    gap('titleGap', 'BRIEF_TGAP'),
    compare,
    gap('compareGap', 'BRIEF_BGAP'),
    heading,
    gap('headGap', 'BRIEF_HGAP'),
    item,
    gap('itemGap', 'BRIEF_IGAP'),
    note,
  ];
}

function buildAppendixPrototype(apxXml) {
  const p = core.topParagraphs(apxXml)[APPENDIX_SRC.header];
  if (!p || !/첨부/.test(p.xml)) throw new Error('첨부원본 ' + APPENDIX_SRC.header + '번 문단이 첨부 머리띠가 아닙니다.');
  const x = replaceTexts(stripLines(p.xml), ['{{APX_NUM}}', '{{APX_TITLE}}']);
  return x.replace(/^(<hp:p\b[^>]*?)pageBreak="\d"/, '$1pageBreak="1"');
}

/* ---------------- 실행 ---------------- */

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const brief = await load(args.briefDoc);
  const apx = await load(args.appendixDoc);
  const tpl = await load(args.template);

  let section = text(tpl.files, 'Contents/section0.xml');
  if (section.includes('{{BRIEF_TITLE}}')) throw new Error('이미 요약 원형이 들어 있는 서식입니다.');

  const briefProtos = buildBriefPrototypes(text(brief.files, 'Contents/section0.xml'));
  const apxProto = buildAppendixPrototype(text(apx.files, 'Contents/section0.xml'));

  // 요약원본 정의 옮기기
  let header = text(tpl.files, 'Contents/header.xml');
  let t1 = transplant(text(brief.files, 'Contents/header.xml'), header, briefProtos);
  header = t1.header;
  const briefReady = briefProtos.map(t1.remapParagraph);
  // 첨부원본 정의 옮기기
  const t2 = transplant(text(apx.files, 'Contents/header.xml'), header, [apxProto]);
  header = t2.header;
  const apxReady = t2.remapParagraph(apxProto);

  // 표 번호 겹침 방지
  let seq = 1700000000;
  const renumber = (x) => x.replace(/<hp:tbl id="\d+"/g, () => '<hp:tbl id="' + (seq++) + '"');

  // □·□(라벨 없음)·ㅇ 원형에 굵게 강조 칸 추가 (서식의 라벨 글자모양을 그대로 씀)
  const labelCp = (section.match(/<hp:run charPrIDRef="(\d+)"><hp:t>\(\{\{BOX_LABEL\}\}\)<\/hp:t><\/hp:run>/) || [])[1];
  if (!labelCp) throw new Error('서식 □ 원형에서 라벨 글자모양을 찾지 못했습니다.');
  const addEm = (key, emKey) => {
    const re = new RegExp('(<hp:run charPrIDRef="\\d+"><hp:t>[^<]*\\{\\{' + key + '\\}\\}</hp:t></hp:run>)');
    if (!re.test(section)) throw new Error('서식에서 {{' + key + '}} 글자 칸을 찾지 못했습니다.');
    section = section.replace(re, '$1' + run(labelCp, '{{' + emKey + '}}'));
  };
  addEm('BOX_TEXT', 'BOX_EM');
  addEm('PLAIN', 'PLAIN_EM');
  addEm('SUB', 'SUB_EM');

  const end = section.lastIndexOf('</hs:sec>');
  section = section.slice(0, end) + briefReady.map(renumber).join('') + renumber(apxReady) + section.slice(end);

  const files = Object.assign({}, tpl.files, {
    'Contents/header.xml': te.encode(header),
    'Contents/section0.xml': te.encode(section),
  });
  const names = ['mimetype'].concat(tpl.order.filter((n) => n !== 'mimetype'));
  const bytes = await core.zip(names.map((name) => ({ name, data: files[name] })));
  fs.writeFileSync(args.out, bytes);
  console.log('저장:', args.out);
  console.log('추가한 정의 — 요약원본:', JSON.stringify(t1.map), '\n첨부원본:', JSON.stringify(t2.map));
})().catch((e) => { console.error(e.message || e); process.exit(1); });
