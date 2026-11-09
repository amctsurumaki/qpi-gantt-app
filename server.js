const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const INITIAL_DATA_FILE = path.join(__dirname, 'initial_tasks.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// データディレクトリの準備と初期データロード
function initData() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    if (fs.existsSync(INITIAL_DATA_FILE)) {
      fs.copyFileSync(INITIAL_DATA_FILE, DATA_FILE);
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }
}

function readTasks() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read tasks:', err);
    return [];
  }
}

function writeTasks(tasks) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

// API: タスク一覧取得
app.get('/api/tasks', (req, res) => {
  res.json({ tasks: readTasks(), lastUpdated: fs.statSync(DATA_FILE).mtime });
});

// API: 全タスク更新（一括同期）
app.put('/api/tasks', (req, res) => {
  const tasks = req.body.tasks;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks must be an array' });
  }
  writeTasks(tasks);
  res.json({ success: true, count: tasks.length });
});

// API: 初期データにリセット
app.post('/api/tasks/reset', (req, res) => {
  if (fs.existsSync(INITIAL_DATA_FILE)) {
    fs.copyFileSync(INITIAL_DATA_FILE, DATA_FILE);
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  res.json({ success: true, tasks: readTasks() });
});

initData();

app.listen(PORT, () => {
  console.log(`QPI Gantt App running on port ${PORT}`);
});
