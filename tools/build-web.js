// web-src/page.html 에 생성기 코드·기본 서식·예시·요청문을 끼워 넣어 파일 하나짜리 web/index.html 을 만든다.
// 인터넷이 막힌 사내망에서도 파일을 더블클릭해 쓸 수 있도록 외부 자원을 쓰지 않는다.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skill = path.join(root, 'skill', 'hwpx-gongmun');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const core = fs.readFileSync(path.join(skill, 'scripts', 'core.js'), 'utf8');
const template = fs.readFileSync(path.join(skill, 'templates', 'default.hwpx')).toString('base64');
const example = JSON.parse(fs.readFileSync(path.join(skill, 'examples', 'good-station.json'), 'utf8'));
const prompt = read('web-src/prompt.md');

const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');
let html = read('web-src/page.html');
const put = (marker, value) => {
  if (!html.includes(marker)) throw new Error('자리 없음: ' + marker);
  html = html.split(marker).join(value);
};
put('/*__CORE__*/', safeJs(core));
put('/*__TEMPLATE_B64__*/', template);
put('/*__EXAMPLE__*/null', safeJs(JSON.stringify(example)));
put('/*__PROMPT__*/""', safeJs(JSON.stringify(prompt)));

fs.mkdirSync(path.join(root, 'web'), { recursive: true });
fs.writeFileSync(path.join(root, 'web', 'index.html'), html);
console.log('web/index.html', Math.round(html.length / 1024) + 'KB');
