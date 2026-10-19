/* ===== 江苏省奶龙中学 交互脚本 ===== */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- 移动端导航切换 ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.nav ul');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      menu.classList.toggle('open');
    });
    // 点击菜单项后收起
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('open');
      }
    });
  }

  /* ---------- 高亮当前页面对应导航项 ---------- */
  var path = window.location.pathname.split('/').pop() || 'index.html';
  var links = document.querySelectorAll('.nav ul a');
  links.forEach(function (link) {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });

  /* ---------- 统计数字滚动动画 ---------- */
  function animateNum(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (String(el.getAttribute('data-target')).split('.')[1] || '').length;
    var duration = 1400;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = target * eased;
      el.textContent = (decimals ? val.toFixed(decimals) : Math.round(val)) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = (decimals ? target.toFixed(decimals) : target) + suffix;
      }
    }
    requestAnimationFrame(tick);
  }

  var nums = document.querySelectorAll('.stat-item .num');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateNum(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { io.observe(el); });
  } else {
    nums.forEach(function (el) { animateNum(el); });
  }
});

/* ---------- 联系表单处理 ---------- */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.btn');
      var alertBox = document.getElementById('formAlert');

      var name = form.querySelector('#name').value.trim();
      var phone = form.querySelector('#phone').value.trim();
      var message = form.querySelector('#message').value.trim();

      if (!name || !phone || !message) {
        showAlert(alertBox, '请填写完整的信息（姓名、电话、留言内容）。', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '提交中...';

      // 模拟提交过程
      setTimeout(function () {
        showAlert(alertBox, '提交成功！我们已收到您的留言，招生办将尽快与您联系。', 'success');
        btn.disabled = false;
        btn.textContent = '提交咨询';
        form.reset();
      }, 1200);
    });
  }
});

function showAlert(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'alert show ' + type;
}