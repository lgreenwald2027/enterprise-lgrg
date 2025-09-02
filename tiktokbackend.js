// Minimal TikTok-style backend: feed, likes, comments
// Run: npm i express cors && node server.js

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// --- storage (JSON file) ---
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "feed.json");

function ensureSeed() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      videos: [
        {
          id: 1,
          src: "https://cdn.coverr.co/videos/coverr-man-walking-on-a-suspension-bridge-6468/1080p.mp4",
          username: "@alpine.explorer",
          caption: "Crossing the old suspension bridge. Would you? #hike #adventure",
          music: "Original Sound — alpine",
          likeCount: 0,
          comments: []
        },
        {
          id: 2,
          src: "https://cdn.coverr.co/videos/coverr-city-street-at-night-6923/1080p.mp4",
          username: "@nocturne",
          caption: "Blue hour drives hit different.",
          music: "City Nights — analogtape",
          likeCount: 0,
          comments: []
        },
        {
          id: 3,
          src: "https://cdn.coverr.co/videos/coverr-making-pizza-8157/1080p.mp4",
          username: "@chefmode",
          caption: "POV: best pizza of your life 🍕",
          music: "Neapolitan Vibes — cucina",
          likeCount: 0,
          comments: []
        },
        {
          id: 4,
          src: "https://cdn.coverr.co/videos/coverr-surfing-on-the-ocean-9720/1080p.mp4",
          username: "@surf.check",
          caption: "Morning glass. Lefts were firing.",
          music: "Sea Breeze — modular",
          likeCount: 0,
          comments: []
        },
        {
          id: 5,
          src: "https://cdn.coverr.co/videos/coverr-writing-in-a-notebook-5691/1080p.mp4",
          username: "@studylog",
          caption: "25m deep work, 5m rest. #pomodoro",
          music: "Lo-fi Loop — studycat",
          likeCount: 0,
          comments: []
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

ensureSeed();

// --- middleware ---
app.use(cors());
app.use(express.json());

// serve static frontend (put your index.html in /public)
app.use(express.static(path.join(__dirname, "public")));

// --- API ---
app.get("/api/feed", (req, res) => {
  const db = readDB();
  // Return public fields only
  const list = db.videos.map(({ comments, ...v }) => ({
    ...v,
    commentCount: comments?.length || 0
  }));
  res.json(list);
});

app.post("/api/videos/:id/like", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const vid = db.videos.find(v => v.id === id);
  if (!vid) return res.status(404).json({ error: "not_found" });
  vid.likeCount = (vid.likeCount || 0) + 1;
  writeDB(db);
  res.json({ id, likeCount: vid.likeCount });
});

app.get("/api/videos/:id/comments", (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const vid = db.videos.find(v => v.id === id);
  if (!vid) return res.status(404).json({ error: "not_found" });
  res.json({ id, comments: vid.comments || [] });
});

app.post("/api/videos/:id/comments", (req, res) => {
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
    at: new Date().toISOString()
  };
  vid.comments = vid.comments || [];
  vid.comments.push(comment);
  writeDB(db);
  res.status(201).json({ ok: true, comment });
});

// (Optional) simple health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});