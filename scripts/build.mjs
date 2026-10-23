import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'content';
const OUT = 'dist';
const hidden = (name) => name.startsWith('.') || name.startsWith('_');

// Đệ quy lấy đường dẫn (mảng segment) của mọi .html, bỏ qua mục bắt đầu bằng . hoặc _
function scan(rel = []) {
  const files = [];
  for (const e of readdirSync(join(SRC, ...rel), { withFileTypes: true })) {
    if (hidden(e.name)) continue;
    if (e.isDirectory()) files.push(...scan([...rel, e.name]));
    else if (e.isFile() && e.name.endsWith('.html')) files.push([...rel, e.name]);
  }
  return files;
}

mkdirSync(SRC, { recursive: true });
const files = scan();

rmSync(OUT, { recursive: true, force: true }); // chỉ xoá dist/
// Không chép mục ẩn/_ để file nháp (vd _mau/) không bị công khai
cpSync(SRC, OUT, {
  recursive: true,
  filter: (src) => src === SRC || !hidden(src.split('/').pop()),
});

// content/_ten.json: { "Thư mục/File.html": "Tên hiển thị" } (tuỳ chọn, không đổi tên file thật)
let titles = {};
try { titles = JSON.parse(readFileSync(join(SRC, '_ten.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const paths = new Set(files.map((s) => s.join('/')));
for (const k of Object.keys(titles)) if (!paths.has(k)) console.warn(`Cảnh báo: _ten.json có "${k}" nhưng không có file này`);

// Thứ tự hiển thị = thứ tự khoá trong _ten.json; mục không có trong đó xếp sau, theo A→Z
const rank = Object.fromEntries(Object.keys(titles).map((k, i) => [k, i]));
const items = files.map((segs) => ({
  name: titles[segs.join('/')] ?? segs[segs.length - 1].replace(/\.html$/, ''),
  group: segs.length > 1 ? segs.slice(0, -1).join(' / ') : 'Chung',
  href: segs.map(encodeURIComponent).join('/'),
  o: rank[segs.join('/')] ?? 1e9,
}));
// Thứ tự nhóm = thứ hạng nhỏ nhất trong nhóm
const groupRank = {};
for (const it of items) groupRank[it.group] = Math.min(groupRank[it.group] ?? 1e9, it.o);
for (const it of items) it.go = groupRank[it.group];
// "<" thoát thành < để dữ liệu không đóng nhầm thẻ <script>
const data = JSON.stringify(items).replace(/</g, '\\u003c');

writeFileSync(join(OUT, 'index.html'), `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kho tri thức</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#ddd;--acc:#0b5fd6;--card:#f6f7f9}
:root[data-theme=dark]{--bg:#15171a;--fg:#e8e8e8;--mut:#9a9a9a;--line:#33373d;--acc:#7ab2ff;--card:#1e2126}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
header{display:flex;gap:8px;align-items:center;margin-bottom:16px}
h1{font-size:1.4rem;margin:0;flex:1}
input,button{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px}
input{width:100%;margin-bottom:16px}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
details{border:1px solid var(--line);border-radius:8px;margin-bottom:12px;background:var(--card)}
summary{cursor:pointer;padding:10px 12px;font-weight:600;overflow-wrap:anywhere}
summary span{color:var(--mut);font-weight:400}
ul{list-style:none;margin:0;padding:0 12px 8px}
li a{display:block;padding:8px 0;color:var(--acc);text-decoration:none;overflow-wrap:anywhere;border-top:1px solid var(--line)}
li a:hover{text-decoration:underline}
#empty{color:var(--mut)}
</style>
</head>
<body>
<main>
<header><h1>Kho tri thức</h1><button id="theme" type="button"></button></header>
<input id="q" type="search" placeholder="Tìm theo tên…" aria-label="Tìm theo tên" autocomplete="off">
<div id="list"></div>
</main>
<script>
const ITEMS = ${data};
const $ = (id) => document.getElementById(id);
const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').trim();
const cmp = (a, b) => a.localeCompare(b, 'vi', { numeric: true });
const closed = new Set();

function render() {
  const q = norm($('q').value.trim());
  const groups = new Map();
  for (const it of ITEMS) {
    if (q && !norm(it.name).includes(q)) continue;
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group).push(it);
  }
  const box = $('list');
  box.textContent = '';
  if (!groups.size) {
    const p = document.createElement('p');
    p.id = 'empty';
    p.textContent = ITEMS.length ? 'Không có kết quả' : 'Chưa có file nào';
    box.append(p);
    return;
  }
  const names = [...groups.keys()].sort((a, b) => a === 'Chung' ? -1 : b === 'Chung' ? 1 : groups.get(a)[0].go - groups.get(b)[0].go || cmp(a, b));
  for (const g of names) {
    const d = document.createElement('details');
    d.open = q ? true : !closed.has(g);
    d.addEventListener('toggle', () => { if (!q) d.open ? closed.delete(g) : closed.add(g); });
    const s = document.createElement('summary');
    s.append(g + ' ');
    const n = document.createElement('span');
    n.textContent = '(' + groups.get(g).length + ')';
    s.append(n);
    const ul = document.createElement('ul');
    for (const it of groups.get(g).sort((a, b) => a.o - b.o || cmp(a.name, b.name))) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = it.href;
      a.textContent = it.name;
      li.append(a);
      ul.append(li);
    }
    d.append(s, ul);
    box.append(d);
  }
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('theme').textContent = t === 'dark' ? 'Sáng' : 'Tối';
}
let saved = null;
try { saved = localStorage.getItem('theme'); } catch (e) {}
setTheme(saved === 'dark' ? 'dark' : 'light');
$('theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(t);
  try { localStorage.setItem('theme', t); } catch (e) {}
};
$('q').addEventListener('input', render);
render();
</script>
</body>
</html>
`);

console.log(`Tìm thấy ${files.length} file .html`);
