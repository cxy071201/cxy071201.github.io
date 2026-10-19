# ===== 江苏省奶龙中学 · 云端后端本地模拟器 =====
# 用 Python 内置 http.server + sqlite3 模拟 Cloudflare(Workers+D1+R2)，
# 让你在本机也能完整测试"发帖/评论/点赞/投稿全网共享"的云端逻辑。
#
# 用法：
#   1. 运行本脚本：  python mock_server.py          （默认监听 8787）
#   2. 打开另一处将 js/config.js 里 apiBase 临时改为：
#        window.NL_CONFIG = { apiBase: "http://127.0.0.1:8787", idKey: "nl_uid" }
#      然后刷新网站页面看效果（数据会存在本机 mock.db）。
#   3. 测试完记得把 apiBase 改回 ""（本地模式）。
#
#   （真实部署仍以 workers/ 下的 Cloudflare 代码为准，本文件仅用于本地验证。）

import json, os, re, sqlite3, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock.db")
T0 = int(time.time())

def now():
    return int(time.time())

def open_db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = open_db()
    c = con.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY, author_name TEXT, author_avatar TEXT,
      title TEXT, body TEXT, tag TEXT, anon INTEGER, likes INTEGER, created INTEGER);
    CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, post_id TEXT, author_name TEXT, text TEXT, created INTEGER);
    CREATE TABLE IF NOT EXISTS likes(post_id TEXT, user_id TEXT, PRIMARY KEY(post_id,user_id));
    CREATE TABLE IF NOT EXISTS gallery(id TEXT PRIMARY KEY, title TEXT, cat TEXT, author TEXT, img TEXT, likes INTEGER, created INTEGER);
    CREATE TABLE IF NOT EXISTS nailong(id TEXT PRIMARY KEY, title TEXT, author TEXT, img TEXT, likes INTEGER, created INTEGER);
    """)
    # 若为空，注入示例数据
    if c.execute("SELECT COUNT(*) n FROM posts").fetchone()[0] == 0:
        posts = [
            ("s1","奶龙","🐉","食堂阿姨的神之手","今天打饭，我说\"阿姨少打点饭，我在减肥。\"阿姨头也不抬：\"孩子，你去年也这么说。\"", "食堂",0,32,T0-5*3600),
            ("s2","匿名同学","🐼","数学课困到怀疑人生","数学课最后一节，我同桌眼皮打架，老师问思路，全班安静他就站起来……", "课堂",1,18,T0-12*3600),
        ]
        c.executemany("INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?)", posts)
        gallery = [
            ("g1","春 · 樱花大道","四季校园","春樱","images/scene-spring.svg",56),
            ("g2","夏 · 林荫操场","四季校园","夏日","images/scene-summer.svg",48),
            ("g8","图书馆 · 静读时光","场所","拾光","images/scene-library.svg",29),
        ]
        c.executemany("INSERT INTO gallery VALUES(?,?,?,?,?,?,?)", [g+(T0,) for g in gallery])
        nailong = [
            ("n1","奶龙 · 挥手","奶龙工作室","images/mascot-a.jpg",90),
            ("n2","奶龙 · 抱臂","奶龙工作室","images/mascot-b.jpg",77),
        ]
        c.executemany("INSERT INTO nailong VALUES(?,?,?,?,?,?)", [n+(T0,) for n in nailong])
    con.commit(); con.close()

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json; charset=utf-8")

    def do_OPTIONS(self):
        self.send_response(204); self._headers(); self.end_headers()

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code); self._headers(); self.send_header("Content-Length", str(len(body))); self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

    def do_GET(self):
        u = urlparse(self.path); p = u.path
        con = open_db()
        if p == "/api/posts":
            rows = con.execute("SELECT * FROM posts ORDER BY created DESC").fetchall()
            self._send(200, {"ok":True,"posts":[dict(r) for r in rows]})
        elif p == "/api/gallery":
            rows = con.execute("SELECT * FROM gallery ORDER BY likes DESC").fetchall()
            self._send(200, {"ok":True,"gallery":[dict(r) for r in rows]})
        elif p == "/api/nailong":
            rows = con.execute("SELECT * FROM nailong ORDER BY likes DESC").fetchall()
            self._send(200, {"ok":True,"nailong":[dict(r) for r in rows]})
        elif p == "/api/comments":
            q = parse_qs(u.query); pid = q.get("post_id",[None])[0]
            if pid:
                rows = con.execute("SELECT * FROM comments WHERE post_id=? ORDER BY created",(pid,)).fetchall()
            else:
                rows = con.execute("SELECT * FROM comments ORDER BY created").fetchall()
            self._send(200, {"ok":True,"comments":[dict(r) for r in rows]})
        elif p.startswith("/media/"):
            key = p[len("/media/"):]
            fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", key)
            if os.path.exists(fp):
                data = open(fp,"rb").read()
                self.send_response(200); self.send_header("Access-Control-Allow-Origin","*"); self.send_header("Content-Type","image/png"); self.send_header("Content-Length",str(len(data))); self.end_headers(); self.wfile.write(data)
            else:
                self._send(404, {"error":"not found"})
        else:
            self._send(404, {"error":"not found"})
        con.close()

    def do_POST(self):
        u = urlparse(self.path); p = u.path
        con = open_db()
        m = re.match(r"^/api/posts/([^/]+)/like$", p)
        if m:
            b = self._read_json(); uid = b.get("user_id","")
            row = con.execute("SELECT likes FROM posts WHERE id=?",(m.group(1),)).fetchone()
            if not row: self._send(404,{"error":"not found"}); con.close(); return
            if uid:
                lik = con.execute("SELECT 1 FROM likes WHERE post_id=? AND user_id=?",(m.group(1),uid)).fetchone()
                if lik:
                    con.execute("DELETE FROM likes WHERE post_id=? AND user_id=?",(m.group(1),uid))
                    con.execute("UPDATE posts SET likes=MAX(0,likes-1) WHERE id=?",(m.group(1),))
                else:
                    con.execute("INSERT INTO likes VALUES(?,?)",(m.group(1),uid))
                    con.execute("UPDATE posts SET likes=likes+1 WHERE id=?",(m.group(1),))
            con.commit()
            n = con.execute("SELECT likes FROM posts WHERE id=?",(m.group(1),)).fetchone()["likes"]
            self._send(200, {"ok":True,"likes":n})
        elif re.match(r"^/api/posts/([^/]+)/comments$", p):
            b = self._read_json(); pid = m2 = re.match(r"^/api/posts/([^/]+)/comments$", p).group(1)
            cid = "c"+str(time.time())
            con.execute("INSERT INTO comments VALUES(?,?,?,?,?)",(cid,pid,b.get("name","游客"),b.get("text",""),now()))
            con.commit(); self._send(201, {"ok":True,"id":cid})
        elif p == "/api/posts":
            b = self._read_json()
            if not b.get("title") or not b.get("body"): self._send(400,{"error":"title/body required"}); con.close(); return
            pid = "s"+str(time.time())[-7:]
            anon = 1 if b.get("anon") else 0
            name = "匿名同学" if anon else b.get("name","游客")
            av = b.get("avatar","🐉")
            con.execute("INSERT INTO posts VALUES(?,?,?,?,?,?,?,0,?)",(pid,name,av,b["title"],b["body"],b.get("tag","校园日常"),anon,now()))
            con.commit(); self._send(201, {"ok":True,"id":pid})
        elif p == "/api/upload":
            b = self._read_json()
            # 本地模拟：不真正存图，直接返回占位
            self._send(201, {"ok":True,"url":"images/mascot-a.jpg"})
        elif p == "/api/reports":
            b = self._read_json(); self._send(200, {"ok":True})
        else:
            self._send(404, {"error":"not found"})
        con.close()

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("MOCK_PORT", "8787"))
    print("模拟后端已启动: http://127.0.0.1:%d  (数据: %s)" % (port, DB))
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
