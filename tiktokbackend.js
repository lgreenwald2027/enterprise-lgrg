// Run: npm i express cors bcrypt cookie-session
//      node server.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const cookieSession = require("cookie-session");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "feed.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureSeed() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      videos: [
        { id: 1, src: "https://cdn.coverr.co/videos/coverr-man-walking-on-a-suspension-bridge-6468/1080p.mp4",
          username: "@alpine.explorer", caption: "Crossing the old suspension bridge. Would you? #hike #adventure",
          music: "Original Sound — alpine", likeCount: 0, comments: [], likesByUser: {} },
        { id: 2, src: "https://cdn.coverr.co/videos/coverr-city-street-at-night-6923/1080p.mp4",
          username: "@nocturne", caption: "Blue hour drives hit different.",
          music: "City Nights — analogtape", likeCount: 0, comments: [], likesByUser: {} },
        { id: 3, src: "https://cdn.coverr.co/videos/coverr-making-pizza-8157/1080p.mp4",
          username: "@chefmode", caption: "POV: best pizza of your life 🍕",
          music: "Neapolitan Vibes — cucina", likeCount: 0, comments: [], likesByUser: {} }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}
function readDB() { return JSON.parse(fs.readFileSync(DB_FILE, "utf-8")); }
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")); }
function writeUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
ensureSeed();

// middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieSession({
  name: "sess",
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
}));

// static frontend
app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: "unauthorized" });
  next();
}

// --- Auth ---
app.post("/api/auth/signup", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "missing_credentials" });
  if (String(username).length < 3) return res.status(400).json({ error: "username_too_short" });
  if (String(password).length < 6) return res.status(400).json({ error: "password_too_short" });

  const users = readUsers();
  if (users.users.some(u => u.username.toLowerCase() === String(username).toLowerCase())) {
    return res.status(409).json({ error: "username_taken" });
  }
  const hash = await bcrypt.hash(String(password), 10);
  const user = { id: Date.now(), username: String(username), passwordHash: hash };
  users.users.push(user);
  writeUsers(users);

  req.session.user = { id: user.id, username: user.username };
  res.status(201).json({ ok: true, username: user.username });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const users = readUsers();
  const user = users.users.find(u => u.username.toLowerCase() === String(username || "").toLowerCase());
  if (!user) return res.status(401).json({ error: "invalid_login" });
  const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_login" });
  req.session.user = { id: user.id, username: user.username };
  res.json({ ok: true, username: user.username });
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  res.json(req.session?.user || {});
});

// --- Feed ---
app.get("/api/feed", (_req, res) => {
  const db = readDB();
  const list = db.videos.map(({ comments, likesByUser, ...v }) => ({
    ...v,
    commentCount: (comments || []).length
  }));
  res.json(list);
});

// --- Like / Comment (require auth) ---
app.post("/api/videos/:id/like", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const vid = db.videos.find(v => v.id === id);
  if (!vid) return res.status(404).json({ error: "not_found" });

  vid.likesByUser = vid.likesByUser || {};
  const uid = String(req.session.user.id);
  if (!vid.likesByUser[uid]) { // prevent double-like
    vid.likesByUser[uid] = true;
    vid.likeCount = (vid.likeCount || 0) + 1;
  }
  writeDB(db);
  res.json({ id, likeCount: vid.likeCount });
});

app.get("/api/videos/:id/comments", (_req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const vid = db.videos.find(v => v.id === id);
  if (!vid) return res.status(404).json({ error: "not_found" });
  res.json({ id, comments: vid.comments || [] });
});

app.post("/api/videos/:id/comments", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const text = (req.body?.text || "").toString().trim();
  if (!text) return res.status(400).json({ error: "empty_comment" });
  if (text.length > 300) return res.status(400).json({ error: "too_long" });

  const db = readDB();
  const vid = db.videos.find(v => v.id === id);
  if (!vid) return res.status(404).json({ error: "not_found" });

  const comment = {
    id: Date.now(),
    text,
    user: req.session.user.username,
    at: new Date().toISOString()
  };
  vid.comments = vid.comments || [];
  vid.comments.push(comment);
  writeDB(db);
  res.status(201).json({ ok: true, comment });
});

// Optional: health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});