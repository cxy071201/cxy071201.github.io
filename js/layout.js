/* ===== 江苏省奶龙中学 · 共用布局脚本 =====
   通过自定义标签 <site-header> / <site-footer> 统一注入页头、导航、页脚与用户菜单。
   在 message 中定义初始首页数据(可刷新)。
*/
(function () {
  'use strict';

  // 导航配置：label + href
  var NAV = [
    { label: '首页', href: 'index.html' },
    { label: '趣事广场', href: 'stories.html' },
    { label: '校园图景', href: 'gallery.html' },
    { label: '奶龙专区', href: 'nailong.html' },
    { label: '学校简介', href: 'about.html' },
    { label: '校园新闻', href: 'news.html' },
    { label: '联系我们', href: 'contact.html' }
  ];

  var SCHOOL = '江苏省奶龙中学';
  var PHONE = '0516-88xx-xxxx';

  /* 读取本地存储（安全） */
  function store() {
    var d = {};
    try { d = JSON.parse(localStorage.getItem('nl_site') || '{}'); } catch (e) {}
    return d;
  }

  function renderHeader() {
    var host = document.querySelector('site-header');
    if (!host) return;
    var path = (window.location.pathname.split('/').pop() || 'index.html');
    var current = NAV.filter(function (n) { return n.href === path; })[0];

    var navHtml = NAV.map(function (n) {
      var active = (n.href === path) ? 'active' : '';
      return '<li><a class="' + active + '" href="' + n.href + '">' + n.label + '</a></li>';
    }).join('');

    host.innerHTML =
      '<div class="topbar">' +
        '<div class="container">' +
          '<span>欢迎访问' + SCHOOL + '学生社区 · 分享趣事 · 记录校园</span>' +
          '<span><a href="contact.html">联系我们</a><a href="news.html">校园动态</a></span>' +
        '</div>' +
      '</div>' +
      '<header class="header">' +
        '<div class="container">' +
          '<div class="brand">' +
            '<a class="logo" href="index.html">奶</a>' +
            '<div><a href="index.html" style="display:block;"><h1>' + SCHOOL + '</h1></a>' +
            '<p>中国 · 江苏 · 徐州 · 邳州</p></div>' +
          '</div>' +
          '<div class="header-contact">' +
            '<div class="user-menu" id="userMenu">' +
              '<span class="avatar" id="userAvatar">客</span>' +
              '<span class="uname" id="userName">游客</span>' +
              '<button class="link-btn ghost" id="toggleTheme" title="切换主题">🌗</button>' +
              '<button class="link-btn" id="loginBtn">登录 / 注册</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<nav class="nav">' +
        '<button class="nav-toggle" aria-label="菜单">☰</button>' +
        '<div class="container"><ul id="navList">' + navHtml + '</ul></div>' +
      '</nav>';
  }

  function renderFooter() {
    var host = document.querySelector('site-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="footer">' +
        '<div class="container">' +
          '<div><div class="brand-foot">' + SCHOOL + '</div>' +
            '<p>江苏省首批重点中学 · 国家级示范中学 · 江苏省四星高中</p>' +
            '<p>邳州市教育局直属公办完全中学</p>' +
            '<p style="margin-top:12px;">关注"江苏省运河中学"公众号</p></div>' +
          '<div><h5>社区板块</h5><ul>' +
            '<li><a href="stories.html">趣事广场</a></li>' +
            '<li><a href="gallery.html">校园图景</a></li>' +
            '<li><a href="nailong.html">奶龙专区</a></li></ul></div>' +
          '<div><h5>学校信息</h5><ul>' +
            '<li><a href="about.html">学校简介</a></li>' +
            '<li><a href="news.html">校园新闻</a></li>' +
            '<li><a href="campus.html">校区概况</a></li>' +
            '<li><a href="features.html">特色与口碑</a></li></ul></div>' +
          '<div><h5>联系方式</h5><ul>' +
            '<li>电话：' + PHONE + '</li>' +
            '<li>邮箱：navilong@example.com</li>' +
            '<li><a href="contact.html">招生咨询入口</a></li></ul></div>' +
        '</div>' +
        '<div class="footer-bottom">版权所有 © 2026 ' + SCHOOL + ' · 学生社区 · 保留所有权利</div>' +
      '</footer>';
  }

  function initNavToggle() {
    var toggle = document.querySelector('.nav-toggle');
    var list = document.getElementById('navList');
    if (toggle && list) {
      toggle.addEventListener('click', function () { list.classList.toggle('open'); });
    }
  }

  function initTheme() {
    var btn = document.getElementById('toggleTheme');
    if (!btn) return;
    var saved = localStorage.getItem('nl_theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = (cur === 'dark') ? '' : 'dark';
      if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('nl_theme', next);
    });
  }

  function paintUser() {
    var s = store();
    var name = s.user && s.user.name ? s.user.name : '';
    var avatar = s.user && s.user.avatar ? s.user.avatar : '';
    var uname = document.getElementById('userName');
    var uavatar = document.getElementById('userAvatar');
    var loginBtn = document.getElementById('loginBtn');
    if (uname) uname.textContent = name ? name : '游客';
    if (uavatar) uavatar.textContent = name ? (avatar || name.charAt(0)) : '客';
    if (loginBtn) loginBtn.textContent = name ? '切换身份' : '登录 / 注册';
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHeader();
    renderFooter();
    initNavToggle();
    initTheme();
    paintUser();
    // 其它页面脚本可能在布局注入后依赖 DOM，派发事件
    window.dispatchEvent(new Event('nl-layout-ready'));
    // 若全局社区脚本已定义
    if (typeof window.NLCommunity !== 'undefined' && window.NLCommunity.initUser) {
      window.NLCommunity.initUser();
    }
  });

  // 供其它脚本读取用户信息
  window.NLgetUser = function () { return store().user || null; };
})();
