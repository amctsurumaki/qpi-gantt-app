const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const INITIAL_DATA_FILE = path.join(__dirname, 'initial_tasks.json');

// GitHub Gist 設定 (環境変数で設定)
// GIST_ID: 保存先の Gist ID
// GITHUB_TOKEN: Gist 更新権限を持つ GitHub Personal Access Token (classic: gist スコープ または Fine-grained token)
// GIST_FILENAME: Gist 内のファイル名 (省略時は tasks.json)
const GIST_ID = process.env.GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME = process.env.GIST_FILENAME || 'tasks.json';

const isGistConfigured = Boolean(GIST_ID && GITHUB_TOKEN);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Gist API 通信 (Node.js 標準の https を使用)
const https = require('https');

function githubApiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: endpoint,
        method: method,
        headers: {
          'User-Agent': 'qpi-gantt-app',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              resolve(data);
            }
          } else {
            reject(new Error(`GitHub API Error: ${res.statusCode} ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Gist からタスクを取得
async function fetchTasksFromGist() {
  const gist = await githubApiRequest('GET', `/gists/${GIST_ID}`);
  const file = gist.files && (gist.files[GIST_FILENAME] || Object.values(gist.files)[0]);
  if (!file) throw new Error(`File ${GIST_FILENAME} not found in Gist`);
  
  // Gistファイルが truncated (巨大) な場合は raw_url から取得
  if (file.truncated && file.raw_url) {
    return new Promise((resolve, reject) => {
      https.get(file.raw_url, { headers: { 'User-Agent': 'qpi-gantt-app' } }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }
  return JSON.parse(file.content);
}

// Gist へタスクを保存
async function saveTasksToGist(tasks) {
  const body = {
    description: `QPI Gantt Chart Tasks (Updated: ${new Date().toISOString()})`,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(tasks, null, 2)
      }
    }
  };
  await githubApiRequest('PATCH', `/gists/${GIST_ID}`, body);
}

// ローカルファイル操作 (フォールバック & キャッシュ)
function initLocalData() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    if (fs.existsSync(INITIAL_DATA_FILE)) {
      fs.copyFileSync(INITIAL_DATA_FILE, DATA_FILE);
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }
}

function readLocalTasks() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read local tasks:', err);
    return [];
  }
}

function writeLocalTasks(tasks) {
  initLocalData();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

// API: タスク一覧取得
app.get('/api/tasks', async (req, res) => {
  if (isGistConfigured) {
    try {
      const tasks = await fetchTasksFromGist();
      writeLocalTasks(tasks); // キャッシュ更新
      return res.json({ tasks, storage: 'gist', lastUpdated: new Date() });
    } catch (err) {
      console.error('Failed to fetch from Gist, falling back to local/initial:', err);
      // Gist 取得失敗時はローカルキャッシュを返す
      return res.json({ tasks: readLocalTasks(), storage: 'fallback-local', error: err.message });
    }
  }

  // Gist 未設定時は従来通りローカルファイル
  res.json({ tasks: readLocalTasks(), storage: 'local', lastUpdated: fs.statSync(DATA_FILE).mtime });
});

// API: 全タスク更新（一括同期）
app.put('/api/tasks', async (req, res) => {
  const tasks = req.body.tasks;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks must be an array' });
  }

  writeLocalTasks(tasks);

  if (isGistConfigured) {
    try {
      await saveTasksToGist(tasks);
      return res.json({ success: true, count: tasks.length, storage: 'gist' });
    } catch (err) {
      console.error('Failed to save to Gist:', err);
      return res.status(500).json({ error: 'Failed to save to GitHub Gist: ' + err.message });
    }
  }

  res.json({ success: true, count: tasks.length, storage: 'local' });
});

// API: 初期データにリセット
app.post('/api/tasks/reset', async (req, res) => {
  let initial = [];
  if (fs.existsSync(INITIAL_DATA_FILE)) {
    try {
      initial = JSON.parse(fs.readFileSync(INITIAL_DATA_FILE, 'utf8'));
    } catch (e) {
      initial = [];
    }
  }
  writeLocalTasks(initial);

  if (isGistConfigured) {
    try {
      await saveTasksToGist(initial);
    } catch (err) {
      console.error('Failed to reset Gist:', err);
    }
  }

  res.json({ success: true, tasks: initial });
});

// 起動時のローカルデータ準備
initLocalData();

app.listen(PORT, () => {
  console.log(`QPI Gantt App running on port ${PORT}`);
  console.log(`Storage mode: ${isGistConfigured ? 'GitHub Gist (Persistent)' : 'Local File (Ephemeral on Render)'}`);
});
