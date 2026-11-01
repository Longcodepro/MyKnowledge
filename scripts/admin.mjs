import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const PORT = parseInt(process.env.PORT || '3030', 10);
const ROOT = resolve('.');
const SRC = join(ROOT, 'content');
const TEN_FILE = join(SRC, '_ten.json');
const ADMIN_HTML = join(ROOT, 'demo_admin.html');

// Thư mục thùng rác nội bộ (được ignore bởi Git, không bao giờ push lên GitHub)
const TRASH_DIR = join(ROOT, '.trash');
const TRASH_FILES = join(TRASH_DIR, 'files');
const TRASH_MANIFEST = join(TRASH_DIR, 'manifest.json');
mkdirSync(TRASH_FILES, { recursive: true });

function getTrash() {
  try {
    return JSON.parse(readFileSync(TRASH_MANIFEST, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveTrash(list) {
  writeFileSync(TRASH_MANIFEST, JSON.stringify(list, null, 2) + '\n', 'utf8');
}

// Di chuyển file an toàn hỗ trợ fallback copy
function moveFileSafe(srcPath, dstPath) {
  try {
    renameSync(srcPath, dstPath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      copyFileSync(srcPath, dstPath);
      unlinkSync(srcPath);
    } else {
      throw err;
    }
  }
}

// Đọc danh sách thư mục và file thật trong content/
function readContentData() {
  let titles = {};
  try {
    titles = JSON.parse(readFileSync(TEN_FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Lỗi đọc _ten.json:', e);
  }

  const folders = [];
  const items = [];

  const entries = readdirSync(SRC, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith('.') || (ent.name.startsWith('_') && ent.name !== '_ten.json')) continue;
    if (ent.isDirectory()) {
      folders.push(ent.name);
      const subEntries = readdirSync(join(SRC, ent.name), { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isFile() || !sub.name.endsWith('.html')) continue;
        const isHidden = sub.name.startsWith('_');
        const cleanFile = isHidden ? sub.name.slice(1) : sub.name;
        const relPath = `${ent.name}/${cleanFile}`;
        const name = titles[relPath] ?? cleanFile.replace(/\.html$/i, '');
        items.push({
          folder: ent.name,
          file: cleanFile,
          realFile: sub.name,
          name,
          hidden: isHidden,
          isNew: false,
        });
      }
    }
  }

  // Sắp xếp các mục theo thứ tự khoá trong _ten.json
  const rank = Object.fromEntries(Object.keys(titles).map((k, i) => [k, i]));
  items.sort((a, b) => {
    const pa = `${a.folder}/${a.file}`;
    const pb = `${b.folder}/${b.file}`;
    const ra = rank[pa] ?? 1e9;
    const rb = rank[pb] ?? 1e9;
    if (ra !== rb) return ra - rb;
    return pa.localeCompare(pb, 'vi', { numeric: true });
  });

  return { folders, items, titles };
}

// Lưu dữ liệu vào _ten.json và đổi tên file ẩn nếu cần
function saveContentData(newItems) {
  const current = readContentData();
  const currentMap = new Map(current.items.map((i) => [`${i.folder}/${i.file}`, i]));

  // Đổi tên file vật lý nếu trạng thái ẩn thay đổi
  for (const it of newItems) {
    const key = `${it.folder}/${it.file}`;
    const old = currentMap.get(key);
    if (old && old.hidden !== it.hidden) {
      const oldPath = join(SRC, it.folder, (old.hidden ? '_' : '') + it.file);
      const newPath = join(SRC, it.folder, (it.hidden ? '_' : '') + it.file);
      if (existsSync(oldPath)) {
        renameSync(oldPath, newPath);
      }
    }
  }

  // Xây dựng lại _ten.json: chỉ lưu các bài công khai theo đúng thứ tự
  const newTitles = {};
  for (const it of newItems) {
    if (!it.hidden && it.name && it.name.trim()) {
      newTitles[`${it.folder}/${it.file}`] = it.name.trim();
    }
  }

  const newRaw = JSON.stringify(newTitles, null, 2) + '\n';
  let currentRaw = '';
  try {
    currentRaw = readFileSync(TEN_FILE, 'utf8');
  } catch (e) {}

  if (currentRaw !== newRaw) {
    writeFileSync(TEN_FILE, newRaw, 'utf8');
  }
  return { ok: true, changed: currentRaw !== newRaw };
}

// Xử lý request JSON
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload quá lớn (tối đa 50MB)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

// Khởi tạo HTTP Server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 1. Phục vụ giao diện Admin
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html' || pathname === '/admin')) {
    try {
      const html = readFileSync(ADMIN_HTML, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Lỗi đọc demo_admin.html: ' + e.message);
    }
    return;
  }

  // 2. API lấy dữ liệu thực tế
  if (req.method === 'GET' && pathname === '/api/data') {
    try {
      const data = readContentData();
      sendJson(res, 200, data);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 2b. API kiểm tra trạng thái Git thực tế
  if (req.method === 'GET' && pathname === '/api/git-status') {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: ROOT });
      const isClean = !stdout.trim();
      sendJson(res, 200, { ok: true, isClean, output: stdout.trim() });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 3. API lưu thay đổi (_ten.json và trạng thái ẩn)
  if (req.method === 'POST' && pathname === '/api/save') {
    try {
      const { items } = await parseJsonBody(req);
      if (!Array.isArray(items)) throw new Error('items phải là một mảng');
      const result = saveContentData(items);
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 4. API tạo thư mục mới
  if (req.method === 'POST' && pathname === '/api/create-folder') {
    try {
      const { name } = await parseJsonBody(req);
      const clean = (name || '').trim();
      if (!clean || /^[._]/.test(clean) || /[\\/]/.test(clean)) {
        return sendJson(res, 400, { ok: false, error: 'Tên thư mục không hợp lệ' });
      }
      const dirPath = join(SRC, clean);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
      sendJson(res, 200, { ok: true, name: clean });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 5. API chuyển thư mục
  if (req.method === 'POST' && pathname === '/api/move') {
    try {
      const { fromFolder, toFolder, file, isHidden } = await parseJsonBody(req);
      const fileName = (isHidden ? '_' : '') + file;
      const oldPath = join(SRC, fromFolder, fileName);
      const newPath = join(SRC, toFolder, fileName);

      if (!existsSync(oldPath)) {
        return sendJson(res, 404, { ok: false, error: 'File nguồn không tồn tại' });
      }
      if (existsSync(newPath)) {
        return sendJson(res, 400, { ok: false, error: `Thư mục ${toFolder} đã có file này` });
      }

      mkdirSync(join(SRC, toFolder), { recursive: true });
      renameSync(oldPath, newPath);

      // Cập nhật lại _ten.json nếu có
      try {
        const titles = JSON.parse(readFileSync(TEN_FILE, 'utf8'));
        const oldKey = `${fromFolder}/${file}`;
        const newKey = `${toFolder}/${file}`;
        if (titles[oldKey]) {
          const val = titles[oldKey];
          delete titles[oldKey];
          titles[newKey] = val;
          writeFileSync(TEN_FILE, JSON.stringify(titles, null, 2) + '\n', 'utf8');
        }
      } catch (err) {}

      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 6. API xoá file (chuyển vào thùng rác .trash/)
  if (req.method === 'POST' && pathname === '/api/delete') {
    try {
      const { folder, file, isHidden } = await parseJsonBody(req);
      const fileName = (isHidden ? '_' : '') + file;
      const filePath = join(SRC, folder, fileName);

      let title = file.replace(/\.html$/i, '');
      try {
        const titles = JSON.parse(readFileSync(TEN_FILE, 'utf8'));
        const key = `${folder}/${file}`;
        if (titles[key]) {
          title = titles[key];
          delete titles[key];
          writeFileSync(TEN_FILE, JSON.stringify(titles, null, 2) + '\n', 'utf8');
        }
      } catch (err) {}

      const trashId = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const storedAs = `${trashId}_${fileName}`;

      if (existsSync(filePath)) {
        moveFileSafe(filePath, join(TRASH_FILES, storedAs));
      }

      const trashItem = {
        id: trashId,
        type: 'file',
        folder,
        file,
        realFile: fileName,
        name: title,
        hidden: !!isHidden,
        storedAs,
        deletedAt: new Date().toISOString(),
      };

      const trashList = getTrash();
      trashList.unshift(trashItem);
      saveTrash(trashList);

      sendJson(res, 200, { ok: true, id: trashId, item: trashItem });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 6b. API xoá folder (chuyển toàn bộ file vào thùng rác và xoá thư mục)
  if (req.method === 'POST' && pathname === '/api/delete-folder') {
    try {
      const { folder } = await parseJsonBody(req);
      const dirPath = join(SRC, folder);

      if (!existsSync(dirPath)) {
        return sendJson(res, 404, { ok: false, error: 'Thư mục không tồn tại' });
      }

      let titles = {};
      try {
        titles = JSON.parse(readFileSync(TEN_FILE, 'utf8'));
      } catch (err) {}

      const trashId = 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const subEntries = readdirSync(dirPath, { withFileTypes: true });
      const deletedFiles = [];

      for (const sub of subEntries) {
        if (!sub.isFile()) continue;
        const isHidden = sub.name.startsWith('_');
        const cleanFile = isHidden ? sub.name.slice(1) : sub.name;
        const key = `${folder}/${cleanFile}`;
        const title = titles[key] || cleanFile.replace(/\.html$/i, '');
        delete titles[key];

        const storedAs = `${trashId}_${sub.name}`;
        moveFileSafe(join(dirPath, sub.name), join(TRASH_FILES, storedAs));

        deletedFiles.push({
          file: cleanFile,
          realFile: sub.name,
          name: title,
          hidden: isHidden,
          storedAs,
        });
      }

      // Xoá thư mục trống
      rmSync(dirPath, { recursive: true, force: true });
      // Cập nhật lại _ten.json
      writeFileSync(TEN_FILE, JSON.stringify(titles, null, 2) + '\n', 'utf8');

      const trashItem = {
        id: trashId,
        type: 'folder',
        folder,
        files: deletedFiles,
        deletedAt: new Date().toISOString(),
      };

      const trashList = getTrash();
      trashList.unshift(trashItem);
      saveTrash(trashList);

      sendJson(res, 200, { ok: true, id: trashId, item: trashItem });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 6c. API xem danh sách thùng rác
  if (req.method === 'GET' && pathname === '/api/trash') {
    try {
      const list = getTrash();
      sendJson(res, 200, { ok: true, items: list });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 6d. API khôi phục mục từ thùng rác
  if (req.method === 'POST' && pathname === '/api/restore-trash') {
    try {
      const { id } = await parseJsonBody(req);
      const trashList = getTrash();
      const index = trashList.findIndex((it) => it.id === id);
      if (index === -1) {
        return sendJson(res, 404, { ok: false, error: 'Không tìm thấy mục trong thùng rác' });
      }

      const item = trashList[index];
      let titles = {};
      try {
        titles = JSON.parse(readFileSync(TEN_FILE, 'utf8'));
      } catch (err) {}

      if (item.type === 'file') {
        const targetDir = join(SRC, item.folder);
        mkdirSync(targetDir, { recursive: true });
        const sourcePath = join(TRASH_FILES, item.storedAs);
        const targetPath = join(targetDir, item.realFile);

        if (existsSync(sourcePath)) {
          moveFileSafe(sourcePath, targetPath);
        }

        if (!item.hidden && item.name) {
          titles[`${item.folder}/${item.file}`] = item.name;
          writeFileSync(TEN_FILE, JSON.stringify(titles, null, 2) + '\n', 'utf8');
        }
      } else if (item.type === 'folder') {
        const targetDir = join(SRC, item.folder);
        mkdirSync(targetDir, { recursive: true });

        for (const f of item.files || []) {
          const sourcePath = join(TRASH_FILES, f.storedAs);
          const targetPath = join(targetDir, f.realFile);
          if (existsSync(sourcePath)) {
            moveFileSafe(sourcePath, targetPath);
          }
          if (!f.hidden && f.name) {
            titles[`${item.folder}/${f.file}`] = f.name;
          }
        }
        writeFileSync(TEN_FILE, JSON.stringify(titles, null, 2) + '\n', 'utf8');
      }

      trashList.splice(index, 1);
      saveTrash(trashList);

      sendJson(res, 200, { ok: true, restored: item });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 6e. API dọn sạch thùng rác (xóa vĩnh viễn tất cả)
  if (req.method === 'POST' && pathname === '/api/empty-trash') {
    try {
      rmSync(TRASH_FILES, { recursive: true, force: true });
      mkdirSync(TRASH_FILES, { recursive: true });
      saveTrash([]);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 6f. API xoá vĩnh viễn 1 mục khỏi thùng rác
  if (req.method === 'POST' && pathname === '/api/delete-trash-item') {
    try {
      const { id } = await parseJsonBody(req);
      const trashList = getTrash();
      const index = trashList.findIndex((it) => it.id === id);
      if (index === -1) {
        return sendJson(res, 404, { ok: false, error: 'Không tìm thấy mục trong thùng rác' });
      }
      const item = trashList[index];
      if (item.type === 'file') {
        const filePath = join(TRASH_FILES, item.storedAs);
        if (existsSync(filePath)) unlinkSync(filePath);
      } else if (item.type === 'folder') {
        for (const f of item.files || []) {
          const filePath = join(TRASH_FILES, f.storedAs);
          if (existsSync(filePath)) unlinkSync(filePath);
        }
      }
      trashList.splice(index, 1);
      saveTrash(trashList);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 7. API tải file lên
  if (req.method === 'POST' && pathname === '/api/upload') {
    try {
      const { folder, fileName, contentBase64, isHidden } = await parseJsonBody(req);
      if (!folder || !fileName || !contentBase64) {
        return sendJson(res, 400, { ok: false, error: 'Thiếu thông tin upload' });
      }

      const realFileName = (isHidden ? '_' : '') + fileName;
      const dirPath = join(SRC, folder);
      mkdirSync(dirPath, { recursive: true });

      const targetPath = join(dirPath, realFileName);
      const buffer = Buffer.from(contentBase64, 'base64');
      writeFileSync(targetPath, buffer);

      // Thêm vào _ten.json nếu chưa có và không ẩn
      if (!isHidden) {
        try {
          const titles = JSON.parse(readFileSync(TEN_FILE, 'utf8'));
          const key = `${folder}/${fileName}`;
          if (!titles[key]) {
            titles[key] = fileName.replace(/\.html$/i, '');
            writeFileSync(TEN_FILE, JSON.stringify(titles, null, 2) + '\n', 'utf8');
          }
        } catch (err) {}
      }

      sendJson(res, 200, { ok: true, fileName: realFileName });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // 8. API chạy build thật
  if (req.method === 'POST' && pathname === '/api/build') {
    const logs = [];
    logs.push(['p', '$ npm run build']);
    logs.push(['mu', '> node scripts/build.mjs']);
    try {
      const { stdout, stderr } = await execAsync('node scripts/build.mjs', { cwd: ROOT });
      if (stdout) {
        for (const line of stdout.trim().split('\n')) {
          if (line) logs.push(['ok', line]);
        }
      }
      if (stderr) {
        for (const line of stderr.trim().split('\n')) {
          if (line) logs.push(['mu', line]);
        }
      }
      sendJson(res, 200, { ok: true, logs });
    } catch (e) {
      logs.push(['danger', 'Lỗi: ' + (e.stderr || e.message)]);
      sendJson(res, 500, { ok: false, logs, error: e.message });
    }
    return;
  }

  // 9. API chạy Git commit & push thật
  if (req.method === 'POST' && pathname === '/api/push') {
    const logs = [];
    try {
      const { msg } = await parseJsonBody(req);
      const commitMsg = (msg || 'Cập nhật kho tri thức').trim();

      logs.push(['p', '$ git add .']);
      await execAsync('git add .', { cwd: ROOT });

      logs.push(['p', `$ git commit -m "${commitMsg.replace(/"/g, '\\"')}"`]);
      try {
        const { stdout: cOut } = await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: ROOT });
        if (cOut) logs.push(['mu', cOut.trim().split('\n')[0]]);
      } catch (commitErr) {
        if (commitErr.stdout && commitErr.stdout.includes('nothing to commit')) {
          logs.push(['mu', 'Không có thay đổi nào mới cần commit.']);
        } else {
          throw commitErr;
        }
      }

      logs.push(['p', '$ git push']);
      const { stdout: pOut, stderr: pErr } = await execAsync('git push', { cwd: ROOT });
      if (pOut) logs.push(['mu', pOut.trim()]);
      if (pErr) logs.push(['mu', pErr.trim()]);

      logs.push(['ok', '✓ Đã đẩy lên GitHub. Vercel đang tự động triển khai production!']);
      sendJson(res, 200, { ok: true, logs });
    } catch (e) {
      logs.push(['danger', 'Lỗi Git: ' + (e.stderr || e.message)]);
      sendJson(res, 500, { ok: false, logs, error: e.message });
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

// Tìm port trống
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 MyKnowledge Studio Admin đang chạy tại: http://localhost:${PORT}`);
  console.log(`Bấm Ctrl + C để dừng server.\n`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Cổng ${PORT} đang bận, thử cổng ${PORT + 1}...`);
    server.listen(PORT + 1, '127.0.0.1');
  } else {
    console.error('Lỗi server:', e);
  }
});
