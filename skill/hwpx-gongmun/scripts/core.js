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

  const fill = (xml, map) => xml.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => esc(map[k]));

  // linesegarray 는 한글이 저장해 둔 줄 배치 결과다. 글자를 바꾼 문단에 옛 값이 남으면 한글이 그 값을 믿고
  // 긴 문장을 한 줄에 겹쳐 그린다. 지워 두면 열 때 다시 배치한다.
  const normLines = (xml) => xml.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');

  let idSeq = 1900000000 + Math.floor(Math.random() * 100000000);
  const renumber = (xml) => xml.replace(/<hp:tbl id="\d+"/g, () => '<hp:tbl id="' + (idSeq++) + '"');

  const clone = (xml, map) => renumber(normLines(fill(xml, map)));

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
    return { head, tail, proto, placeholders };
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
    return s;
  }

  function validateSpec(spec) {
    const s = normalizeSpec(spec);
    const errors = [];
    const warnings = [];
    if (!s.title || !String(s.title).trim()) errors.push('title(문서 제목)이 비어 있습니다.');
    if (!s.sections.length) errors.push('sections(본문 장)가 하나도 없습니다.');
    s.sections.forEach((sec, i) => {
      const where = (ROMAN[i] || i + 1) + '장';
      if (!sec.title) errors.push(where + ': title(장 제목)이 비어 있습니다.');
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

  function buildSectionXml(spec, tpl) {
    const s = normalizeSpec(spec);
    const P = tpl.proto;
    const out = [];
    const blank = () => out.push(clone(P.blank, {}));

    s.sections.forEach((sec, si) => {
      out.push(clone(P.sectionHeader, { SEC_NUM: ROMAN[si] || String(si + 1), SEC_TITLE: sec.title }));
      blank();
      sec.items.forEach((it, ii) => {
        if (it.type === 'box') {
          if (ii > 0) blank();
          if (it.label) out.push(clone(P.box, { BOX_LABEL: it.label, BOX_TEXT: it.text }));
          else if (P.plain) out.push(clone(P.plain, { PLAIN: it.text }));
          else out.push(clone(P.box, { BOX_LABEL: '', BOX_TEXT: it.text }).replace('<hp:t>()</hp:t>', '<hp:t></hp:t>'));
        } else if (it.type === 'sub') {
          if (P.sub) out.push(clone(P.sub, { SUB: it.text }));
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

    return fill(tpl.head, headFields(s)) + out.join('') + tpl.tail;
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
