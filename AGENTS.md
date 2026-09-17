# AI 작업 안내 (Claude 외 AI 공용)

이 저장소는 한글 결재 문서(.hwpx)를 만든다. ChatGPT, Gemini, Codex, Cursor 등 어떤 AI든 아래 순서대로 하면 Claude 스킬과 같은 결과가 나온다.

## 코드를 실행할 수 있는 AI

1. `skill/hwpx-gongmun/references/writing-guide.md`를 읽는다. 문장·수치·요약 쪽·첨부 쪽·결과 보고 규칙과 JSON 예시가 있다.
2. 형식 세부는 `skill/hwpx-gongmun/references/spec.md`, 장 구성은 `node skill/hwpx-gongmun/scripts/doctypes.js <유형>`으로 본다.
3. 사용자의 자료로 내용 JSON을 쓴다. 전체 예시는 `skill/hwpx-gongmun/examples/good-station.json`.
4. 생성하고 점검한다. Node.js 18 이상, 의존성 없음.
   ```bash
   node skill/hwpx-gongmun/scripts/build.js 내용.json --out-dir 결과폴더
   node skill/hwpx-gongmun/scripts/verify.js 결과폴더/생성된파일.hwpx
   ```
   "주의:" 경고와 verify 문제는 고쳐서 다시 만든다.
5. 사용자에게 파일 위치와, 자료에 없어 비워 둔 수치·이름(○○)을 알린다.

지키지 않으면 파일이 깨지는 것:
- hwpx XML을 직접 짓거나 고치지 않는다. 내용은 JSON으로만 바꾼다.
- 기존 hwpx의 글자를 꼭 직접 고쳐야 하면, 고친 문단의 `hp:linesegarray`를 지우고 zip 순서·압축 방식을 원본대로 유지한다(`mimetype`은 맨 앞 무압축).
- 다른 문서의 문단을 옮겨 붙일 때는 참조하는 서식 정의(charPr·paraPr·borderFill·tabPr)도 함께 옮기고 번호를 새로 매긴다. `tools/add-brief-prototypes.js`가 예시다.

## 코드를 실행할 수 없는 AI (채팅만 되는 경우)

사용자가 `dist/공문생성기.html`을 열어 "요청문 복사"를 누르면 `writing-guide.md` 내용과 문서 유형이 담긴 요청문이 복사된다. AI는 그 요청문대로 JSON 코드 블록 하나만 답한다. 사용자가 답을 페이지에 붙여넣고 hwpx를 내려받는다.
