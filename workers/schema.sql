-- 江苏省奶龙中学 · D1 数据库结构
-- 在 Cloudflare 后台创建 D1 数据库后，执行：
--   wrangler d1 execute nailong-db --local --file=./schema.sql   （本地测试）
--   wrangler d1 execute nailong-db --remote --file=./schema.sql  （线上生效）

-- 用户（轻量：只需昵称+头像emoji，不做复杂账号系统）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '🐉',
  created INTEGER NOT NULL
);

-- 趣事帖子
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT DEFAULT '🐉',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT DEFAULT '校园日常',
  anon INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created INTEGER NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 评论
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- 点赞（去重：同一个人在同一个帖子只算一次）
CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- 校园图景（作品库）
CREATE TABLE IF NOT EXISTS gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cat TEXT DEFAULT '校园生活',
  author TEXT NOT NULL,
  img TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created INTEGER NOT NULL
);

-- 奶龙作品集/投稿
CREATE TABLE IF NOT EXISTS nailong (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  img TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created INTEGER NOT NULL
);

-- 举报
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_title TEXT NOT NULL,
  created INTEGER NOT NULL
);
