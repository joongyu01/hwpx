# hwpx-gongmun

AI가 쓴 내용을 결재표·표지·Ⅰ/Ⅱ 장 제목·□/ㅇ/* 개조식 서식이 갖춰진 한글 공문(.hwpx)으로 만든다.

hwpx를 처음부터 새로 짓지 않고, 실제 결재 문서에서 뽑은 서식 원형의 문단·표를 복제해 글자만 바꾼다. 그래서 한글에서 서식이 깨지지 않는다.

## 쓰는 방법 세 가지

| 누가 | 무엇을 | 방법 |
|---|---|---|
| Claude 사용자 | 스킬 | `dist/hwpx-gongmun.skill` 설치 후 "공문 써줘" |
| 누구나(다른 AI 포함) | 웹 생성기 | `dist/공문생성기.html` 더블클릭 → 요청문 복사 → AI 답변 붙여넣기 → 내려받기 |
| 개발자 | 명령줄 | `node skill/hwpx-gongmun/scripts/build.js 내용.json` |

웹 생성기는 파일 하나짜리이며 외부 서버나 인터넷을 쓰지 않는다. 사내망에서도 그대로 열린다. 내용은 브라우저 밖으로 나가지 않는다.

## 문서 유형

장(章) 구성은 기관이 달라도 거의 같다. 국가공무원인재개발원 「정책기획 실습」(2018)의 대표 보고서 유형·기본구조·구성사례와 부처 계획서 목차를 바탕으로 12개 유형을 정리했다. 웹에서는 유형을 고르면 장 구성이 요청문에 들어가고, 빈 틀을 바로 불러올 수 있다.

| 묶음 | 유형 | 장 구성 |
|---|---|---|
| 계획 | 추진 계획(안) | 추진배경 · 현황 및 문제점 · 추진 계획 · 소요 예산(선택) · 기대효과 · 향후 일정 및 행정사항 |
| 계획 | 시스템 구축 계획(안) | 추진배경 · 구축 개요 · 주요 기능 · 보안 및 개인정보 보호 · 기대효과 · 향후 일정 및 행정사항 |
| 계획 | 종합계획·중장기 전략 | 추진배경 및 경과 · 여건 분석 · 비전 및 추진전략 · 중점 추진과제 · 재정 소요(선택) · 추진체계 및 향후계획 |
| 계획 | 연간 사업계획 | 일반 현황 · 전년도 성과와 반성 · 올해 사업계획 · 추진 일정 · 기대효과 |
| 계획 | 행사·회의 개최 계획 | 개최 목적 · 행사 개요 · 세부 진행계획 · 준비사항 및 업무분장 · 소요 예산(선택) · 행정사항 |
| 결과·상황 | 결과 보고 | 추진 개요 · 추진 결과 · 주요 성과 · 문제점 및 개선사항 · 향후 계획 |
| 결과·상황 | 행사·회의 결과 보고 | 개최 개요 · 주요 논의 내용 · 결정사항 및 후속조치 · 성과 및 시사점 |
| 결과·상황 | 상황·동향 보고 | 보고 배경 · 상황 및 경과 · 쟁점 및 전망 · 대응 조치 및 계획 |
| 검토·개선 | 검토 보고 | 검토 배경 · 주요 내용 · 검토 의견 · 결론 및 건의 |
| 검토·개선 | 개선 방안 | 현황과 실태 · 문제점 · 개선 방안 · 기대효과 · 향후 계획 |
| 검토·개선 | 진단·분석 보고 | 진단 개요 · 진단 결과 · 시사점 · 개선 방안 · 향후 계획 |
| 협조 | 협조 요청 | 요청 배경 · 요청 사항 · 협조 기한 및 방법 · 행정사항 |

유형 정의는 `skill/hwpx-gongmun/scripts/doctypes.js` 한 곳에 있다. 유형을 추가하거나 장 구성을 고치면 `node tools/build-web.js`로 웹에도 반영된다.

```bash
node skill/hwpx-gongmun/scripts/doctypes.js                       # 유형 목록
node skill/hwpx-gongmun/scripts/doctypes.js review --skeleton 틀.json
node skill/hwpx-gongmun/scripts/build.js 틀.json                   # 작성 요령이 담긴 빈 양식 hwpx
```

## 스킬 설치

- **Claude 데스크톱·claude.ai**: 설정의 스킬(Capabilities → Skills)에서 `hwpx-gongmun.skill`을 올린다.
- **Claude Code**: 압축을 풀어 `~/.claude/skills/hwpx-gongmun/`에 둔다. 팀 저장소라면 `.claude/skills/hwpx-gongmun/`에 두면 팀원 모두 쓴다.

스킬은 Node.js 18 이상이 필요하다. Windows에 한글이 깔려 있으면 Claude가 결과를 실제로 열어 쪽 이미지로 확인한다.

## 폴더 구조

```
skill/hwpx-gongmun/          ← 스킬 본체 (배포 단위)
  SKILL.md                   작업 순서와 공문 문체 규칙
  scripts/core.js            생성기 (Node·브라우저 공용, 의존성 없음)
  scripts/build.js           명령줄 생성
  scripts/inspect.js         hwpx 문단 구조 보기 (새 서식 만들 때)
  scripts/hwp-preview.ps1    한글로 열어 PDF·PNG 저장 (Windows)
  templates/default.hwpx     기본 서식 원형
  references/spec.md         내용 JSON 형식
  references/template-guide.md  부서 서식 등록 방법
  examples/good-station.json 예시
web-src/                     웹 생성기 원본 (page.html, 요청문 prompt.md)
web/index.html               빌드된 웹 생성기
tools/                       서식 만들기·웹 빌드·배포 묶기
```

## 고친 뒤 다시 만들기

```bash
node tools/build-web.js
node tools/package.js
```

기본 서식을 원본 결재 문서에서 다시 뽑을 때는 `node tools/make-template.js <원본.hwpx> skill/hwpx-gongmun/templates/default.hwpx`를 쓴다. 이 스크립트는 AI전환팀 계획(안) 문서 구조에 맞춰져 있다.

## 알아둘 것

- 기본 서식 표지에 한국석유관리원 로고가 들어 있다. 외부에 공개할 때는 로고를 뺀 서식을 따로 만든다.
- 사내 DRM이 걸린 hwpx는 zip으로 읽을 수 없다. 한글에서 hwpx로 다시 저장한 파일을 쓴다.
- 웹 생성기의 GitHub Pages 배포는 `web/index.html` 한 파일만 올리면 된다.
