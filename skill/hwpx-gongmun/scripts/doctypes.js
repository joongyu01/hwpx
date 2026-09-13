/*
 * 공문 유형별 장(章) 구성
 *
 * 근거
 *  - 국가공무원인재개발원 「정책기획 실습」(2018) 3장 "보고서를 잘 작성하는 방법"
 *    · 대표 보고서 유형 5종: 정책, 검토, 상황·동향, 행사·회의 계획, 결과 보고서
 *    · 보고서 기본구조: 검토배경(목적) → 현황 및 문제점 → 개선방안(대책, 추진계획) → 추진일정(향후계획)
 *      예상문제점 및 대책, 홍보계획, 소요예산, 행정사항은 필요시 추가
 *    · 구성 사례: A 대책·대안 제시형, B 계속 추진사업형, C 진단·분석형
 *    · 도입부 "비전 및 전략" 표(비전·목표 → 추진전략 → 중점 추진과제)
 *  - 관계부처 「혁신성장동력 시행계획」: 추진배경 및 경과 → 목표 → 보완사항 → 시행계획 → 재정소요 → 향후계획
 *
 * Node 에서 명령으로 쓸 수 있다.
 *   node doctypes.js                          유형 목록
 *   node doctypes.js result                   결과 보고의 장 구성
 *   node doctypes.js result --skeleton 틀.json  빈 틀 내용 JSON 저장(build.js 로 바로 hwpx 가능)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GongmunDocTypes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GROUPS = [
    { id: 'plan', name: '계획', desc: '일을 시작하기 전에 결재받는 문서' },
    { id: 'report', name: '결과·상황', desc: '진행 중이거나 끝난 일을 알리는 문서' },
    { id: 'review', name: '검토·개선', desc: '판단이나 대책이 필요한 문서' },
    { id: 'request', name: '협조', desc: '다른 부서의 도움을 구하는 문서' },
  ];

  const SCHEDULE_TABLE = { columns: ['일정', '추진 내용', '담당'], rows: [['○월 ○주', '○○○', '○○팀'], ['○월 ○주', '○○○', '○○팀']] };
  const ROLE_TABLE = { columns: ['구분', '○○팀', '○○팀'], rows: [['역할', ['○○○', '○○○'], ['○○○', '○○○']]] };

  const TYPES = [
    /* ---------------- 계획 ---------------- */
    {
      id: 'plan',
      group: 'plan',
      name: '추진 계획(안)',
      when: '새 사업·제도·과제를 시작하기 전에 방향과 방법을 결재받을 때',
      basis: '인재개발원 보고서 기본구조',
      titleHint: '○○ 추진 계획(안)',
      subtitleHint: '○○을 위한',
      summaryHint: '○○을 위해 ○○을 추진하고자 함',
      sections: [
        { title: '추진배경', guide: '왜 지금 해야 하는지. 추진 근거(법령·지시·계획), 필요성, 목적', labels: ['추진근거', '필요성'] },
        { title: '현황 및 문제점', guide: '지금 상태와 해결할 문제를 수치·사례로 제시', labels: ['현황', '문제점'] },
        { title: '추진 계획', guide: '기본방향, 세부 추진내용, 추진체계(역할 분담)', labels: ['기본방향', '세부내용', '추진체계'], table: ROLE_TABLE },
        { title: '소요 예산', guide: '재원과 산출근거. 예산이 없으면 "별도 예산 없음"으로 적음', labels: ['소요예산'], optional: true },
        { title: '기대효과', guide: '정량 효과를 먼저, 정성 효과를 다음에', labels: ['○○ 효과', '○○ 효과'] },
        { title: '향후 일정 및 행정사항', guide: '단계별 일정과 관계 부서 협조사항', labels: ['협조요청'], table: SCHEDULE_TABLE, tableFirst: true },
      ],
      extras: ['예상 문제점 및 대책', '홍보 계획'],
    },
    {
      id: 'system',
      group: 'plan',
      name: '시스템 구축 계획(안)',
      when: '정보시스템·웹서비스·자동화 도구를 자체 개발하거나 도입할 때',
      basis: '추진 계획(안)의 정보화 사업 변형',
      titleHint: '○○ 시스템 구축 계획(안)',
      subtitleHint: '○○ 업무 효율화를 위한',
      summaryHint: '○○을 ○○하는 「○○ 시스템」을 구축하고자 함',
      sections: [
        { title: '추진배경', guide: '현업의 불편, 현행 방식의 한계, 구축 필요성', labels: ['현업 수요', '현행 한계'] },
        { title: '구축 개요', guide: '시스템명, 대상·범위, 추진체계, 개발 방법', labels: ['시스템명', '적용범위', '추진체계'], table: ROLE_TABLE },
        { title: '주요 기능', guide: '사용자가 할 수 있는 일을 기능 단위로', labels: ['○○ 기능', '○○ 기능'] },
        { title: '보안 및 개인정보 보호', guide: '접근통제, 인증, 권한 분리, 자료 보관', labels: ['접근통제', '권한분리'] },
        { title: '기대효과', guide: '업무시간 절감, 예산 절감, 관리 투명성', labels: ['업무 효율', '예산 절감'] },
        { title: '향후 일정 및 행정사항', guide: '시범운영, 보완, 정식운영 일정', labels: ['협조요청'], table: SCHEDULE_TABLE, tableFirst: true },
      ],
      extras: ['소요 예산', '운영 매뉴얼·교육 계획'],
    },
    {
      id: 'master',
      group: 'plan',
      name: '종합계획·중장기 전략',
      when: '여러 해에 걸친 정책·사업의 비전, 전략, 중점과제를 한꺼번에 제시할 때',
      basis: '혁신성장동력 시행계획, 인재개발원 "비전 및 전략" 도입부',
      titleHint: '○○ 종합계획(2026~2028)',
      subtitleHint: '○○ 경쟁력 강화를 위한',
      summaryHint: '○○을 목표로 ○대 전략 ○○개 과제를 추진하고자 함',
      sections: [
        { title: '추진배경 및 경과', guide: '정책 환경 변화와 그간의 추진 경과', labels: ['추진배경', '추진경과'] },
        { title: '여건 분석', guide: '그간의 성과와 한계, 대내외 환경 변화', labels: ['성과', '한계', '환경변화'] },
        { title: '비전 및 추진전략', guide: '비전·목표 → 추진전략 → 중점과제. 전략 수와 과제 묶음 수를 맞춤', labels: ['비전', '목표'], table: { columns: ['추진전략', '중점 추진과제'], rows: [['① ○○○', ['○○○', '○○○']], ['② ○○○', ['○○○', '○○○']]] } },
        { title: '중점 추진과제', guide: '전략별로 과제를 풀어 씀. 과제마다 현황→추진내용', labels: ['과제 1', '과제 2'] },
        { title: '재정 소요', guide: '연도별 소요 예산과 재원', labels: ['총 소요'], optional: true },
        { title: '추진체계 및 향후계획', guide: '추진 조직, 점검 방식, 연차별 일정', labels: ['추진체계', '성과관리'], table: SCHEDULE_TABLE },
      ],
      extras: ['과제별 세부 시행계획(붙임)'],
    },
    {
      id: 'annual',
      group: 'plan',
      name: '연간 사업계획',
      when: '매년 계속하는 사업의 올해 계획을 전년 실적과 함께 보고할 때',
      basis: '인재개발원 구성사례 B(계속 추진사업형)',
      titleHint: '2026년 ○○ 사업계획',
      subtitleHint: '○○ 사업의 내실화를 위한',
      summaryHint: '전년도 성과를 바탕으로 2026년 ○○ 사업을 ○○ 중심으로 추진하고자 함',
      sections: [
        { title: '일반 현황', guide: '사업 목적, 대상, 규모, 근거', labels: ['사업개요', '추진근거'] },
        { title: '전년도 성과와 반성', guide: '계획 대비 실적, 잘된 점과 부족한 점', labels: ['주요 성과', '미흡 사항'], table: { columns: ['구분', '목표', '실적', '달성률'], rows: [['○○', '○○건', '○○건', '○○%']] } },
        { title: '올해 사업계획', guide: '추진 방향과 세부 사업, 전년 대비 달라지는 점', labels: ['추진방향', '세부사업'] },
        { title: '추진 일정', guide: '분기·월별 일정', labels: [], table: SCHEDULE_TABLE },
        { title: '기대효과', guide: '올해 목표 달성 시 효과', labels: ['○○ 효과'] },
      ],
      extras: ['소요 예산', '성과 지표'],
    },
    {
      id: 'event-plan',
      group: 'plan',
      name: '행사·회의 개최 계획',
      when: '행사·회의·교육·설명회를 열기 전에 계획과 업무분장을 공유할 때',
      basis: '인재개발원 행사·회의 계획보고서',
      titleHint: '○○ 설명회 개최 계획',
      subtitleHint: '○○ 현장 의견 수렴을 위한',
      summaryHint: '○○을 위해 ○월 ○일 ○○ 설명회를 개최하고자 함',
      sections: [
        { title: '개최 목적', guide: '행사를 여는 이유와 기대하는 결과', labels: ['목적'] },
        { title: '행사 개요', guide: '일시, 장소, 참석 대상, 주요 내용', labels: [], table: { columns: ['구분', '내용'], rows: [['일시', '2026. ○. ○.(○) 00:00~00:00'], ['장소', '○○ 회의실'], ['참석', '○○ 등 ○○명'], ['주요내용', '○○ 발표, 질의응답']] } },
        { title: '세부 진행계획', guide: '시간대별 순서와 진행자', labels: [], table: { columns: ['시간', '내용', '비고'], rows: [['00:00~00:10', '개회 및 인사말', '○○장'], ['00:10~00:40', '○○ 발표', '○○팀']] } },
        { title: '준비사항 및 업무분장', guide: '누가 무엇을 언제까지 준비하는지', labels: [], table: { columns: ['구분', '내용', '담당'], rows: [['장소·장비', '○○○', '○○팀'], ['자료', '○○○', '○○팀']] } },
        { title: '소요 예산', guide: '항목별 금액과 집행 과목', labels: ['소요예산'], optional: true },
        { title: '행정사항', guide: '참석 협조, 복장, 주차, 문의처', labels: ['협조요청', '문의'] },
      ],
      extras: ['홍보 계획', '안전 대책'],
    },

    /* ---------------- 결과·상황 ---------------- */
    {
      id: 'result',
      group: 'report',
      name: '결과 보고',
      when: '사업·점검·교육 등이 끝난 뒤 결과와 성과를 보고할 때',
      basis: '인재개발원 결과보고서(계획 대비 성과, 문제점, 개선방안, 향후 고려사항)',
      titleHint: '○○ 추진 결과 보고',
      subtitleHint: '',
      summaryHint: '○○을 추진한 결과 ○○ 성과를 거두었으며, 향후 ○○을 보완하고자 함',
      sections: [
        { title: '추진 개요', guide: '목적, 기간, 대상, 방법. 최초 계획 보고와 연결', labels: ['목적', '기간·대상'] },
        { title: '추진 결과', guide: '계획 대비 실적을 수치로', labels: ['추진실적'], table: { columns: ['구분', '계획', '실적', '비고'], rows: [['○○', '○○건', '○○건', '']] } },
        { title: '주요 성과', guide: '정량 성과와 정성 성과. 사진·통계는 붙임으로', labels: ['정량 성과', '정성 성과'] },
        { title: '문제점 및 개선사항', guide: '추진 중 드러난 문제와 원인, 개선 방향', labels: ['문제점', '개선방향'] },
        { title: '향후 계획', guide: '후속 조치와 다음 추진 시 고려사항', labels: ['후속조치'] },
      ],
      extras: ['붙임: 사진, 통계, 설문 결과'],
    },
    {
      id: 'event-result',
      group: 'report',
      name: '행사·회의 결과 보고',
      when: '행사·회의가 끝난 뒤 논의 내용과 결정사항, 후속조치를 알릴 때',
      basis: '인재개발원 행사·회의보고서(종료 후 결과보고로 연계)',
      titleHint: '○○ 회의 결과 보고',
      subtitleHint: '',
      summaryHint: '○○ 회의를 개최하여 ○○을 결정하였으며, 후속조치를 추진하고자 함',
      sections: [
        { title: '개최 개요', guide: '일시, 장소, 참석자, 안건', labels: [], table: { columns: ['구분', '내용'], rows: [['일시', '2026. ○. ○.(○) 00:00~00:00'], ['장소', '○○'], ['참석', '○○ 등 ○○명'], ['안건', '○○○']] } },
        { title: '주요 논의 내용', guide: '안건별 발언 요지와 쟁점', labels: ['안건 1', '안건 2'] },
        { title: '결정사항 및 후속조치', guide: '결정된 것과 누가 언제까지 할지', labels: [], table: { columns: ['결정사항', '조치내용', '담당', '기한'], rows: [['○○○', '○○○', '○○팀', '○. ○.']] } },
        { title: '성과 및 시사점', guide: '행사로 얻은 것과 다음에 반영할 점', labels: ['성과', '시사점'] },
      ],
      extras: ['붙임: 회의자료, 참석자 명단, 사진'],
    },
    {
      id: 'status',
      group: 'report',
      name: '상황·동향 보고',
      when: '사건·사고·민원·언론 보도 등 진행 중인 상황을 신속히 알릴 때',
      basis: '인재개발원 상황·동향보고서(보고배경 → 상황 및 문제점)',
      titleHint: '○○ 관련 상황 보고',
      subtitleHint: '',
      summaryHint: '○○이 발생하여 현재까지의 상황과 대응 계획을 보고함',
      sections: [
        { title: '보고 배경', guide: '무슨 일인지 한두 문장. 목적·취지·필요성', labels: ['개요'] },
        { title: '상황 및 경과', guide: '발생부터 현재까지 시간 순서. 일시를 명시', labels: ['발생', '경과'] },
        { title: '쟁점 및 전망', guide: '문제가 되는 점, 예상되는 파장과 전망', labels: ['쟁점', '전망'] },
        { title: '대응 조치 및 계획', guide: '지금까지 한 조치와 앞으로 할 조치', labels: ['조치사항', '향후계획'] },
      ],
      extras: ['언론 대응', '관계기관 협조'],
    },

    /* ---------------- 검토·개선 ---------------- */
    {
      id: 'review',
      group: 'review',
      name: '검토 보고',
      when: '제도·요청·사안에 대해 사실과 주장을 비교해 의사결정을 받을 때',
      basis: '인재개발원 검토보고서',
      titleHint: '○○ 검토 보고',
      subtitleHint: '',
      summaryHint: '○○에 대해 검토한 결과 ○안이 적정하여 ○○을 건의함',
      sections: [
        { title: '검토 배경', guide: '누가 무엇을 요청했는지, 검토 목적', labels: ['요청내용', '검토목적'] },
        { title: '주요 내용', guide: '사안의 사실관계와 쟁점', labels: ['사실관계', '쟁점'] },
        { title: '검토 의견', guide: '대안별 장단점을 비교하고 판단 근거 제시', labels: ['검토결과'], table: { columns: ['구분', '1안(○○)', '2안(○○)'], rows: [['내용', '○○○', '○○○'], ['장점', '○○○', '○○○'], ['단점', '○○○', '○○○']] } },
        { title: '결론 및 건의', guide: '채택안과 결정 후 조치 계획', labels: ['결론', '조치계획'] },
      ],
      extras: ['관련 법령·규정(붙임)'],
    },
    {
      id: 'improve',
      group: 'review',
      name: '개선 방안',
      when: '드러난 문제에 대한 대책·대안을 제시할 때',
      basis: '인재개발원 구성사례 A(대책·대안 제시형)',
      titleHint: '○○ 개선 방안',
      subtitleHint: '○○ 실효성 제고를 위한',
      summaryHint: '○○의 문제점을 개선하기 위해 ○○ 방안을 추진하고자 함',
      sections: [
        { title: '현황과 실태', guide: '제도·업무의 현재 운영 상태를 수치로', labels: ['운영현황', '실태'] },
        { title: '문제점', guide: '문제와 원인. 쟁점이 있으면 함께', labels: ['문제점', '원인'] },
        { title: '개선 방안', guide: '문제점과 1:1로 대응하는 대책', labels: ['개선 1', '개선 2'], table: { columns: ['문제점', '개선 방안'], rows: [['○○○', '○○○'], ['○○○', '○○○']] } },
        { title: '기대효과', guide: '개선 후 달라지는 점', labels: ['○○ 효과'] },
        { title: '향후 계획', guide: '시행 일정, 규정 개정 등 후속 절차', labels: [], table: SCHEDULE_TABLE },
      ],
      extras: ['예상 문제점 및 대책'],
    },
    {
      id: 'diagnosis',
      group: 'review',
      name: '진단·분석 보고',
      when: '실태조사·점검·데이터 분석 결과와 시사점을 보고할 때',
      basis: '인재개발원 구성사례 C(진단·분석형)',
      titleHint: '○○ 실태 진단 결과',
      subtitleHint: '',
      summaryHint: '○○을 진단한 결과 ○○이 확인되어 ○○을 개선하고자 함',
      sections: [
        { title: '진단 개요', guide: '목적, 대상, 기간, 방법(조사·분석 방식)', labels: ['목적', '대상·방법'] },
        { title: '진단 결과', guide: '분석 결과를 항목별로. 표·수치 중심', labels: ['○○ 분석', '○○ 분석'], table: { columns: ['항목', '결과', '비고'], rows: [['○○', '○○%', '']] } },
        { title: '시사점', guide: '결과가 뜻하는 것, 우선 해결할 점', labels: ['시사점'] },
        { title: '개선 방안', guide: '진단 결과에 근거한 대책', labels: ['개선방안'] },
        { title: '향후 계획', guide: '후속 조치와 재점검 일정', labels: ['후속조치'] },
      ],
      extras: ['붙임: 조사표, 세부 분석자료'],
    },

    /* ---------------- 협조 ---------------- */
    {
      id: 'request',
      group: 'request',
      name: '협조 요청',
      when: '다른 부서·기관에 자료 제출, 업무 협조, 의견을 요청할 때',
      basis: '행정업무 협조 문서 관행',
      titleHint: '○○ 관련 협조 요청',
      subtitleHint: '',
      summaryHint: '○○을 위해 ○○ 협조를 요청함',
      sections: [
        { title: '요청 배경', guide: '왜 협조가 필요한지, 관련 근거', labels: ['추진배경', '관련근거'] },
        { title: '요청 사항', guide: '구체적으로 무엇을 해 달라는지', labels: ['요청내용'], table: { columns: ['구분', '요청 내용', '비고'], rows: [['○○', '○○○', '']] } },
        { title: '협조 기한 및 방법', guide: '언제까지, 어떤 방식(양식·메일·시스템)으로', labels: ['기한', '제출방법'] },
        { title: '행정사항', guide: '담당자, 연락처, 문의처', labels: ['문의'] },
      ],
      extras: ['붙임: 제출 양식'],
    },
  ];

  const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
  const byId = (id) => TYPES.find((t) => t.id === id);

  // 빈 틀: 그대로 build.js 에 넣으면 장 구성과 작성 요령이 담긴 hwpx 가 나온다.
  function skeleton(id, opts) {
    opts = opts || {};
    const t = byId(id);
    if (!t) throw new Error('알 수 없는 문서 유형: ' + id);
    const sections = t.sections.filter((s) => opts.includeOptional || !s.optional).map((s) => {
      const items = [];
      const boxes = (s.labels.length ? s.labels : []).map((label) => ({ type: 'box', label, text: '○○○' }));
      const table = s.table ? Object.assign({ type: 'table' }, JSON.parse(JSON.stringify(s.table))) : null;
      if (table && s.tableFirst) items.push(table);
      boxes.forEach((b, i) => {
        items.push(b);
        if (i === 0) items.push({ type: 'note', text: '(작성 요령) ' + s.guide });
      });
      if (!boxes.length) items.push({ type: 'note', text: '(작성 요령) ' + s.guide });
      if (table && !s.tableFirst) items.push(table);
      return { title: s.title, items };
    });
    return {
      docType: t.id,
      team: opts.team || '',
      title: opts.title || t.titleHint,
      subtitle: t.subtitleHint || undefined,
      summary: t.summaryHint,
      sections,
    };
  }

  // AI 요청문에 붙일 유형 설명
  function promptFor(id) {
    const t = byId(id);
    if (!t) return '';
    const lines = [];
    lines.push('## 문서 유형: ' + t.name);
    lines.push('- 쓰임: ' + t.when);
    lines.push('- 제목 예: ' + t.titleHint + (t.subtitleHint ? ' / 부제 예: ' + t.subtitleHint : ' / 부제는 필요할 때만'));
    lines.push('- summary 예: ' + t.summaryHint);
    lines.push('- 장 구성(이 순서와 장 제목을 따른다. "선택" 장은 자료가 있을 때만 넣는다):');
    t.sections.forEach((s, i) => {
      const hint = [s.guide];
      if (s.labels.length) hint.push('□ 라벨 예: ' + s.labels.join(', '));
      if (s.table) hint.push('표 권장: ' + s.table.columns.join(' | '));
      lines.push('  ' + (ROMAN[i] || i + 1) + '. ' + s.title + (s.optional ? ' (선택)' : '') + ' — ' + hint.join(' / '));
    });
    if (t.extras && t.extras.length) lines.push('- 필요하면 장으로 추가: ' + t.extras.join(', '));
    return lines.join('\n');
  }

  return { GROUPS, TYPES, byId, skeleton, promptFor };
});

/* ---------------- 명령줄 ---------------- */
if (typeof module === 'object' && typeof require === 'function' && require.main === module) {
  const D = module.exports;
  const fs = require('fs');
  const [id, flag, out] = process.argv.slice(2);
  if (!id) {
    for (const g of D.GROUPS) {
      console.log('\n[' + g.name + '] ' + g.desc);
      D.TYPES.filter((t) => t.group === g.id).forEach((t) => console.log('  ' + t.id.padEnd(13) + t.name.padEnd(16) + t.when));
    }
    console.log('\n장 구성 보기: node doctypes.js <id>   빈 틀 만들기: node doctypes.js <id> --skeleton 틀.json');
  } else if (flag === '--skeleton') {
    const json = JSON.stringify(D.skeleton(id), null, 2);
    if (out) { fs.writeFileSync(out, json); console.log('저장: ' + out); } else console.log(json);
  } else {
    const text = D.promptFor(id);
    if (!text) { console.error('알 수 없는 유형: ' + id); process.exit(1); }
    console.log(text);
  }
}
