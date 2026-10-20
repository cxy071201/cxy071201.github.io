/* ===== 江苏省奶龙中学 · 云端开关 =====
   使用 Supabase 免费云数据库实现"发帖/评论/点赞/投稿全网共享"。
   supabaseUrl 和 supabaseKey 来自 Supabase 后台：
     Project Settings -> API Keys -> Project URL 和 Publishable key
   若你暂时不想用云端，把 supabaseUrl 置空字符串即可切回本地(localStorage)模式。
*/
window.NL_CONFIG = {
  supabaseUrl: "https://obmwzmiyimwknlalvviv.supabase.co",
  supabaseKey: "sb_publishable_O2VLKDkbvmGCh0uQST4_Tw_7xZRy_xF",
  // 记住游客身份用的本地 key（点赞去重等）
  idKey: "nl_uid",
};
