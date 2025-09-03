// server.js
// Express + Cookie Sessions + (DynamoDB preferred) storage
// --------------------------------------------------------
// Install: npm i express cors bcrypt cookie-session @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
// Run:     node server.js
// EB:      eb setenv NODE_ENV=production SESSION_SECRET=... AWS_REGION=us-east-1 USERS_TABLE=tiktok_users VIDEOS_TABLE=tiktok_videos

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const cookieSession = require("cookie-session");

// ---------- App setup ----------
const app = express();
app.set("trust proxy", 1); // needed behind AWS ELB/ALB

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  cookieSession({
    name: "sess",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // secure cookies on HTTPS (EB)
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  })
);

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// ---------- Storage layer (DynamoDB preferred, JSON fallback) ----------
const USE_DDB =
  !!process.env.USERS_TABLE && !!process.env.VIDEOS_TABLE && !!process.env.AWS_REGION;

let store = null;

if (USE_DDB) {
  // ---- DynamoDB implementation ----
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    ScanCommand,
  } = require("@aws-sdk/lib-dynamodb");

  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
  );
  const USERS_TABLE = process.env.USERS_TABLE;
  const VIDEOS_TABLE = process.env.VIDEOS_TABLE;

  store = {
    // USERS
    async getUser(username) {
      const out = await ddb.send(
        new GetCommand({ TableName: USERS_TABLE, Key: { username } })
      );
      return out.Item || null;
    },
    async createUser({ username, passwordHash }) {
      const user = { username, passwordHash, id: Date.now() };
      await ddb.send(
        new PutCommand({ TableName: USERS_TABLE, Item: user, ConditionExpression: "attribute_not_exists(username)" })
      );
      return user;
    },

    // VIDEOS
    async listVideos() {
      const out = await ddb.send(new ScanCommand({ TableName: VIDEOS_TABLE }));
      const items = out.Items || [];
      // Only expose public fields + computed commentCount
      return items.map((v) => ({
        id: v.id,
        src: v.src,
        username: v.username,
        caption: v.caption,
        music: v.music,
        likeCount: v.likeCount || 0,
        commentCount: (v.comments || []).length,
      }));
    },

    async likeVideo(id, userId) {
      // Prevent double-like per user via a likes list
      const result = await ddb.send(
        new UpdateCommand({
          TableName: VIDEOS_TABLE,
          Key: { id: Number(id) },
          UpdateExpression:
            "ADD likeCount :one SET likes = list_append(if_not_exists(likes, :empty), :uid)",
          ConditionExpression: "attribute_not_exists(likes) OR NOT contains(likes, :u)",
          ExpressionAttributeValues: {
            ":one": 1,
            ":uid": [String(userId)],
            ":u": String(userId),
            ":empty": [],
          },
          ReturnValues: "ALL_NEW",
        })
      );
      return result.Attributes.likeCount || 0;
    },

    async addComment(id, username, text) {
      const comment = { id: Date.now(), user: username, text, at: new Date().toISOString() };
      await ddb.send(
        new UpdateCommand({
          TableName: VIDEOS_TABLE,
          Key: { id: Number(id) },
          UpdateExpression:
            "SET comments = list_append(if_not_exists(comments, :empty), :c), commentCount = if_not_exists(commentCount, :zero) + :one",
          ExpressionAttributeValues: {
            ":c": [comment],
            ":empty": [],
            ":zero": 0,
            ":one": 1,
          },
        })
      );
      return comment;
    },

    async getComments(id) {
      const out = await ddb.send(
        new GetCommand({ TableName: VIDEOS_TABLE, Key: { id: Number(id) } })
      );
      const vid = out.Item;
      if (!vid) return null;
      return vid.comments || [];
    },

    // Auto-seed videos if table empty
    async ensureSeedVideos() {
      const out = await ddb.send(new ScanCommand({ TableName: VIDEOS_TABLE, Limit: 1 }));
      if (out.Items && out.Items.length) return;
      const seed = [
        {
          id: 1,
          src: "https://cdn.coverr.co/videos/coverr-man-walking-on-a-suspension-bridge-6468/1080p.mp4",
          username: "@alpine.explorer",
          caption: "Crossing the old suspension bridge. Would you? #hike #adventure",
          music: "Original Sound — alpine",
          likeCount: 0,
          comments: [],
          likes: [],
        },
        {
          id: 2,
          src: "https://cdn.coverr.co/videos/coverr-city-street-at-night-6923/1080p.mp4",
          username: "@nocturne",
          caption: "Blue hour drives hit different.",
          music: "City Nights — analogtape",
          likeCount: 0,
          comments: [],
          likes: [],
        },
        {
          id: 3,
          src: "https://cdn.coverr.co/videos/coverr-making-pizza-8157/1080p.mp4",
          username: "@chefmode",
          caption: "POV: best pizza of your life 🍕",
          music: "Neapolitan Vibes — cucina",
          likeCount: 0,
          comments: [],
          likes: [],
        },
      ];
      // Batch put (simple loop)
      for (const v of seed) {
        await ddb.send(new PutCommand({ TableName: VIDEOS_TABLE, Item: v }));
      }
      console.log("Seeded videos into DynamoDB.");
    },
  };
} else {
  // ---- JSON file fallback (local dev) ----
  const DATA_DIR = path.join(__dirname, "data");
  const USERS_FILE = path.join(DATA_DIR, "users.json");
  const DB_FILE = path.join(DATA_DIR, "feed.json");

  function ensureLocalSeed() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
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
            comments: [],
            likesByUser: {},
          },
          {
            id: 2,
            src: "https://cdn.coverr.co/videos/coverr-city-street-at-night-6923/1080p.mp4",
            username: "@nocturne",
            caption: "Blue hour drives hit different.",
            music: "City Nights — analogtape",
            likeCount: 0,
            comments: [],
            likesByUser: {},
          },
          {
            id: 3,
            src: "https://cdn.coverr.co/videos/coverr-making-pizza-8157/1080p.mp4",
            username: "@chefmode",
            caption: "POV: best pizza of your life 🍕",
            music: "Neapolitan Vibes — cucina",
            likeCount: 0,
            comments: [],
            likesByUser: {},
          },
        ],
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    }
  }

  ensureLocalSeed();

  const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  const writeUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));
  const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  const writeDB = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

  store = {
    async getUser(username) {
      const u = readUsers();
      return u.users.find((x) => x.username.toLowerCase() === String(username).toLowerCase()) || null;
    },
    async createUser({ username, passwordHash }) {
      const u = readUsers();
      if (u.users.some((x) => x.username.toLowerCase() === String(username).toLowerCase()))
        throw new Error("username_taken");
      const user = { id: Date.now(), username, passwordHash };
      u.users.push(user);
      writeUsers(u);
      return user;
    },
    async listVideos() {
      const db = readDB();
      return db.videos.map((v) => ({
        id: v.id,
        src: v.src,
        username: v.username,
        caption: v.caption,
        music: v.music,
        likeCount: v.likeCount || 0,
        commentCount: (v.comments || []).length,
      }));
    },
    async likeVideo(id, userId) {
      const db = readDB();
      const vid = db.videos.find((v) => v.id === Number(id));
      if (!vid) throw new Error("not_found");
      vid.likesByUser = vid.likesByUser || {};
      const key = String(userId);
      if (!vid.likesByUser[key]) {
        vid.likesByUser[key] = true;
        vid.likeCount = (vid.likeCount || 0) + 1;
      }
      writeDB(db);
      return vid.likeCount;
    },
    async addComment(id, username, text) {
      const db = readDB();
      const vid = db.videos.find((v) => v.id === Number(id));
      if (!vid) throw new Error("not_found");
      vid.comments = vid.comments || [];
      const comment = { id: Date.now(), user: username, text, at: new Date().toISOString() };
      vid.comments.push(comment);
      writeDB(db);
      return comment;
    },
    async getComments(id) {
      const db = readDB();
      const vid = db.videos.find((v) => v.id === Number(id));
      if (!vid) return null;
      return vid.comments || [];
    },
    async ensureSeedVideos() {
      /* already seeded */
    },
  };
}

// ---------- Auth helpers ----------
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: "unauthorized" });
  next();
}

// ---------- Routes ----------

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true, ddb: USE_DDB }));

// Current session
app.get("/api/me", (req, res) => {
  res.json(req.session?.user || {});
});

// Signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "missing_credentials" });
    if (String(username).length < 3) return res.status(400).json({ error: "username_too_short" });
    if (String(password).length < 6) return res.status(400).json({ error: "password_too_short" });

    const existing = await store.getUser(String(username));
    if (existing) return res.status(409).json({ error: "username_taken" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await store.createUser({ username: String(username), passwordHash });
    req.session.user = { id: user.id, username: user.username };
    res.status(201).json({ ok: true, username: user.username });
  } catch (err) {
    const msg = err && err.message === "username_taken" ? "username_taken" : "signup_failed";
    res.status(500).json({ error: msg });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const user = await store.getUser(String(username || ""));
    if (!user) return res.status(401).json({ error: "invalid_login" });
    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_login" });
    req.session.user = { id: user.id, username: user.username };
    res.json({ ok: true, username: user.username });
  } catch {
    res.status(500).json({ error: "login_failed" });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// Feed
app.get("/api/feed", async (_req, res) => {
  try {
    await store.ensureSeedVideos();
    const list = await store.listVideos();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "feed_failed" });
  }
});

// Like (auth)
app.post("/api/videos/:id/like", requireAuth, async (req, res) => {
  try {
    const likeCount = await store.likeVideo(req.params.id, req.session.user.id);
    res.json({ id: Number(req.params.id), likeCount });
  } catch (err) {
    if (String(err).includes("ConditionalCheckFailed")) {
      // already liked
      const list = await store.listVideos();
      const item = list.find((v) => v.id === Number(req.params.id));
      return res.json({ id: Number(req.params.id), likeCount: item ? item.likeCount : 0 });
    }
    res.status(404).json({ error: "not_found" });
  }
});

// Comments
app.get("/api/videos/:id/comments", async (req, res) => {
  const items = await store.getComments(req.params.id);
  if (!items) return res.status(404).json({ error: "not_found" });
  res.json({ id: Number(req.params.id), comments: items });
});

app.post("/api/videos/:id/comments", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").toString().trim();
  if (!text) return res.status(400).json({ error: "empty_comment" });
  if (text.length > 300) return res.status(400).json({ error: "too_long" });
  try {
    const comment = await store.addComment(req.params.id, req.session.user.username, text);
    res.status(201).json({ ok: true, comment });
  } catch {
    res.status(404).json({ error: "not_found" });
  }
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));