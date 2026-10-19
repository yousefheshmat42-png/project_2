import { createCore, text, id, page, fail } from './core.js';
export function createApp({ databasePath = ':memory:' } = {}) {
  const { app, db, auth, finish } = createCore(databasePath);
  db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ); CREATE INDEX IF NOT EXISTS tasks_owner ON tasks(user_id, status);`);
  const statuses = ['todo', 'in_progress', 'done'];
  function status(value) { if (!statuses.includes(value)) fail(400, 'Status must be todo, in_progress or done'); return value; }
  function description(value) {
    if (typeof value !== 'string' || value.length > 2000) fail(400, 'description must be a string of at most 2000 characters');
    return value.trim();
  }
  function owned(req) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id(req.params.id), req.userId);
    if (!task) fail(404, 'Task not found');
    return task;
  }
  app.use('/tasks', auth);
  app.post('/tasks', (req, res) => {
    const title = text(req.body.title, 'title');
    const detail = description(req.body.description ?? '');
    const result = db.prepare('INSERT INTO tasks(user_id,title,description) VALUES(?,?,?)').run(req.userId, title, detail);
    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
  });
  app.get('/tasks', (req, res) => {
    const { limit, offset } = page(req.query);
    const filter = req.query.status === undefined ? null : status(req.query.status);
    res.json({ items: db.prepare('SELECT * FROM tasks WHERE user_id = ? AND (? IS NULL OR status = ?) ORDER BY id DESC LIMIT ? OFFSET ?').all(req.userId, filter, filter, limit, offset) });
  });
  app.get('/tasks/:id', (req, res) => res.json(owned(req)));
  app.patch('/tasks/:id', (req, res) => {
    const old = owned(req);
    const keys = Object.keys(req.body);
    if (!keys.length || keys.some(k => !['title','description','status'].includes(k))) fail(400, 'Provide title, description or status only');
    const title = req.body.title === undefined ? old.title : text(req.body.title, 'title');
    const detail = req.body.description === undefined ? old.description : description(req.body.description);
    const state = req.body.status === undefined ? old.status : status(req.body.status);
    db.prepare('UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ? AND user_id = ?').run(title, detail, state, old.id, req.userId);
    res.json(owned(req));
  });
  app.delete('/tasks/:id', (req, res) => {
    const task = owned(req);
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(task.id, req.userId);
    res.status(204).end();
  });
  return finish();
}

