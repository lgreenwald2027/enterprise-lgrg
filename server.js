// server.js — Express + Sessions + DynamoDB (no JSON fallback)
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const cookieSession = require("cookie-session");

// --- AWS SDK (v3) DynamoDB
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");



// ===== App setup =====
const app = express();
app.set("trust proxy", 1); // behind ELB/ALB

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieSession({
  name: "sess",
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  httpOnly: true,
  sameSite: "lax",
  secure: String(process.env.SESSION_SECURE || "").toLowerCase() === "true", // set true after HTTPS
  maxAge: 1000 * 60 * 60 * 24 * 7,
}));

// serve frontend
app.use(express.static(path.join(__dirname, "public")));

// ===== DynamoDB config (REQUIRED) =====
const REGION = process.env.AWS_REGION;           // e.g. us-east-2
const USERS_TABLE = process.env.USERS_TABLE;     // e.g. tiktok_users
const VIDEOS_TABLE = process.env.VIDEOS_TABLE;   // e.g. tiktok_videos
if (!REGION || !USERS_TABLE || !VIDEOS_TABLE) {
  throw new Error("Missing AWS_REGION / USERS_TABLE / VIDEOS_TABLE env vars.");
}
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// ===== Store helpers (DDB) =====
async function getUserItem(username) {
  const out = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { username } }));
  return out.Item || null;
}

const store = {
  // users
  async getUser(username) { return getUserItem(String(username)); },
  async createUser({ username, passwordHash }) {
    const user = { username: String(username), passwordHash, id: Date.now() };
    await ddb.send(new PutCommand({
      TableName: USERS_TABLE, Item: user, ConditionExpression: "attribute_not_exists(username)"
    }));
    return user;
  },

  // account center: courses
  async listCourses(username) {
    const u = await getUserItem(username);
    return u?.courses || [];
  },
  async addCourse(username, name) {
    const out = await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { username },
      UpdateExpression: "SET courses = list_append(if_not_exists(courses, :empty), :c)",
      ExpressionAttributeValues: { ":empty": [], ":c": [name] },
      ReturnValues: "ALL_NEW"
    }));
    return out.Attributes.courses || [];
  },
  async removeCourse(username, name) {
    const u = await getUserItem(username);
    if (!u) throw new Error("not_found");
    const next = (u.courses || []).filter(c => c !== name);
    await ddb.send(new PutCommand({
      TableName: USERS_TABLE, Item: { ...u, username, courses: next }
    }));
    return next;
  },
  async changePassword(username, oldPassword, newPassword) {
    const u = await getUserItem(username);
    if (!u) return false;
    const ok = await bcrypt.compare(oldPassword, u.passwordHash);
    if (!ok) return false;
    const hash = await bcrypt.hash(newPassword, 10);
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { username },
      UpdateExpression: "SET passwordHash = :h",
      ExpressionAttributeValues: { ":h": hash }
    }));
    return true;
  },

  // videos
  async listVideos() {
    const out = await ddb.send(new ScanCommand({ TableName: VIDEOS_TABLE }));
    const items = out.Items || [];
    return items.map(v => ({
      id: v.id, src: v.src, username: v.username, caption: v.caption,
      music: v.music, likeCount: v.likeCount || 0, commentCount: (v.comments || []).length
    }));
  },
  async likeVideo(id, userId) {
    const out = await ddb.send(new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { id: Number(id) },
      UpdateExpression: "ADD likeCount :one SET likes = list_append(if_not_exists(likes, :empty), :uid)",
      ConditionExpression: "attribute_not_exists(likes) OR NOT contains(likes, :u)",
      ExpressionAttributeValues: { ":one": 1, ":uid": [String(userId)], ":u": String(userId), ":empty": [] },
      ReturnValues: "ALL_NEW"
    }));
    return out.Attributes.likeCount || 0;
  },
  async addComment(id, username, text) {
    const comment = { id: Date.now(), user: username, text, at: new Date().toISOString() };
    await ddb.send(new UpdateCommand({
      TableName: VIDEOS_TABLE,
      Key: { id: Number(id) },
      UpdateExpression: "SET comments = list_append(if_not_exists(comments, :empty), :c), commentCount = if_not_exists(commentCount, :zero) + :one",
      ExpressionAttributeValues: { ":c": [comment], ":empty": [], ":zero": 0, ":one": 1 }
    }));
    return comment;
  },
  async getComments(id) {
    const out = await ddb.send(new GetCommand({ TableName: VIDEOS_TABLE, Key: { id: Number(id) } }));
    return out.Item?.comments || [];
  },

  // seed sample videos if empty
  async ensureSeedVideos() {
    const out = await ddb.send(new ScanCommand({ TableName: VIDEOS_TABLE, Limit: 1 }));
    if (out.Items && out.Items.length) return;
    const seed = [
      { id: 1, src: "https://cdn.coverr.co/videos/coverr-man-walking-on-a-suspension-bridge-6468/1080p.mp4", username: "@alpine.explorer", caption: "Crossing the old suspension bridge. Would you? #hike #adventure", music: "Original Sound — alpine", likeCount: 0, comments: [], likes: [] },
      { id: 2, src: "https://cdn.coverr.co/videos/coverr-city-street-at-night-6923/1080p.mp4", username: "@nocturne", caption: "Blue hour drives hit different.", music: "City Nights — analogtape", likeCount: 0, comments: [], likes: [] },
      { id: 3, src: "https://cdn.coverr.co/videos/coverr-making-pizza-8157/1080p.mp4", username: "@chefmode", caption: "POV: best pizza of your life 🍕", music: "Neapolitan Vibes — cucina", likeCount: 0, comments: [], likes: [] },
    ];
    for (const v of seed) {
      await ddb.send(new PutCommand({ TableName: VIDEOS_TABLE, Item: v }));
    }
    console.log("Seeded sample videos to DynamoDB");
  },
};

// ===== Auth middleware =====
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: "unauthorized" });
  next();
}

// ===== Routes =====
app.get("/api/health", (_req, res) => res.json({ ok: true, ddb: true }));
app.get("/api/me", (req, res) => res.json(req.session?.user || {}));

// Auth
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
  } catch {
    res.status(500).json({ error: "signup_failed" });
  }
});
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
app.post("/api/auth/logout", (req, res) => { req.session = null; res.json({ ok: true }); });

// Feed
app.get("/api/feed", async (_req, res) => {
  try { await store.ensureSeedVideos(); const list = await store.listVideos(); res.json(list); }
  catch { res.status(500).json({ error: "feed_failed" }); }
});
app.post("/api/videos/:id/like", requireAuth, async (req, res) => {
  try { const likeCount = await store.likeVideo(req.params.id, req.session.user.id); res.json({ id: Number(req.params.id), likeCount }); }
  catch { res.status(404).json({ error: "not_found" }); }
});
app.get("/api/videos/:id/comments", async (req, res) => {
  try { const items = await store.getComments(req.params.id); res.json({ id: Number(req.params.id), comments: items }); }
  catch { res.status(404).json({ error: "not_found" }); }
});
app.post("/api/videos/:id/comments", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").toString().trim();
  if (text.length < 1) return res.status(400).json({ error: "empty_comment" });
  if (text.length > 300) return res.status(400).json({ error: "too_long" });
  try { const comment = await store.addComment(req.params.id, req.session.user.username, text); res.status(201).json({ ok: true, comment }); }
  catch { res.status(404).json({ error: "not_found" }); }
});

app.get("/api/account/courses", requireAuth, async (req,res)=>{
  const out = await store.listCourses(req.session.user.username);
  res.json({ courses: out });
});

app.post("/api/account/courses", requireAuth, async (req,res)=>{
  const name = String(req.body?.name||"").trim();
  if (!name) return res.status(400).json({ error: "empty_course" });
  const out = await store.addCourse(req.session.user.username, name);
  res.status(201).json({ ok:true, courses: out });
});

app.delete("/api/account/courses", requireAuth, async (req,res)=>{
  const name = String(req.body?.name||"").trim();
  if (!name) return res.status(400).json({ error: "empty_course" });
  const out = await store.removeCourse(req.session.user.username, name);
  res.json({ ok:true, courses: out });
});
app.post("/api/account/password", requireAuth, async (req, res) => {
  const oldPassword = String(req.body?.oldPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (newPassword.length < 6) return res.status(400).json({ error: "password_too_short" });
  try { const ok = await store.changePassword(req.session.user.username, oldPassword, newPassword); if (!ok) return res.status(401).json({ error: "invalid_old_password" }); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "password_change_failed" }); }
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT} (DDB=on)`));

