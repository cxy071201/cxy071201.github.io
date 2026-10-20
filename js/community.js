/* ===== 江苏省奶龙中学 · 社区数据与交互 =====
   所有数据存储于浏览器 localStorage，开箱即用（无后端）。
   首次访问自动注入示例内容，用户可发帖、点赞、评论、投稿。
*/
(function () {
  'use strict';

  var KEY = 'nl_site';
  var AVATARS = ['🐉', '🐱', '🐶', '🦊', '🐰', '🐼', '🦁', '🐨', '🦄', '🐸', '🐵', '🦉'];
  var _supaUrl = (window.NL_CONFIG && window.NL_CONFIG.supabaseUrl) || '';
  var _supaKey = (window.NL_CONFIG && window.NL_CONFIG.supabaseKey) || '';
  var IS_CLOUD = !!_supaUrl;
  var cloudData = null;   // 云端模式下缓存的全局数据
  var UID_KEY = (window.NL_CONFIG && window.NL_CONFIG.idKey) || 'nl_uid';
  var _uid = localStorage.getItem(UID_KEY) || 'u' + (Math.random().toString(36).slice(2, 10));

  /* 云端辅助：每个访客一个固定 uid，用于点赞去重 */
  function uidToken() {
    localStorage.setItem(UID_KEY, _uid);
    return _uid;
  }
  /* Supabase(PostgREST) 请求辅助 */
  function supa(path, opts) {
    var headers = {
      'apikey': _supaKey,
      'Authorization': 'Bearer ' + _supaKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
    return fetch(_supaUrl + '/rest/v1/' + path, Object.assign({ headers: headers }, opts || {}));
  }

  /* ---------------- 数据读写 ---------------- */
  /* 云端模式：返回内存中的全局数据（未加载时用本地兜底） */
  function localRead() {
    var d;
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { d = {}; }
    return d;
  }
  function read() {
    if (IS_CLOUD && cloudData) return cloudData;
    return localRead();
  }
  function write(d) {
    if (IS_CLOUD) { cloudData = d; return; }  // 云端数据统一由 API 持久化
    localStorage.setItem(KEY, JSON.stringify(d));
  }

  /* 从云端拉取全部共享数据 */
  async function loadCloud() {
    if (!IS_CLOUD) return;
    var d = { user: localRead().user || null, stories: [], gallery: [], nailong: [], uploads: [], reports: [] };
    try {
      var res = await Promise.all([
        supa('posts?select=*&order=created.desc').then(function (r) { return r.json(); })
          .then(function (j) { return Array.isArray(j) ? j : []; }),
        supa('gallery?select=*&order=created.desc').then(function (r) { return r.json(); })
          .then(function (j) { return Array.isArray(j) ? j : []; }),
        supa('comments?select=*&order=created.asc').then(function (r) { return r.json(); })
          .then(function (j) { return Array.isArray(j) ? j : []; }),
        supa('likes?select=post_id,user_id').then(function (r) { return r.json(); })
          .then(function (j) { return Array.isArray(j) ? j : []; })
      ]);
      var posts = res[0];
      var gallery = res[1];
      var comments = res[2];
      var likes = res[3];
      // 点赞去重：当前访客 uidset
      var myUid = uidToken();
      var likedPosts = {};
      likes.forEach(function (l) { if (l.user_id === myUid) likedPosts[l.post_id] = true; });
      // 把评论合并进对应帖子
      var cmap = {};
      comments.forEach(function (c) { (cmap[c.post_id] = cmap[c.post_id] || []).push(c); });
      posts.forEach(function (p) {
        p.time = p.created ? new Date(p.created).getTime() : Date.now();
        p.author = p.author_name;      // 云端字段 -> 前端字段
        p.avatar = p.author_avatar;
        p.anon = !!p.anon;
        p.likedBy = likedPosts[p.id] ? { me: true } : {};
        p.comments = (cmap[p.id] || []).map(function (c) {
          return { id: c.id, name: c.author_name, time: c.created ? new Date(c.created).getTime() : Date.now(), text: c.text };
        });
      });
      gallery.forEach(function (g) {
        g.id = g.id;
        g.likedBy = {};
        g.created = g.created || null;
      });
      d.stories = posts;
      d.gallery = gallery;
      // nailong 直接来自 gallery(图片投稿区复用) 之外，独立读 nailong 表
      var nailRes = await supa('nailong?select=*&order=created.desc').then(function (r) { return r.json(); })
        .then(function (j) { return Array.isArray(j) ? j : []; });
      nailRes.forEach(function (n) { n.likedBy = {}; });
      d.nailong = nailRes;
      // uploads 展示用：与 nailong 一致（学生投稿）——这里并入 nailong，前端展示投稿栏
      var ups = nailRes.map(function (n) { return n; });
      d.uploads = ups;
    } catch (e) { /* 云端暂不可用则显示空 */ }
    cloudData = d;
    renderAll();
  }

  function getUser() { return read().user || null; }

  /* ---------------- 示例数据 ---------------- */
  function seed() {
    if (IS_CLOUD) return; // 云端数据由数据库提供
    var d = read();
    if (!d.seeded || d.seedV !== 3) {
      d.seeded = true;
      d.seedV = 3;
      // 保留用户已发布的内容，仅刷新/初始化吉祥物表情包
      if (!d.user) d.user = null;
      if (!d.gallery) d.gallery = [];
      if (!d.uploads) d.uploads = [];

      // 迁移：无论新老用户，一律移除"舞狮队"帖子
      if (d.stories) {
        d.stories = d.stories.filter(function (s) {
          return !/舞狮|狮子座|来阔紫树/.test(s.title || '') && !/舞狮/.test(s.body || '');
        });
      } else {
        d.stories = [];
      }

      d.stories = d.stories && d.stories.length ? d.stories : [
        { id: 's1', title: '食堂阿姨的神之手', author: '迷路的鱼', avatar: '🐟', anon: false,
          tag: '食堂', time: Date.now() - 3600e3 * 5, likes: 32,
          body: '今天打饭，我说"阿姨少打点饭，我在减肥。"阿姨头也不抬："孩子，你去年也这么说。"然后就给我多舀了两勺……我都不知道该哭还是该感动。',
          comments: [{ name: '干饭人', time: Date.now() - 3600e3 * 4, text: '哈哈哈哈同感，阿姨怕是记得每一个人的脸。' }] },
        { id: 's2', title: '数学课困到怀疑人生', author: '匿名同学', avatar: '🐼', anon: true,
          tag: '课堂', time: Date.now() - 3600e3 * 12, likes: 18,
          body: '数学课最后一节，我同桌眼皮打架，老师："谁来讲讲这道题的思路？"全班安静，就他猛地站起来："啊？讲到辅助线了？"——于是他成功站了一节课。',
          comments: [] },
        { id: 's4', title: '秋运会班级大团结', author: '跑道上的风', avatar: '🐰', anon: false,
          tag: '运动会', time: Date.now() - 3600e3 * 40, likes: 27,
          body: '4×100接力最后一棒，我们班本来第三，结果前一棒摔倒又爬起来硬冲，全班喊破嗓子。虽然没有名次，但这一幕值得记三年。',
          comments: [] }
      ];

      d.gallery = [
        { id: 'g1', img: 'images/scene-spring.svg', title: '春 · 樱花大道', cat: '四季校园', author: '春樱', likes: 56 },
        { id: 'g2', img: 'images/scene-summer.svg', title: '夏 · 林荫操场', cat: '四季校园', author: '夏日', likes: 48 },
        { id: 'g3', img: 'images/scene-autumn.svg', title: '秋 · 银杏广场', cat: '四季校园', author: '银杏', likes: 61 },
        { id: 'g4', img: 'images/scene-stadium.svg', title: '体育馆 · 省级赛场', cat: '场馆设施', author: '体育馆', likes: 33 },
        { id: 'g5', img: 'images/scene-aerial.svg', title: '航拍 · 全景校园', cat: '航拍', author: '航拍组', likes: 72 },
        { id: 'g6', img: 'images/scene-canteen.svg', title: '食堂 · 美食引力', cat: '校园生活', author: '干饭人', likes: 39 },
        { id: 'g7', img: 'images/scene-club.svg', title: '社团 · 舞狮同好', cat: '社团活动', author: '狮子座', likes: 44 },
        { id: 'g8', img: 'images/scene-library.svg', title: '图书馆 · 静读时光', cat: '场所', author: '拾光', likes: 29 },
        { id: 'g9', img: 'images/scene-dusk.svg', title: '黄昏 · 回廊余晖', cat: '四季校园', author: '黄昏', likes: 52 }
      ];

      // 吉祥物表情包：始终使用最新素材（用户上传作品保存在 d.uploads，不重置）
      d.nailong = [
        { id: 'n1', img: 'images/mascot-a.jpg', title: '奶龙 · 挥手', author: '奶龙工作室', likes: 90 },
        { id: 'n2', img: 'images/mascot-b.jpg', title: '奶龙 · 抱臂', author: '奶龙工作室', likes: 77 }
      ];

      if (!d.uploads) d.uploads = [];

      write(d);
    }
  }

  /* ---------------- 通用工具 ---------------- */
  function timeAgo(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    return new Date(t).toLocaleDateString('zh-CN');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 2200);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------------- 身份（登录注册弹窗） ---------------- */
  function requireUser(next) {
    var u = getUser();
    if (u && u.name) { next(u); return; }
    openLoginModal(next);
  }

  function openLoginModal(cb) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head"><h3>👋 欢迎来到奶龙社区</h3><button class="modal-close">&times;</button></div>' +
        '<p style="font-size:14px;color:var(--text-light);margin-bottom:8px;">选择你的头像，再取个响亮的名字吧！</p>' +
        '<div class="avatar-picker" id="avatarPicker"></div>' +
        '<div class="nickname-row"><input id="nickname" maxlength="12" placeholder="输入昵称（可匿名发布）"></div>' +
        '<div style="display:flex;gap:10px;margin-top:18px;">' +
          '<button class="btn" id="confirmUser" style="flex:1;">进入社区</button>' +
          '<button class="btn ghost" id="guestUser" style="background:transparent;border:1px solid var(--primary);color:var(--primary);flex:1;">游客随便看看</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var sel = '🐉';
    var picker = overlay.querySelector('#avatarPicker');
    AVATARS.forEach(function (a) {
      var b = document.createElement('div');
      b.className = 'ap' + (a === sel ? ' sel' : '');
      b.textContent = a;
      b.addEventListener('click', function () {
        picker.querySelectorAll('.ap').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        sel = a;
      });
      picker.appendChild(b);
    });

    function close() { overlay.remove(); if (cb) cb(null); }
    overlay.querySelector('.modal-close').addEventListener('click', close);

    function confirm() {
      var input = overlay.querySelector('#nickname');
      var name = input.value.trim();
      if (!name) { input.focus(); toast('请先输入昵称哦～'); return; }
      var d = read();
      d.user = { name: name, avatar: sel };
      write(d);
      overlay.remove();
      paintUserHeader();
      toast('欢迎你，' + name + '！🎉');
      if (cb) cb(d.user);
    }

    overlay.querySelector('#confirmUser').addEventListener('click', confirm);
    overlay.querySelector('#guestUser').addEventListener('click', close);
    overlay.querySelector('#nickname').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') confirm();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  function paintUserHeader() {
    var u = getUser();
    var uname = document.getElementById('userName');
    var uavatar = document.getElementById('userAvatar');
    var loginBtn = document.getElementById('loginBtn');
    if (uname) uname.textContent = u && u.name ? u.name : '游客';
    if (uavatar) uavatar.textContent = u && u.name ? (u.avatar || u.name.charAt(0)) : '客';
    if (loginBtn) loginBtn.textContent = u && u.name ? '切换身份' : '登录 / 注册';
  }

  function bindLoginBtn() {
    var btn = document.getElementById('loginBtn');
    if (btn) btn.addEventListener('click', function () { openLoginModal(); });
  }

  function initUser() {
    bindLoginBtn();
    paintUserHeader();
  }

  /* ---------------- 互动：点赞/评论（stories & gallery & nailong） ---------------- */
  function likeItem(kind, id, el) {
    var d = read();
    var arr = d[kind] || [];
    var item = arr.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    var u = getUser();
    if (!u || !u.name) { toast('登录后才能点赞哦～'); openLoginModal(); return; }
    if (kind === 'stories' && IS_CLOUD) {
      // 云端：用 likes 表切换点赞，并更新帖子 likes 计数
      var ukey = uidToken();
      var pid = id;
      supa('likes?select=post_id&post_id=eq.' + encodeURIComponent(pid) + '&user_id=eq.' + encodeURIComponent(ukey))
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          var exists = Array.isArray(rows) && rows.length > 0;
          var delta = exists ? -1 : 1;
          var req = exists
            ? supa('likes?post_id=eq.' + encodeURIComponent(pid) + '&user_id=eq.' + encodeURIComponent(ukey), { method: 'DELETE' })
            : supa('likes', { method: 'POST', body: JSON.stringify({ post_id: pid, user_id: ukey }) });
          return req.then(function () { return delta; });
        })
        .then(function (delta) {
          // 重算 likes 数量（简单方式：先读当前值再 +/-）
          return supa('posts?select=likes&id=eq.' + encodeURIComponent(pid))
            .then(function (r) { return r.json(); })
            .then(function (rows) {
              var cur = (Array.isArray(rows) && rows[0] && typeof rows[0].likes === 'number') ? rows[0].likes : 0;
              var next = Math.max(0, cur + delta);
              return supa('posts?id=eq.' + encodeURIComponent(pid), { method: 'PATCH', body: JSON.stringify({ likes: next }) })
                .then(function () { return next; });
            });
        })
        .then(function (next) {
          if (el) { el.textContent = '👍 ' + next; }
          loadCloud(); // 重新拉取以更新 liked 状态
        }).catch(function () { loadCloud(); });
      return;
    }
    if (!item.likedBy) item.likedBy = {};
    var key = u.name + '|' + (u.avatar || '');
    if (item.likedBy[key]) {
      delete item.likedBy[key];
      item.likes = (item.likes || 1) - 1;
      if (el) { el.classList.remove('liked'); el.innerHTML = '👍 ' + (item.likes || 0); }
    } else {
      item.likedBy[key] = true;
      item.likes = (item.likes || 0) + 1;
      if (el) { el.classList.add('liked'); el.innerHTML = '👍 ' + (item.likes || 0); }
    }
    d[kind] = arr;
    write(d);
  }

  /* ---------------- 趣事广场 ---------------- */
  var STORY_TAGS = ['全部', '食堂', '课堂', '社团', '运动会', '宿舍', '校园日常', '考试'];
  function renderStories(container, category) {
    if (!container) return;
    var d = read();
    var arr = (d.stories || []).slice();
    if (category && category !== '全部') arr = arr.filter(function (s) { return s.tag === category; });
    arr.sort(function (a, b) { return b.time - a.time; });

    var first = arr[0];
    var featured = first ? (
      '<div class="callout" style="margin:0 0 22px;">' +
        '<h4>🔥 今日热帖</h4>' +
        '<p style="text-indent:0;font-size:16px;"><strong>' + escapeHtml(first.title) + '</strong></p>' +
        '<p style="text-indent:0;color:var(--text-light);">' + escapeHtml(first.body.slice(0, 60)) + '… <a href="#post-' + first.id + '" style="color:var(--primary);">阅读全文</a></p>' +
      '</div>'
    ) : '';

    if (!arr.length) {
      container.innerHTML = featured + '<div class="empty-state"><div class="ico">🎈</div><p>这里还没有相关内容，快来抢占第一帖吧！</p></div>';
      return;
    }

    var html = featured + '<div class="post-feed">' + arr.map(function (p) {
      var tags = p.tag ? '<span class="tag">' + escapeHtml(p.tag) + '</span>' : '';
      var who = p.anon ? '<span class="who" style="background:#eef1f0;color:#9aa5a0;">匿</span>' : '<span class="who">' + escapeHtml(p.avatar || p.author.charAt(0)) + '</span>';
      var name = p.anon ? '匿名同学' : escapeHtml(p.author);
      var cmts = (p.comments || []).map(function (c) {
        return '<div class="cmt">' +
          '<div class="cmt-head"><span class="cname">' + escapeHtml(c.name) + '</span>' +
          '<button class="cmt-report" data-kind="comment" data-id="' + escapeHtml(c.id || '') + '" data-preview="' + escapeHtml(c.text.replace(/\s+/g, ' ').slice(0, 40)) + '" title="举报该评论">🚩</button></div>' +
          '<span class="ctime">' + timeAgo(c.time) + '</span><div>' + escapeHtml(c.text) + '</div></div>';
      }).join('');
      var cmtCount = (p.comments || []).length;
      var liked = p.likedBy && Object.keys(p.likedBy).length;

      return '<article class="post-card" id="post-' + p.id + '">' +
        '<div class="post-meta">' + who +
          '<div class="post-meta-txt"><div class="name">' + name + '</div><div class="time">' + timeAgo(p.time) + '</div></div>' + tags +
        '</div>' +
        '<h5>' + escapeHtml(p.title) + '</h5>' +
        '<div class="post-body">' + escapeHtml(p.body) + '</div>' +
        '<div class="post-actions">' +
          '<button class="like-btn' + (liked ? ' liked' : '') + '" data-kind="stories" data-id="' + p.id + '">👍 ' + (p.likes || 0) + '</button>' +
          '<button class="cmt-btn" data-id="' + p.id + '">💬 ' + cmtCount + '</button>' +
          '<button class="share-btn" data-title="' + escapeHtml(p.title) + '">🔗 分享</button>' +
          '<button class="report-btn" data-kind="post" data-id="' + escapeHtml(p.id) + '" data-preview="' + escapeHtml(p.title) + '" title="举报该内容">🚩 举报</button>' +
        '</div>' +
        '<div class="comments" id="cmt-' + p.id + '">' + cmts +
          '<div class="cmt-input"><input placeholder="说点什么…" data-cmt="' + p.id + '"><button data-addcmt="' + p.id + '">发送</button></div>' +
        '</div>' +
      '</article>';
    }).join('') + '</div>';

    container.innerHTML = html;
  }

  function bindStories(container) {
    if (!container) return;
    if (container.__bound) return;
    container.__bound = true;
    container.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('.like-btn'))) {
        likeItem(t.getAttribute('data-kind'), t.getAttribute('data-id'), t);
      } else if ((t = e.target.closest('.cmt-btn'))) {
        var c = document.getElementById('cmt-' + t.getAttribute('data-id'));
        if (c) c.classList.toggle('open');
      } else if ((t = e.target.closest('[data-addcmt]'))) {
        addComment(t.getAttribute('data-addcmt'), container);
      } else if ((t = e.target.closest('.share-btn'))) {
        var title = t.getAttribute('data-title') || '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText('看看我发的校园趣事："' + title + '" — 江苏省奶龙中学学生社区').then(function () { toast('已复制分享文案 📋'); });
        } else { toast('复制失败，请手动分享'); }
      } else if ((t = e.target.closest('.report-btn, .cmt-report'))) {
        reportContent(t.getAttribute('data-kind') || 'post', t.getAttribute('data-id') || '', t.getAttribute('data-preview') || '');
      }
    });
  }

  /* 统一的举报上报 */
  function reportContent(kind, id, preview) {
    if (IS_CLOUD) {
      supa('reports', { method: 'POST', body: JSON.stringify({ kind: kind, target_id: id, preview: preview }) })
        .then(function () { toast('已收到举报，管理员将尽快处理 🚩 感谢你维护社区环境'); })
        .catch(function () { toast('举报提交失败，请稍后再试'); });
      return;
    }
    var d = read();
    if (!d.reports) d.reports = [];
    d.reports.push({ kind: kind, title: preview, time: Date.now() });
    write(d);
    toast('已收到举报，管理员将尽快处理（可匿名）🚩 感谢你维护社区环境');
  }

  function addComment(id, container) {
    var u = getUser();
    if (!u || !u.name) { toast('登录后才能评论哦～'); openLoginModal(); return; }
    var input = container.querySelector('[data-cmt="' + id + '"]');
    var text = input.value.trim();
    if (!text) { input.focus(); return; }
    if (IS_CLOUD) {
      supa('comments', { method: 'POST', body: JSON.stringify({ post_id: id, author_name: u.name, text: text }) })
        .then(function () { input.value = ''; return loadCloud(); })
        .then(function () {
          var c = document.getElementById('cmt-' + id);
          if (c) c.classList.add('open');
        }).catch(function () {});
      return;
    }
    var d = read();
    var arr = d.stories || [];
    var item = arr.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    if (!item.comments) item.comments = [];
    item.comments.push({ name: u.name, avatar: u.avatar, time: Date.now(), text: text });
    d.stories = arr;
    write(d);
    input.value = '';
    renderStories(container, currentFilter());
    var c = document.getElementById('cmt-' + id);
    if (c) c.classList.add('open');
  }

  var _currentFilter = '全部';
  function currentFilter() { return _currentFilter; }

  /* 浮动发布按钮 */
  function bindFab() {
    var fab = document.getElementById('fabCompose');
    if (fab) fab.addEventListener('click', openCompose);
  }

  function initStoriesPage() {
    var container = document.getElementById('storiesFeed');
    if (!container) return;
    var btn = document.getElementById('btnCompose');
    if (btn) btn.addEventListener('click', openCompose);
    var filterBar = document.getElementById('storyFilter');
    if (filterBar) {
      filterBar.innerHTML = STORY_TAGS.map(function (t) {
        return '<button class="chip' + (t === '全部' ? ' active' : '') + '" data-tag="' + t + '">' + t + '</button>';
      }).join('');
      filterBar.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        filterBar.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('active'); });
        chip.classList.add('active');
        _currentFilter = chip.getAttribute('data-tag');
        renderStories(container, _currentFilter);
      });
    }
    renderStories(container, _currentFilter);
    bindStories(container);
  }

  /* ---------------- 发布趣事 ---------------- */
  function openCompose() {
    var u = getUser();
    openLoginModal(function (user) {
      if (!user) return;
      composeModal();
    });
  }

  function composeModal() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="modal wide">' +
        '<div class="modal-head"><h3>✏️ 发布校园趣事</h3><button class="modal-close">&times;</button></div>' +
        '<div class="compose">' +
          '<input id="cmpTitle" maxlength="30" placeholder="标题（一句话把大家逗乐）">' +
          '<textarea id="cmpBody" maxlength="500" placeholder="说说你遇到的趣事……"></textarea>' +
          '<select id="cmpTag">' + STORY_TAGS.filter(function (t) { return t !== '全部'; }).map(function (t) {
            return '<option value="' + t + '">' + t + '</option>';
          }).join('') + '</select>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<label class="anon-row" style="margin:0;"><input type="checkbox" id="cmpAnon"> 匿名发布</label>' +
            '<span style="font-size:12px;color:var(--text-lighter);">请遵守《社区文明公约》</span>' +
          '</div>' +
        '</div>' +
        '<button class="btn" id="cmpSubmit" style="width:100%;margin-top:16px;">发布趣事</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    function submit() {
      var title = overlay.querySelector('#cmpTitle').value.trim();
      var body = overlay.querySelector('#cmpBody').value.trim();
      var tag = overlay.querySelector('#cmpTag').value;
      var anon = overlay.querySelector('#cmpAnon').checked;
      if (!title || !body) { toast('标题和内容都要填哦～'); return; }
      var u = getUser();
      if (IS_CLOUD) {
        supa('posts', { method: 'POST', body: JSON.stringify({ title: title, body: body, tag: tag, anon: anon ? 1 : 0, author_name: u.name, author_avatar: u.avatar || '🐉' }) })
          .then(function () { overlay.remove(); toast('发布成功！🎉 感谢你的分享'); return loadCloud(); })
          .catch(function () { toast('发布失败，请检查网络'); });
        return;
      }
      var d = read();
      if (!d.stories) d.stories = [];
      d.stories.unshift({
        id: 's' + Date.now(),
        title: title, body: body, tag: tag, anon: anon,
        author: u.name, avatar: u.avatar || '🐉',
        time: Date.now(), likes: 0, comments: []
      });
      write(d);
      overlay.remove();
      renderStories(document.getElementById('storiesFeed'), currentFilter());
      toast('发布成功！🎉 感谢你的分享');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    overlay.querySelector('#cmpSubmit').addEventListener('click', submit);
  }

  /* ---------------- 校园图景 ---------------- */
  var GALLERY_CATS = ['全部', '四季校园', '场馆设施', '校园生活', '社团活动', '航拍', '场所'];
  function renderGallery(container, cat) {
    if (!container) return;
    var d = read();
    var arr = (d.gallery || []).slice();
    if (cat && cat !== '全部') arr = arr.filter(function (g) { return g.cat === cat; });
    if (!arr.length) {
      container.innerHTML = '<div class="empty-state"><div class="ico">📷</div><p>这个分类还没有照片，快去拍一张吧！</p></div>';
      return;
    }
    container.innerHTML = arr.map(function (g) {
      var liked = g.likedBy && Object.keys(g.likedBy).length;
      return '<figure class="gallery-item">' +
        '<span class="cat-badge">' + escapeHtml(g.cat) + '</span>' +
        '<button class="gal-report" data-kind="gallery" data-id="' + escapeHtml(g.id) + '" data-preview="' + escapeHtml(g.title) + '" title="举报该图片">🚩</button>' +
        '<img src="' + g.img + '" alt="' + escapeHtml(g.title) + '">' +
        '<figcaption class="g-info">' +
          '<div class="g-title">' + escapeHtml(g.title) + '</div>' +
          '<div class="g-meta"><span>by ' + escapeHtml(g.author) + '</span>' +
          '<button class="gallike' + (liked ? ' liked' : '') + '" data-id="' + g.id + '">❤ ' + (g.likes || 0) + '</button></div>' +
        '</figcaption>' +
      '</figure>';
    }).join('');
  }

  function bindGallery(container) {
    if (!container) return;
    if (container.__bound) return;
    container.__bound = true;
    container.addEventListener('click', function (e) {
      var rep = e.target.closest('.gal-report');
      if (rep) {
        reportContent(rep.getAttribute('data-kind') || 'gallery', rep.getAttribute('data-id') || '', rep.getAttribute('data-preview') || '');
        return;
      }
      var t = e.target.closest('.gallike');
      if (!t) return;
      var u = getUser();
      if (!u || !u.name) { toast('登录后才能点赞哦～'); openLoginModal(); return; }
      var d = read();
      var arr = d.gallery || [];
      var item = arr.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
      if (!item) return;
      if (IS_CLOUD) {
        var gid = t.getAttribute('data-id');
        var cur = typeof item.likes === 'number' ? item.likes : 0;
        var next = (item.likedBy && Object.keys(item.likedBy).length) ? Math.max(0, cur - 1) : cur + 1;
        t.textContent = '❤ ' + next;
        if (item.likedBy && Object.keys(item.likedBy).length) { delete item.likedBy.me; item.likedBy = {}; t.classList.remove('liked'); }
        else { item.likedBy = { me: true }; t.classList.add('liked'); }
        supa('gallery?id=eq.' + encodeURIComponent(gid), { method: 'PATCH', body: JSON.stringify({ likes: next }) }).catch(function () {});
        return;
      }
      if (!item.likedBy) item.likedBy = {};
      var key = u.name + '|' + (u.avatar || '');
      if (item.likedBy[key]) { delete item.likedBy[key]; item.likes = (item.likes || 1) - 1; t.classList.remove('liked'); }
      else { item.likedBy[key] = true; item.likes = (item.likes || 0) + 1; t.classList.add('liked'); }
      t.textContent = '❤ ' + (item.likes || 0);
      write(d);
    });
  }

  function initGalleryPage() {
    var container = document.getElementById('galleryGrid');
    if (!container) return;
    var bar = document.getElementById('galleryFilter');
    if (bar) {
      bar.innerHTML = GALLERY_CATS.map(function (c) {
        return '<button class="chip' + (c === '全部' ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
      }).join('');
      bar.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        bar.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('active'); });
        chip.classList.add('active');
        renderGallery(container, chip.getAttribute('data-cat'));
      });
    }
    renderGallery(container, '全部');
    bindGallery(container);
  }

  /* ---------------- 奶龙专区 ---------------- */
  function renderNailong(container) {
    if (!container) return;
    var d = read();
    var arr = d.nailong || [];
    container.innerHTML = arr.map(function (n) {
      var liked = n.likedBy && Object.keys(n.likedBy).length;
      return '<div class="sticker">' +
        '<button class="sticker-report" data-kind="nailong" data-id="' + escapeHtml(n.id) + '" data-preview="' + escapeHtml(n.title) + '" title="举报">🚩</button>' +
        '<img src="' + n.img + '" alt="' + escapeHtml(n.title) + '">' +
        '<div class="s-name">' + escapeHtml(n.title) + '</div>' +
        '<span class="dl" data-dl="' + n.img + '">⬇ 下载</span>' +
        '<button class="dl" data-nlike="' + n.id + '" style="display:block;margin:6px auto 0;border:none;background:none;cursor:pointer;font-size:13px;' + (liked ? 'color:#e07a7a;' : 'color:var(--text-light);') + '">❤ ' + (n.likes || 0) + '</button>' +
      '</div>';
    }).join('') || '<div class="empty-state"><div class="ico">🐉</div><p>还没有奶龙投稿。</p></div>';
  }

  function bindNailong(container) {
    if (!container) return;
    if (container.__bound) return;
    container.__bound = true;
    container.addEventListener('click', function (e) {
      var rep = e.target.closest('.sticker-report');
      if (rep) {
        reportContent(rep.getAttribute('data-kind') || 'nailong', rep.getAttribute('data-id') || '', rep.getAttribute('data-preview') || '');
        return;
      }
      var dl = e.target.closest('[data-dl]');
      if (dl) {
        var a = document.createElement('a');
        a.href = dl.getAttribute('data-dl');
        a.download = 'nailong-' + Date.now() + '.svg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('已开始下载 ⬇');
        return;
      }
      var like = e.target.closest('[data-nlike]');
      if (like) {
        var u = getUser();
        if (!u || !u.name) { toast('登录后才能点赞哦～'); openLoginModal(); return; }
        var d = read();
        var item = (d.nailong || []).filter(function (x) { return x.id === like.getAttribute('data-nlike'); })[0];
        if (!item) return;
        if (IS_CLOUD) {
          var nid = like.getAttribute('data-nlike');
          var cur = typeof item.likes === 'number' ? item.likes : 0;
          var already = item.likedBy && Object.keys(item.likedBy).length;
          var next = already ? Math.max(0, cur - 1) : cur + 1;
          if (already) { item.likedBy = {}; like.style.color = 'var(--text-light)'; }
          else { item.likedBy = { me: true }; like.style.color = '#e07a7a'; }
          like.textContent = '❤ ' + next;
          supa('nailong?id=eq.' + encodeURIComponent(nid), { method: 'PATCH', body: JSON.stringify({ likes: next }) }).catch(function () {});
          return;
        }
        if (!item.likedBy) item.likedBy = {};
        var key = u.name + '|' + (u.avatar || '');
        if (item.likedBy[key]) { delete item.likedBy[key]; item.likes = (item.likes || 1) - 1; like.style.color = 'var(--text-light)'; }
        else { item.likedBy[key] = true; item.likes = (item.likes || 0) + 1; like.style.color = '#e07a7a'; }
        like.textContent = '❤ ' + (item.likes || 0);
        write(d);
      }
    });
  }

  /* 学生投稿（上传本地图片，base64 存 localStorage） */
  function renderUploads(container) {
    if (!container) return;
    var d = read();
    var arr = d.uploads || [];
    container.innerHTML = arr.map(function (n) {
      return '<div class="sticker">' +
        '<img src="' + n.img + '" alt="' + escapeHtml(n.title) + '">' +
        '<div class="s-name">' + escapeHtml(n.title) + ' · by ' + escapeHtml(n.author || '奶龙粉丝') + '</div>' +
        '<span class="dl" data-udl="' + n.id + '" style="color:var(--primary);font-size:12px;">⬇ 保存</span>' +
      '</div>';
    }).join('') || '<div class="empty-state" style="width:100%;"><div class="ico">🎨</div><p>还没有学生投稿，快上传第一幅作品吧！</p></div>';
  }

  function bindUploads(container) {
    if (!container) return;
    if (container.__bound) return;
    container.__bound = true;
    container.addEventListener('click', function (e) {
      var b = e.target.closest('[data-udl]');
      if (!b) return;
      var d = read();
      var item = (d.uploads || []).filter(function (x) { return x.id === b.getAttribute('data-udl'); })[0];
      if (!item) return;
      var a = document.createElement('a');
      a.href = item.img;
      a.download = 'nailong-' + item.title + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('已保存 ⬇');
    });
  }

  function initUploadNailong() {
    var input = document.getElementById('nlUpload');
    var btn = document.getElementById('nlUploadBtn');
    var title = document.getElementById('nlTitle');
    if (!input || !btn) return;
    btn.addEventListener('click', function () {
      var t = title.value.trim();
      if (!t) { toast('给作品起个名字吧'); title.focus(); return; }
      if (!input.files || !input.files[0]) { input.value = ''; toast('请先选择一张图片'); return; }
      var file = input.files[0];
      if (!/^image\//.test(file.type)) { toast('请选择图片文件'); return; }
      if (IS_CLOUD) {
        // 云端：图片转 base64 存入 gallery 表（作者投稿），所有人可见
        var reader = new FileReader();
        reader.onload = function () {
          supa('gallery', { method: 'POST', body: JSON.stringify({ title: t, cat: '学生投稿', author: (getUser() && getUser().name) || '奶龙粉丝', img: reader.result, likes: 0 }) })
            .then(function () {
              input.value = ''; title.value = '';
              toast('投稿成功！你的奶龙作品上墙啦 🎉');
              return loadCloud();
            }).catch(function () { toast('上传失败，请检查网络'); });
        };
        reader.readAsDataURL(file);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var d = read();
        if (!d.uploads) d.uploads = [];
        d.uploads.unshift({
          id: 'up' + Date.now(), img: reader.result, title: t,
          author: (getUser() && getUser().name) || '奶龙粉丝', likes: 0
        });
        write(d);
        renderUploads(document.getElementById('nailongGrid2'));
        input.value = ''; title.value = '';
        toast('投稿成功！你的奶龙作品上墙啦 🎉');
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- 首页统计 ---------------- */
  function initHome() {
    var d = read();
    var be = document.getElementById('bc-stories'), ga = document.getElementById('bc-gallery'), na = document.getElementById('bc-nailong');
    if (be) be.textContent = (d.stories || []).length;
    if (ga) ga.textContent = (d.gallery || []).length;
    if (na) na.textContent = (d.nailong || []).length;

    var mini = document.getElementById('miniStories');
    if (mini) {
      var top = (d.stories || []).slice().sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); }).slice(0, 5);
      mini.innerHTML = top.map(function (s) {
        return '<li><span class="tag">' + escapeHtml(s.tag || '日常') + '</span><a class="title" href="stories.html">' + escapeHtml(s.title) + '</a><span class="heat">👍 ' + (s.likes || 0) + '</span></li>';
      }).join('') || '<li>还没有趣事，快发布第一条吧！</li>';
    }
  }

  /* ---------------- 新闻/通知双轨 ---------------- */
  function initNews() {
    var d = read();
    var cc = document.getElementById('communityNews');
    if (cc) {
      var items = (d.stories || []).slice().sort(function (a, b) { return b.time - a.time; }).slice(0, 6);
      cc.innerHTML = items.map(function (s) {
        return '<li><span><a href="stories.html">' + escapeHtml(s.title) + '</a></span><span class="date">' + timeAgo(s.time) + '</span></li>';
      }).join('') || '<li>暂无社区动态</li>';
    }
  }

  /* ---------------- 初始化 ---------------- */
  function renderAll() {
    initStoriesPage();
    initGalleryPage();
    initNailongPage();
    initHome();
    initNews();
  }

  function init() {
    initUser();
    if (IS_CLOUD) {
      loadCloud(); // 云端全部数据由 loadCloud 拉到后调用 renderAll
    } else {
      seed();
      initStoriesPage();
      initGalleryPage();
      initNailongPage();
      initHome();
      initNews();
    }
    initUploadNailong();
    bindFab();
  }

  function initNailongPage() {
    var grid = document.getElementById('nailongGrid');
    if (grid) { renderNailong(grid); bindNailong(grid); }
    var grid2 = document.getElementById('nailongGrid2');
    if (grid2) { renderUploads(grid2); bindUploads(grid2); }
  }

  /* 供页面脚本（如奶龙页）在布局就绪后统一刷新渲染 */
  window.__nlRenderAll = function () {
    initStoriesPage();
    initGalleryPage();
    initNailongPage();
    initHome();
    initNews();
  };

  document.addEventListener('DOMContentLoaded', init);
  // 布局可能异步注入用户菜单，再次同步
  window.addEventListener('nl-layout-ready', function () { initUser(); });

  window.NLCommunity = { initUser: initUser, openLoginModal: openLoginModal };
})();
