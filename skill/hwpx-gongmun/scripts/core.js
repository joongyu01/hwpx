/*
 * hwpx-gongmun core
 * 서식 원형(hwpx)의 문단·표를 복제하고 글자만 바꿔 공문을 만든다.
 * Node(18+)와 브라우저에서 똑같이 동작하며 외부 의존성이 없다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HwpxGongmun = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const te = new TextEncoder();
  const td = new TextDecoder('utf-8');

  /* ------------------------------------------------------------------ */
  /* 압축 (hwpx = zip)                                                   */
  /* ------------------------------------------------------------------ */

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }

  function defaultCodec() {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const zlib = require('zlib');
      return {
        deflateRaw: async (b) => new Uint8Array(zlib.deflateRawSync(b, { level: 9 })),
        inflateRaw: async (b) => new Uint8Array(zlib.inflateRawSync(b)),
      };
    }
    if (typeof CompressionStream !== 'undefined') {
      return {
        deflateRaw: (b) => pipe(b, new CompressionStream('deflate-raw')),
        inflateRaw: (b) => pipe(b, new DecompressionStream('deflate-raw')),
      };
    }
    return { deflateRaw: null, inflateRaw: null };
  }

  async function unzip(bytes, codec) {
    codec = codec || defaultCodec();
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) {
      throw new Error('hwpx 파일로 읽을 수 없습니다. 암호화(DRM)가 걸려 있거나 hwp(구버전) 파일일 수 있습니다. 한글에서 "다른 이름으로 저장 → hwpx"로 저장한 파일을 사용하세요.');
    }
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const order = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip 목록이 손상되었습니다.');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = td.decode(bytes.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (name.endsWith('/')) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const raw = bytes.subarray(start, start + csize);
      let data;
      if (method === 0) data = raw.slice();
      else if (method === 8) {
        if (!codec.inflateRaw) throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다. 최신 Chrome·Edge를 사용하세요.');
        data = await codec.inflateRaw(raw);
      } else throw new Error('지원하지 않는 압축 방식입니다: ' + method);
      files[name] = data;
      order.push(name);
    }
    return { files, order };
  }

  // mimetype 은 무압축으로 맨 앞에 두어야 한글이 hwpx 로 인식한다.
  async function zip(entries, codec) {
    codec = codec || defaultCodec();
    const parts = [];
    const central = [];
    let offset = 0;
    for (const { name, data } of entries) {
      const store = name === 'mimetype' || !codec.deflateRaw;
      const comp = store ? data : await codec.deflateRaw(data);
      const nameBytes = te.encode(name);
      const crc = crc32(data);

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0, true);
      lh.setUint16(8, store ? 0 : 8, true);
      lh.setUint16(10, 0, true);
      lh.setUint16(12, 0x2821, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, comp.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nameBytes, comp);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0, true);
      ch.setUint16(10, store ? 0 : 8, true);
      ch.setUint16(12, 0, true);
      ch.setUint16(14, 0x2821, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, comp.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, nameBytes.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameBytes);

      offset += 30 + nameBytes.length + comp.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);

    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let pos = 0;
    for (const a of all) { out.set(a, pos); pos += a.length; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* XML 조작                                                            */
  /* ------------------------------------------------------------------ */

  const esc = (s) => String(s == null ? '' : s)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

  // 표 셀 안의 문단은 건너뛰고 본문 최상위 문단만 잘라낸다.
  function topParagraphs(xml) {
    const re = /<(\/?)(hp:p|hp:subList)\b([^>]*)>/g;
    const out = [];
    let m, sub = 0, depth = 0, start = -1;
    while ((m = re.exec(xml))) {
      const close = m[1] === '/';
      const selfClose = m[3].endsWith('/');
      if (m[2] === 'hp:subList') {
        if (close) sub--; else if (!selfClose) sub++;
        continue;
      }
      if (sub !== 0 || selfClose) continue;
      if (!close) { if (depth === 0) start = m.index; depth++; }
      else { depth--; if (depth === 0) out.push({ start, end: re.lastIndex, xml: xml.slice(start, re.lastIndex) }); }
    }
    return out;
  }

  // **굵게** 표시는 강조 칸이 있는 원형에서만 굵게 바뀐다. 그 밖의 자리에서는 별표만 지운다.
  const stripEm = (s) => String(s == null ? '' : s).replace(/\*\*/g, '');
  const fill = (xml, map) => xml.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => esc(stripEm(map[k])));

  function splitEmphasis(value) {
    const parts = String(value == null ? '' : value).split('**');
    if (parts.length % 2 === 0) return [{ t: parts.join(''), em: false }]; // 짝이 안 맞으면 강조 없이
    return parts.map((t, i) => ({ t, em: i % 2 === 1 })).filter((p) => p.t);
  }

  // 원형 안의 {{KEY}} 글자 칸을 강조 구간마다 보통/굵게 칸으로 쪼갠다.
  // 굵은 글자모양은 같은 원형 안의 {{EMKEY}} 칸에서 가져오고, 그 칸 자체는 지운다.
  function richFill(xml, key, emKey, value) {
    const runRe = (k) => new RegExp('<hp:run charPrIDRef="(\\d+)"><hp:t>([^<]*?)\\{\\{' + k + '\\}\\}([^<]*?)</hp:t></hp:run>');
    const km = xml.match(runRe(key));
    if (!km) return xml;
    const em = emKey ? xml.match(runRe(emKey)) : null;
    let out = em ? xml.replace(em[0], '') : xml;
    const segs = splitEmphasis(value);
    const runs = (segs.length ? segs : [{ t: '', em: false }]).map((sg, i, all) => {
      const cp = sg.em && em ? em[1] : km[1];
      const pre = i === 0 ? km[2] : '';
      const post = i === all.length - 1 ? km[3] : '';
      return '<hp:run charPrIDRef="' + cp + '"><hp:t>' + pre + esc(sg.t) + post + '</hp:t></hp:run>';
    });
    return out.replace(km[0], runs.join(''));
  }

  // linesegarray 는 한글이 저장해 둔 줄 배치 결과다. 글자를 바꾼 문단에 옛 값이 남으면 한글이 그 값을 믿고
  // 긴 문장을 한 줄에 겹쳐 그린다. 지워 두면 열 때 다시 배치한다.
  const normLines = (xml) => xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');

  let idSeq = 1900000000 + Math.floor(Math.random() * 100000000);
  const renumber = (xml) => xml.replace(/<hp:tbl id="\d+"/g, () => '<hp:tbl id="' + (idSeq++) + '"');

  const clone = (xml, map) => renumber(normLines(fill(xml, map)));
  const cloneRich = (xml, key, emKey, value, map) =>
    renumber(normLines(fill(richFill(xml, key, emKey, value), Object.assign({ [key]: value, [emKey]: '' }, map || {}))));

  /* ------------------------------------------------------------------ */
  /* 서식 원형 읽기                                                       */
  /* ------------------------------------------------------------------ */

  // 원형 문단은 {{PROTOTYPES}} 표시 문단 아래에 둔다. 각 원형은 안에 든 자리표시자로 찾는다.
  const PROTO_KEYS = {
    sectionHeader: 'SEC_TITLE',
    box: 'BOX_TEXT',
    plain: 'PLAIN',
    sub: 'SUB',
    note: 'NOTE',
    para: 'PARA',
    blank: 'BLANK',
    table: 'TH',
    // 요약 쪽 (표지 다음 [요약] 1쪽)
    briefTitle: 'BRIEF_TITLE',
    briefTitleGap: 'BRIEF_TGAP',
    briefCompare: 'CMP_TEXT',
    briefCompareGap: 'BRIEF_BGAP',
    briefHead: 'BRIEF_HEAD',
    briefHeadGap: 'BRIEF_HGAP',
    briefItem: 'BRIEF_TEXT',
    briefItemGap: 'BRIEF_IGAP',
    briefNote: 'BRIEF_NOTE',
    // 첨부 쪽 머리띠 ("첨부 1 | 제목")
    appendixHeader: 'APX_TITLE',
  };

  function parseTemplate(files) {
    const secBytes = files['Contents/section0.xml'];
    if (!secBytes) throw new Error('서식 파일에 Contents/section0.xml 이 없습니다.');
    const xml = td.decode(secBytes);
    const paras = topParagraphs(xml);
    const mi = paras.findIndex((p) => p.xml.includes('{{PROTOTYPES}}'));
    if (mi < 0) {
      throw new Error('서식에 {{PROTOTYPES}} 표시 문단이 없습니다. 이 생성기용으로 준비된 서식이 아닙니다(template-guide.md 참고).');
    }
    const zone = paras.slice(mi + 1);
    const proto = {};
    for (const [kind, key] of Object.entries(PROTO_KEYS)) {
      const hit = zone.find((p) => p.xml.includes('{{' + key + '}}'));
      if (hit) proto[kind] = hit.xml;
    }
    const missing = ['sectionHeader', 'box', 'blank'].filter((k) => !proto[k]);
    if (missing.length) throw new Error('서식에 필수 원형이 없습니다: ' + missing.map((k) => '{{' + PROTO_KEYS[k] + '}}').join(', '));
    // 머리 부분 중 자리표시자가 든 문단만 줄 배치를 지운다. 나머지는 원본 배치를 그대로 쓴다.
    const head = paras.slice(0, mi).map((p, i) => {
      const gap = xml.slice(i === 0 ? 0 : paras[i - 1].end, p.start);
      return gap + (p.xml.includes('{{') ? normLines(p.xml) : p.xml);
    }).join('') + xml.slice(mi > 0 ? paras[mi - 1].end : 0, paras[mi].start);
    const tail = xml.slice(paras[paras.length - 1].end);
    const placeholders = Array.from(new Set(Array.from(head.matchAll(/\{\{([A-Z0-9_]+)\}\}/g), (m) => m[1])));

    // 요약 쪽을 끼울 자리: 본문 머리띠 표({{HEADER_SUBTITLE}})가 든 글자 칸 바로 앞.
    // 기본 서식은 표지 로고와 본문 머리띠가 한 문단에 있으므로 그 문단을 둘로 나누고,
    // 뒤쪽 문단(본문 머리띠)은 새 쪽에서 시작하게 한다.
    let headBefore = null, headAfter = null;
    const hs = head.indexOf('{{HEADER_SUBTITLE}}');
    if (hs >= 0) {
      const runAt = head.lastIndexOf('<hp:run', head.lastIndexOf('<hp:tbl', hs));
      const owner = topParagraphs(head).find((p) => p.start <= runAt && runAt < p.end);
      if (runAt >= 0 && owner) {
        const open = owner.xml.match(/^<hp:p\b[^>]*>/)[0];
        const firstRun = owner.start + open.length;
        if (runAt === firstRun) {
          headBefore = head.slice(0, owner.start);
          headAfter = open.replace(/pageBreak="\d"/, 'pageBreak="1"') + head.slice(runAt);
        } else {
          headBefore = head.slice(0, runAt) + '</hp:p>';
          headAfter = open.replace(/pageBreak="\d"/, 'pageBreak="1"') + head.slice(runAt);
        }
      }
    }
    return { head, headBefore, headAfter, tail, proto, placeholders };
  }

  /* ------------------------------------------------------------------ */
  /* 내용(JSON) 정리·검사                                                 */
  /* ------------------------------------------------------------------ */

  const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ'];
  const ITEM_TYPES = ['box', 'sub', 'note', 'table', 'text'];
  const TYPE_ALIAS = { '□': 'box', bullet: 'box', item: 'box', 'ㅇ': 'sub', '*': 'note', paragraph: 'text', para: 'text' };

  function parseItemString(raw) {
    const s = String(raw).trim();
    let m;
    if ((m = s.match(/^\*\s*([\s\S]+)$/))) return { type: 'note', text: m[1] };
    if ((m = s.match(/^[ㅇ○◦]\s*([\s\S]+)$/))) return { type: 'sub', text: m[1] };
    const body = s.replace(/^□\s*/, '');
    if ((m = body.match(/^\(([^()]{1,30})\)\s*([\s\S]+)$/))) return { type: 'box', label: m[1], text: m[2] };
    return { type: 'box', text: body };
  }

  function normalizeItems(items) {
    const out = [];
    for (const raw of items || []) {
      if (raw == null) continue;
      const it = typeof raw === 'string' ? parseItemString(raw) : Object.assign({}, raw);
      it.type = TYPE_ALIAS[it.type] || it.type || (it.rows ? 'table' : 'box');
      if (it.type === 'box' && typeof it.text === 'string' && !it.label) {
        const again = parseItemString(it.text);
        if (again.type === 'box') { it.label = again.label; it.text = again.text; }
      }
      if (it.label) it.label = String(it.label).replace(/^\(|\)$/g, '');
      const subs = it.subs || it.sub_items;
      const notes = it.notes;
      delete it.subs; delete it.sub_items; delete it.notes;
      out.push(it);
      for (const s of [].concat(subs || [])) out.push({ type: 'sub', text: s });
      for (const n of [].concat(notes || [])) out.push({ type: 'note', text: String(n).replace(/^\*\s*/, '') });
    }
    return out;
  }

  const wrapBracket = (s) => {
    if (!s) return '';
    const t = String(s).trim();
    return /^「[\s\S]*」$/.test(t) ? t : '「' + t.replace(/^「|」$/g, '') + '」';
  };

  function normalizeSpec(spec) {
    const s = JSON.parse(JSON.stringify(spec || {}));
    s.sections = (s.sections || []).map((sec) => ({
      title: typeof sec === 'string' ? sec : (sec.title || ''),
      items: normalizeItems(typeof sec === 'string' ? [] : (sec.items || sec.content || [])),
    }));
    s.attachments = [].concat(s.attachments || []).filter(Boolean).map(String);
    s.approval = (s.approval || []).map((a) => (typeof a === 'string' ? { position: a, name: '' } : a));

    // 요약 쪽: "brief": { title, subtitle, compare: [...], sections: [{ title, items }] }
    if (s.brief) {
      const b = s.brief === true ? {} : s.brief;
      const baseTitle = String(b.title || s.title || '').trim();
      s.brief = {
        title: /\(요약\)\s*$/.test(baseTitle) ? baseTitle : baseTitle + '(요약)',
        subtitle: b.subtitle != null ? String(b.subtitle) : String(s.subtitle || ''),
        compare: [].concat(b.compare || []).filter(Boolean).map((c) => {
          if (typeof c !== 'string') return { label: String(c.label || '').replace(/^\(|\)$/g, ''), text: String(c.text || '') };
          const p = parseItemString(c);
          return { label: p.label || '', text: p.text || '' };
        }),
        sections: (b.sections || []).map((sec) => ({
          title: typeof sec === 'string' ? sec : (sec.title || ''),
          items: normalizeItems(typeof sec === 'string' ? [] : (sec.items || [])),
        })),
      };
    } else {
      delete s.brief;
    }

    // 첨부 쪽: "appendices": [{ title, items }] — 본문 뒤 새 쪽마다 "첨부 N | 제목" 머리띠
    s.appendices = [].concat(s.appendices || []).filter(Boolean).map((a) => ({
      title: typeof a === 'string' ? a : (a.title || ''),
      items: normalizeItems(typeof a === 'string' ? [] : (a.items || a.content || [])),
    }));
    return s;
  }

  /* 날짜·요일 검산: "2026. 9. 16.(수)", "’26. 9. 16.(수)", "9. 16.(수)" 형식 */
  const WEEKDAYS = '일월화수목금토';
  function checkWeekdays(textValue, defaultYear) {
    const out = [];
    const re = /(?:(\d{4})\.\s*|[’'‘](\d{2})\.\s*)?(\d{1,2})\.\s*(\d{1,2})\.?\s*\(([일월화수목금토])\)/g;
    for (const m of String(textValue).matchAll(re)) {
      const y = m[1] ? +m[1] : m[2] ? 2000 + +m[2] : defaultYear;
      const mo = +m[3], d = +m[4];
      if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCMonth() !== mo - 1) { out.push('"' + m[0] + '" 는 없는 날짜입니다.'); continue; }
      const real = WEEKDAYS[dt.getUTCDay()];
      if (real !== m[5]) out.push('"' + m[0] + '" 의 요일이 맞지 않습니다(' + y + '년 기준 ' + real + '요일).');
    }
    return out;
  }

  function collectTexts(s) {
    const texts = [];
    const push = (v) => { if (v != null && v !== '') texts.push(String(v)); };
    const items = (list) => (list || []).forEach((it) => {
      push(it.label); push(it.text);
      if (it.type === 'table') {
        (it.columns || []).forEach(push);
        (it.rows || []).forEach((r) => [].concat(r).forEach((c) => [].concat(c).forEach(push)));
      }
    });
    [s.title, s.subtitle, s.summary].forEach(push);
    (s.sections || []).forEach((sec) => { push(sec.title); items(sec.items); });
    if (s.brief) {
      push(s.brief.title); push(s.brief.subtitle);
      s.brief.compare.forEach((c) => { push(c.label); push(c.text); });
      s.brief.sections.forEach((sec) => { push(sec.title); items(sec.items); });
    }
    (s.appendices || []).forEach((a) => { push(a.title); items(a.items); });
    return texts;
  }

  function validateSpec(spec) {
    const s = normalizeSpec(spec);
    const errors = [];
    const warnings = [];
    if (!s.title || !String(s.title).trim()) errors.push('title(문서 제목)이 비어 있습니다.');
    if (!s.sections.length) errors.push('sections(본문 장)가 하나도 없습니다.');
    const groups = s.sections.map((sec, i) => ({ where: (ROMAN[i] || i + 1) + '장', sec }));
    if (s.brief) {
      if (!s.brief.sections.length) errors.push('brief(요약 쪽)에 sections 가 없습니다.');
      s.brief.sections.forEach((sec, i) => groups.push({ where: '요약 ' + (i + 1) + '번째 대분류', sec }));
      s.brief.compare.forEach((c, i) => { if (!c.text) errors.push('요약 비교 상자 ' + (i + 1) + '번째 줄: text 가 비어 있습니다.'); });
    }
    s.appendices.forEach((a, i) => {
      if (!a.title) errors.push('첨부 ' + (i + 1) + ': title(첨부 제목)이 비어 있습니다.');
      groups.push({ where: '첨부 ' + (i + 1), sec: a });
    });
    groups.forEach(({ where, sec }) => {
      if (!sec.title) errors.push(where + ': title(제목)이 비어 있습니다.');
      if (!sec.items.length) warnings.push(where + ' "' + sec.title + '": 항목이 없습니다.');
      sec.items.forEach((it, j) => {
        const at = where + ' ' + (j + 1) + '번째 항목';
        if (!ITEM_TYPES.includes(it.type)) { errors.push(at + ': 알 수 없는 type "' + it.type + '" (box, sub, note, table, text 중 하나)'); return; }
        if (it.type === 'table') {
          if (!Array.isArray(it.rows) || !it.rows.length) { errors.push(at + ': 표에 rows 가 없습니다.'); return; }
          const cols = (it.columns && it.columns.length) || it.rows[0].length;
          it.rows.forEach((r, k) => {
            if (!Array.isArray(r)) errors.push(at + ': rows[' + k + '] 가 배열이 아닙니다.');
            else if (r.length !== cols) warnings.push(at + ': rows[' + k + '] 칸 수(' + r.length + ')가 머리행(' + cols + ')과 다릅니다.');
          });
          if (it.widths && it.widths.length !== cols) warnings.push(at + ': widths 개수가 열 수와 다릅니다. 무시합니다.');
        } else if (!it.text || !String(it.text).trim()) {
          errors.push(at + ': text 가 비어 있습니다.');
        }
      });
    });
    if (!s.summary) warnings.push('summary(요약 한 줄)가 없습니다.');
    if (!s.team) warnings.push('team(작성 부서)이 없습니다.');

    // 결재 전에 사람이 흔히 놓치는 것들
    const year = +((String(s.year || s.date || '').match(/\d{4}/) || [])[0] || new Date().getFullYear());
    const texts = collectTexts(s);
    const dateIssues = new Set();
    texts.forEach((t) => checkWeekdays(t, year).forEach((w) => dateIssues.add(w)));
    dateIssues.forEach((w) => warnings.push('날짜 검산: ' + w));
    const doubleSpace = texts.filter((t) => /\S {2,}\S/.test(t.replace(/^\s+/, '')));
    if (doubleSpace.length) warnings.push('띄어쓰기 두 칸 이상: "' + doubleSpace[0].slice(0, 40) + '" 외 ' + (doubleSpace.length - 1) + '곳');
    const blanks = texts.filter((t) => /[○△]{2,}/.test(t)).length;
    if (blanks) warnings.push('채워야 할 자리(○○·△△)가 ' + blanks + '곳 남아 있습니다.');
    const oddEm = texts.filter((t) => t.split('**').length % 2 === 0);
    if (oddEm.length) warnings.push('굵게 표시(**)의 짝이 맞지 않는 곳: "' + oddEm[0].slice(0, 40) + '"');
    return { errors, warnings, spec: s };
  }

  /* ------------------------------------------------------------------ */
  /* 표 만들기                                                           */
  /* ------------------------------------------------------------------ */

  function cellParts(tc, key) {
    const para = (tc.match(/<hp:p\b[\s\S]*?<\/hp:p>/g) || []).find((p) => p.includes('{{' + key + '}}'));
    const open = tc.match(/^[\s\S]*?<hp:subList\b[^>]*>/)[0];
    const close = tc.slice(tc.lastIndexOf('</hp:subList>'));
    return { open, para, close };
  }

  function buildTable(protoXml, it) {
    const m = protoXml.match(/^([\s\S]*?)(<hp:tbl\b[^>]*>)([\s\S]*?)(<hp:tr>[\s\S]*<\/hp:tr>)([\s\S]*)$/);
    if (!m) throw new Error('표 원형을 해석할 수 없습니다.');
    const [, pre, tblOpen, tblHead, rowsXml, post] = m;
    const tcs = rowsXml.match(/<hp:tc\b[\s\S]*?<\/hp:tc>/g) || [];
    const find = (k) => tcs.find((t) => t.includes('{{' + k + '}}'));
    const P = { TH: find('TH'), TD: find('TD') || find('TD_KEY') || find('TH') };
    P.TD_KEY = find('TD_KEY') || P.TD;
    P.TD_LIST = find('TD_LIST') || P.TD;
    const keyOf = (tc) => (tc === find('TD_LIST') ? 'TD_LIST' : tc === find('TD_KEY') ? 'TD_KEY' : tc === find('TD') ? 'TD' : 'TH');

    const header = it.columns && it.columns.length ? it.columns : null;
    const cols = header ? header.length : it.rows[0].length;
    const W = +(tblHead.match(/<hp:sz width="(\d+)"/) || [0, 46925])[1];
    const useKey = it.keyColumn !== false && cols > 1;
    const lineH = +((P.TH || P.TD).match(/<hp:cellSz width="\d+" height="(\d+)"/) || [0, 1865])[1];
    const marginX = (() => { const m = (P.TD || P.TH).match(/<hp:cellMargin left="(\d+)" right="(\d+)"/); return m ? +m[1] + +m[2] : 1020; })();
    const charH = 1200; // 표 글자 크기(12pt) 기준 한 글자 폭 추정치

    // 글자 폭 추정: 한글·전각은 1, 영문·숫자·공백은 0.55 글자
    const textUnits = (s) => Array.from(String(s)).reduce((a, ch) => a + (ch.charCodeAt(0) < 256 ? 0.55 : 1), 0);

    let weights = Array.isArray(it.widths) && it.widths.length === cols ? it.widths.map(Number) : null;
    let cw;
    if (weights) {
      const total = weights.reduce((a, b) => a + b, 0);
      cw = weights.map((w) => Math.round((w / total) * W));
    } else if (cols === 1) {
      cw = [W];
    } else {
      // 첫 열은 가장 긴 구분명이 한 줄에 들어갈 만큼만, 나머지는 고르게
      const firstTexts = [header ? header[0] : ''].concat(it.rows.map((r) => (Array.isArray(r[0]) ? r[0].join('') : String(r[0] == null ? '' : r[0]))));
      const need = Math.max.apply(null, firstTexts.map(textUnits)) * charH * 1.08 + marginX + 400;
      const first = Math.round(Math.min(Math.max(need, W * 0.14), W * (cols === 2 ? 0.34 : 0.26)));
      cw = [first].concat(Array(cols - 1).fill(Math.round((W - first) / (cols - 1))));
    }
    cw[cols - 1] = W - cw.slice(0, -1).reduce((a, b) => a + b, 0);

    // 칸 너비로 줄바꿈 수를 추정해 행 높이를 잡는다(한글은 표 높이를 열 때 늘려주지 않는다).
    const wrapLines = (line, width, bullet) => {
      const avail = Math.max(width - marginX - (bullet ? charH * 1.3 : 0), charH * 2);
      return Math.max(1, Math.ceil((textUnits(line) * charH * 1.05) / avail));
    };
    const rows = [];
    if (header) rows.push(header.map((t) => ({ tc: P.TH, lines: [t] })));
    for (const r of it.rows) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const v = r[c] == null ? '' : r[c];
        if (Array.isArray(v)) row.push({ tc: P.TD_LIST, lines: v.map(String) });
        else row.push({ tc: c === 0 && useKey ? P.TD_KEY : P.TD, lines: String(v).split('\n') });
      }
      rows.push(row);
    }

    let totalH = 0;
    const rowXml = rows.map((row, ri) => {
      const n = Math.max.apply(null, row.map((c, ci) => c.lines.reduce((a, line) => a + wrapLines(line, cw[ci], c.tc === P.TD_LIST && c.tc !== P.TD), 0)));
      const h = lineH + (n - 1) * 1920 + (n > 1 ? 450 : 0);
      totalH += h;
      return '<hp:tr>' + row.map((cell, ci) => {
        const key = keyOf(cell.tc);
        const parts = cellParts(cell.tc, key);
        const paras = cell.lines.map((line) => normLines(fill(parts.para, { [key]: line }))).join('');
        return (parts.open + paras + parts.close)
          .replace(/<hp:cellAddr colAddr="\d+" rowAddr="\d+"\/>/, '<hp:cellAddr colAddr="' + ci + '" rowAddr="' + ri + '"/>')
          .replace(/<hp:cellSpan colSpan="\d+" rowSpan="\d+"\/>/, '<hp:cellSpan colSpan="1" rowSpan="1"/>')
          .replace(/<hp:cellSz width="\d+" height="\d+"\/>/, '<hp:cellSz width="' + cw[ci] + '" height="' + h + '"/>');
      }).join('') + '</hp:tr>';
    }).join('');

    const open = tblOpen
      .replace(/rowCnt="\d+"/, 'rowCnt="' + rows.length + '"')
      .replace(/colCnt="\d+"/, 'colCnt="' + cols + '"');
    const headXml = tblHead.replace(/(<hp:sz width="\d+" widthRelTo="\w+" height=")\d+/, '$1' + totalH);
    return renumber(normLines(fill(pre, {})) + open + headXml + rowXml + normLines(fill(post, {})));
  }

  /* ------------------------------------------------------------------ */
  /* 문서 조립                                                           */
  /* ------------------------------------------------------------------ */

  function headFields(s) {
    const now = new Date();
    const date = s.date || now.getFullYear() + '. ' + (now.getMonth() + 1) + '.';
    const year = s.year || (String(date).match(/\d{4}/) || [String(now.getFullYear())])[0];
    const ap = s.approval || [];
    const sub = s.subtitle || s.coverSubtitle;
    return Object.assign({
      TEAM: s.team || '',
      TITLE: s.title || '',
      COVER_SUBTITLE: wrapBracket(s.coverSubtitle || sub),
      HEADER_SUBTITLE: wrapBracket(sub),
      SUMMARY: s.summary || '',
      DATE: date,
      YEAR: year,
      DISCLOSURE: s.disclosure || '비공개',
      COOP: s.cooperator || '',
      POS1: ap[0] ? ap[0].position || '' : '담당',
      NAME1: ap[0] ? ap[0].name || '' : '',
      POS2: ap[1] ? ap[1].position || '' : (s.team ? s.team + '장' : ''),
      NAME2: ap[1] ? ap[1].name || '' : '',
      POS3: ap[2] ? ap[2].position || '' : '',
      NAME3: ap[2] ? ap[2].name || '' : '',
    }, s.fields || {});
  }

  const PAGE_NUM_HIDE = '<hp:ctrl><hp:pageHiding hideHeader="0" hideFooter="0" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="1"/></hp:ctrl>';

  function buildCompare(proto, lines) {
    // 표 안쪽 문단 하나만 잡는다(바깥 문단의 여는 태그부터 잡지 않도록 중간에 다른 문단 태그를 허용하지 않음).
    const lineRe = /<hp:p\b[^>]*>(?:(?!<\/?hp:p\b)[\s\S])*?\{\{CMP_TEXT\}\}(?:(?!<\/?hp:p\b)[\s\S])*?<\/hp:p>/;
    const lp = proto.match(lineRe);
    if (!lp) throw new Error('요약 비교 상자 원형을 해석할 수 없습니다.');
    const body = lines.map((c) => {
      let x = richFill(lp[0], 'CMP_TEXT', 'CMP_EM', c.text);
      x = fill(x, { CMP_LABEL: c.label, CMP_TEXT: c.text, CMP_EM: '' });
      if (!c.label) x = x.replace(/<hp:t>\(\) <\/hp:t>/, '<hp:t></hp:t>');
      return normLines(x);
    }).join('');
    const h = Math.max(1800 * lines.length, 1800);
    return renumber(normLines(proto.replace(lp[0], body))
      .replace(/(<hp:sz width="\d+" widthRelTo="\w+" height=")\d+/, '$1' + h)
      .replace(/(<hp:cellSz width="\d+" height=")\d+/, '$1' + h));
  }

  function buildBriefXml(b, tpl) {
    const P = tpl.proto;
    const missing = ['briefTitle', 'briefHead', 'briefItem'].filter((k) => !P[k]);
    if (missing.length) {
      throw new Error('이 서식에는 요약 쪽 원형이 없습니다(' + missing.map((k) => '{{' + PROTO_KEYS[k] + '}}').join(', ') + '). 기본 서식을 쓰거나 brief 를 빼세요.');
    }
    const out = [];
    const gap = (k) => { if (P[k]) out.push(clone(P[k], {})); };

    let title = P.briefTitle;
    const sub = b.subtitle ? wrapBracket(b.subtitle) : '';
    if (!sub) title = title.replace('{{BRIEF_SUBTITLE}}<hp:lineBreak/>', '{{BRIEF_SUBTITLE}}');
    out.push(clone(title, { BRIEF_SUBTITLE: sub, BRIEF_TITLE: b.title }));
    gap('briefTitleGap');
    if (b.compare.length && P.briefCompare) {
      out.push(buildCompare(P.briefCompare, b.compare));
      gap('briefCompareGap');
    }

    let hidden = false;
    b.sections.forEach((sec, si) => {
      if (si > 0) gap('briefHeadGap');
      out.push(clone(P.briefHead, { BRIEF_HEAD: sec.title }));
      gap('briefHeadGap');
      sec.items.forEach((it, ii) => {
        const next = sec.items[ii + 1];
        if (it.type === 'note') {
          out.push(P.briefNote ? clone(P.briefNote, { BRIEF_NOTE: it.text }) : clone(P.note, { NOTE: it.text }));
          if (next) gap('briefItemGap');
          return;
        }
        if (it.type === 'table') {
          if (!P.table) throw new Error('서식에 표 원형({{TH}})이 없어 표를 만들 수 없습니다.');
          out.push(buildTable(P.table, it));
          if (next) gap('briefItemGap');
          return;
        }
        let x = cloneRich(P.briefItem, 'BRIEF_TEXT', 'BRIEF_EM', it.text, { BRIEF_LABEL: it.label || '' });
        if (!it.label) x = x.replace(/<hp:t>\(\) <\/hp:t>/, '<hp:t></hp:t>');
        if (!hidden) { x = x.replace('</hp:t></hp:run>', '</hp:t>' + PAGE_NUM_HIDE + '</hp:run>'); hidden = true; }
        out.push(x);
        if (next && next.type !== 'note') gap('briefItemGap');
      });
    });
    return out.join('');
  }

  function buildSectionXml(spec, tpl) {
    const s = normalizeSpec(spec);
    const P = tpl.proto;
    const out = [];
    const blank = () => out.push(clone(P.blank, {}));

    const renderItems = (items) => items.forEach((it, ii) => {
      if (it.type === 'box') {
        if (ii > 0) blank();
        if (it.label) out.push(cloneRich(P.box, 'BOX_TEXT', 'BOX_EM', it.text, { BOX_LABEL: it.label }));
        else if (P.plain) out.push(cloneRich(P.plain, 'PLAIN', 'PLAIN_EM', it.text));
        else out.push(cloneRich(P.box, 'BOX_TEXT', 'BOX_EM', it.text, { BOX_LABEL: '' }).replace('<hp:t>()</hp:t>', '<hp:t></hp:t>'));
      } else if (it.type === 'sub') {
        if (P.sub) out.push(cloneRich(P.sub, 'SUB', 'SUB_EM', it.text));
        else out.push(clone(P.para || P.plain, { PARA: '   ㅇ ' + it.text, PLAIN: 'ㅇ ' + it.text }));
      } else if (it.type === 'note') {
        out.push(clone(P.note, { NOTE: it.text }));
      } else if (it.type === 'text') {
        if (ii > 0) blank();
        out.push(clone(P.para || P.plain, { PARA: it.text, PLAIN: it.text }));
      } else if (it.type === 'table') {
        if (!P.table) throw new Error('서식에 표 원형({{TH}})이 없어 표를 만들 수 없습니다.');
        out.push(buildTable(P.table, it));
      }
    });

    s.sections.forEach((sec, si) => {
      out.push(clone(P.sectionHeader, { SEC_NUM: ROMAN[si] || String(si + 1), SEC_TITLE: sec.title }));
      blank();
      renderItems(sec.items);
      blank();
    });

    if (s.attachments.length) {
      blank();
      const many = s.attachments.length > 1;
      s.attachments.forEach((a, i) => {
        let line = a.trim();
        if (!/부\.?$/.test(line)) line += '  1부.';
        if (!line.endsWith('.')) line += '.';
        const text = (i === 0 ? '붙임  ' : '      ') + (many ? (i + 1) + '. ' : '') + line + (i === s.attachments.length - 1 ? '  끝.' : '');
        out.push(clone(P.para || P.plain, { PARA: text, PLAIN: text }));
      });
    }

    if (s.appendices.length) {
      if (!P.appendixHeader) throw new Error('이 서식에는 첨부 쪽 원형({{APX_TITLE}})이 없습니다. 기본 서식을 쓰거나 appendices 를 빼세요.');
      s.appendices.forEach((a, ai) => {
        const num = s.appendices.length > 1 ? '첨부 ' + (ai + 1) : '첨부';
        out.push(clone(P.appendixHeader, { APX_NUM: num, APX_TITLE: a.title }));
        blank();
        renderItems(a.items);
        blank();
      });
    }

    const hf = headFields(s);
    let head;
    if (s.brief) {
      const brief = buildBriefXml(s.brief, tpl);
      head = tpl.headBefore != null ? fill(tpl.headBefore, hf) + brief + fill(tpl.headAfter, hf) : fill(tpl.head, hf) + brief;
    } else {
      head = fill(tpl.head, hf);
    }
    return head + out.join('') + tpl.tail;
  }

  function previewText(sectionXml) {
    return Array.from(sectionXml.matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g), (m) => unesc(m[1])).join('\r\n').slice(0, 4000);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function suggestFileName(spec, when) {
    const d = when || new Date();
    const stamp = pad(d.getFullYear() % 100) + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
    const clean = (x) => String(x || '').replace(/[\\/:*?"<>|]/g, '').trim();
    const team = clean(spec.team);
    return (team ? '(' + team + ')' : '') + (clean(spec.title) || '공문') + '_' + stamp + '.hwpx';
  }

  async function loadTemplate(templateBytes, codec) {
    const { files, order } = await unzip(templateBytes, codec);
    const tpl = parseTemplate(files);
    return { files, order, tpl };
  }

  async function buildHwpx(spec, template, opts) {
    opts = opts || {};
    const codec = opts.codec || defaultCodec();
    const loaded = template instanceof Uint8Array ? await loadTemplate(template, codec) : template;
    const { errors, spec: s } = validateSpec(spec);
    if (errors.length) throw new Error('내용(JSON)에 오류가 있습니다.\n- ' + errors.join('\n- '));

    const sectionXml = buildSectionXml(s, loaded.tpl);
    const files = Object.assign({}, loaded.files);
    files['Contents/section0.xml'] = te.encode(sectionXml);
    files['Preview/PrvText.txt'] = te.encode(previewText(sectionXml));
    delete files['Preview/PrvImage.png'];
    if (files['Contents/content.hpf']) {
      const hpf = td.decode(files['Contents/content.hpf'])
        .replace(/<opf:title>[\s\S]*?<\/opf:title>|<opf:title\/>/, '<opf:title>' + esc(s.title) + '</opf:title>');
      files['Contents/content.hpf'] = te.encode(hpf);
    }
    if (!files.mimetype) files.mimetype = te.encode('application/hwp+zip');

    const names = ['mimetype'].concat(loaded.order.filter((n) => n !== 'mimetype' && files[n]));
    for (const n of Object.keys(files)) if (!names.includes(n)) names.push(n);
    return zip(names.map((name) => ({ name, data: files[name] })), codec);
  }

  return {
    buildHwpx,
    loadTemplate,
    validateSpec,
    normalizeSpec,
    buildSectionXml,
    parseTemplate,
    suggestFileName,
    topParagraphs,
    unzip,
    zip,
    crc32,
    defaultCodec,
    ROMAN,
  };
});
