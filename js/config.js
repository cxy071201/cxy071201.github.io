/* ===== 江苏省奶龙中学 · 云端开关 =====
   当 apiBase 为空字符串时，网站用浏览器本地(localStorage)模式 —— 当前默认，开箱即用。
   当后端部署好、把下面 apiBase 改成云端地址后，网站会自动改用云端 API，
   实现所有访客的帖子/评论/点赞/投稿全网共享。

   示例：apiBase: "https://nailong-school.你的子域.workers.dev"
*/
window.NL_CONFIG = {
  apiBase: "",
  // 记住游客身份用的本地 key（点赞去重等）
  idKey: "nl_uid",
};
