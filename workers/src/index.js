/* ===== 江苏省奶龙中学 · 云端社区后端 =====
   Cloudflare Workers + D1 数据库 + R2 存储
   所有数据存入全局数据库，所有访客共享同一份内容。
*/
const ALLOW = ['*']; // CORS：公开站点，允许所有来源（可改为 https://cxy071201.github.io）

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-token',
    'Access-Control-Max-Age': '86400',
  };
}
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(), ...extra },
  });
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- 首次使用：注入示例内容（公开版不至于空白） ---------- */
let _seeded = false; // 进程内标记，避免并发请求重复塞入示例数据
async function seedIfEmpty(env) {
  if (_seeded) return;
  const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM posts').first();
  if (cnt && cnt.n > 0) { _seeded = true; return; }
  _seeded = true;
  const c = Math.floor(Date.now() / 1000);
  const seed = [];
  // posts
  const posts = [
    ['s1', '奶龙', '🐉', '食堂阿姨的神之手', '今天打饭，我说"阿姨少打点饭，我在减肥。"阿姨头也不抬："孩子，你去年也这么说。"然后就给我多舀了两勺……我都不知道该哭还是该感动。', '食堂', 32, c - 5 * 3600],
    ['s2', '匿名同学', '🐼', '数学课困到怀疑人生', '数学课最后一节，我同桌眼皮打架，老师："谁来讲讲这道题的思路？"全班安静，就他猛地站起来："啊？讲到辅助线了？"——于是他成功站了一节课。', '课堂', 18, c - 12 * 3600],
    ['s4', '跑道上的风', '🐰', '秋运会班级大团结', '4×100接力最后一棒，我们班本来第三，结果前一棒摔倒又爬起来硬冲，全班喊破嗓子。虽然没有名次，但这一幕值得记三年。', '运动会', 27, c - 40 * 3600],
  ];
  for (const p of posts) {
    await env.DB.prepare(
      'INSERT INTO posts (id,author_id,author_name,author_avatar,title,body,tag,anon,likes,created) VALUES (?,?,?,?,?,?,?,0,?,?)'
    ).bind(p[0], p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]).run();
  }
  const gallery = [
    ['g1', '春 · 樱花大道', '四季校园', '春樱', 'images/scene-spring.svg', 56],
    ['g2', '夏 · 林荫操场', '四季校园', '夏日', 'images/scene-summer.svg', 48],
    ['g3', '秋 · 银杏广场', '四季校园', '银杏', 'images/scene-autumn.svg', 61],
    ['g4', '体育馆 · 省级赛场', '场馆设施', '体育馆', 'images/scene-stadium.svg', 33],
    ['g6', '食堂 · 美食引力', '校园生活', '干饭人', 'images/scene-canteen.svg', 39],
    ['g8', '图书馆 · 静读时光', '场所', '拾光', 'images/scene-library.svg', 29],
    ['g9', '黄昏 · 回廊余晖', '四季校园', '黄昏', 'images/scene-dusk.svg', 52],
  ];
  for (const g of gallery) {
    await env.DB.prepare('INSERT INTO gallery (id,title,cat,author,img,likes,created) VALUES (?,?,?,?,?,?,?)')
      .bind(g[0], g[1], g[2], g[3], g[4], g[5], c).run();
  }
  const nailong = [
    ['n1', '奶龙 · 挥手', '奶龙工作室', 'images/mascot-a.jpg', 90],
    ['n2', '奶龙 · 抱臂', '奶龙工作室', 'images/mascot-b.jpg', 77],
  ];
  for (const n of nailong) {
    await env.DB.prepare('INSERT INTO nailong (id,title,author,img,likes,created) VALUES (?,?,?,?,?,?)')
      .bind(n[0], n[1], n[2], n[3], n[4], c).run();
  }
}

/* ---------- 路由 ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    await seedIfEmpty(env);
    const path = url.pathname;

    // 图片访问路由（R2 里的上传内容）
    if (path.startsWith('/media/')) {
      const key = path.slice('/media/'.length);
      const obj = await env.UPLOADS.get(key);
      if (!obj) return json({ error: 'not found' }, 404);
      return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/png', 'Cache-Control': 'public, max-age=31536000', ...cors() } });
    }

    // ---- API ----
    if (path === '/api/posts' && request.method === 'GET') {
      const posts = await env.DB.prepare('SELECT * FROM posts ORDER BY created DESC').all();
      return json({ ok: true, posts: posts.results });
    }

    if (path === '/api/posts' && request.method === 'POST') {
      const b = await request.json();
      if (!b.title || !b.body) return json({ error: 'title/body required' }, 400);
      const id = 's' + uid();
      const author_name = b.anon ? '匿名同学' : (b.name || '游客');
      const author_avatar = b.avatar || '🐉';
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        'INSERT INTO posts (id,author_id,author_name,author_avatar,title,body,tag,anon,likes,created) VALUES (?,?,?,?,?,?,?,?,0,?)'
      ).bind(id, 'u' + uid(), author_name, author_avatar, b.title, b.body, b.tag || '校园日常', b.anon ? 1 : 0, now).run();
      return json({ ok: true, id }, 201);
    }

    const postLike = path.match(/^\/api\/posts\/([^/]+)\/like$/);
    if (postLike && request.method === 'POST') {
      const pid = postLike[1];
      const b = await request.json().catch(() => ({}));
      const userId = b.user_id || '';
      const row = await env.DB.prepare('SELECT likes FROM posts WHERE id=?').bind(pid).first();
      if (!row) return json({ error: 'not found' }, 404);
      if (userId) {
        const existing = await env.DB.prepare('SELECT 1 FROM likes WHERE post_id=? AND user_id=?').bind(pid, userId).first();
        if (existing) {
          await env.DB.prepare('DELETE FROM likes WHERE post_id=? AND user_id=?').bind(pid, userId).run();
          await env.DB.prepare('UPDATE posts SET likes = MAX(0, likes-1) WHERE id=?').bind(pid).run();
        } else {
          await env.DB.prepare('INSERT INTO likes (post_id,user_id) VALUES (?,?)').bind(pid, userId).run();
          await env.DB.prepare('UPDATE posts SET likes = likes+1 WHERE id=?').bind(pid).run();
        }
      }
      const after = await env.DB.prepare('SELECT likes FROM posts WHERE id=?').bind(pid).first();
      return json({ ok: true, likes: after.likes });
    }

    const postCmt = path.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (postCmt && request.method === 'POST') {
      const b = await request.json();
      if (!b.text) return json({ error: 'text required' }, 400);
      const id = 'c' + uid();
      await env.DB.prepare('INSERT INTO comments (id,post_id,author_name,text,created) VALUES (?,?,?,?,?)')
        .bind(id, postCmt[1], b.name || '游客', b.text, Math.floor(Date.now() / 1000)).run();
      return json({ ok: true, id }, 201);
    }

    if (path === '/api/comments' && request.method === 'GET') {
      const postId = url.searchParams.get('post_id');
      const q = postId
        ? env.DB.prepare('SELECT * FROM comments WHERE post_id=? ORDER BY created ASC').bind(postId).all()
        : env.DB.prepare('SELECT * FROM comments ORDER BY created ASC').all();
      const { results } = await q;
      return json({ ok: true, comments: results });
    }

    if (path === '/api/gallery' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM gallery ORDER BY likes DESC').all();
      return json({ ok: true, gallery: results });
    }
    if (path === '/api/nailong' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM nailong ORDER BY likes DESC').all();
      return json({ ok: true, nailong: results });
    }

    // ---- 图片上传 ----
    if (path === '/api/upload' && request.method === 'POST') {
      const form = await request.formData();
      const file = form.get('file');
      if (!file) return json({ error: 'no file' }, 400);
      const key = 'up/' + uid() + '-' + (file.name || 'img').replace(/[^\w.\-]/g, '_');
      await env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      const publicUrl = new URL(request.url).origin + '/media/' + key;
      // 记录到 nailong 表（作品投稿）
      const title = form.get('title') || '学生投稿';
      const author = form.get('author') || '奶龙粉丝';
      await env.DB.prepare('INSERT INTO nailong (id,title,author,img,likes,created) VALUES (?,?,?,?,0,?)')
        .bind('up' + uid(), title, author, publicUrl, Math.floor(Date.now() / 1000)).run();
      return json({ ok: true, url: publicUrl }, 201);
    }

    if (path === '/api/reports' && request.method === 'POST') {
      const b = await request.json();
      await env.DB.prepare('INSERT INTO reports (id,target_title,created) VALUES (?,?,?)')
        .bind('r' + uid(), b.title || '', Math.floor(Date.now() / 1000)).run();
      return json({ ok: true });
    }

    // 非 API 请求：交由静态资产（整个网站前端）处理
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'not found' }, 404);
  },
};
