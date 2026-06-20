// Vercel 坚果云 WebDAV 代理
export default async function handler(req, res) {
  // ========== 1. 跨域配置（只允许你的GitHub Pages访问） ==========
  const MY_GITHUB_PAGE = "https://r3v1v41.github.io";
  res.setHeader('Access-Control-Allow-Origin', MY_GITHUB_PAGE);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Depth,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 处理预检请求（必须写，否则PUT/DELETE会跨域失败）
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ========== 2. 读取坚果云配置（从Vercel环境变量，绝不写死在代码里！） ==========
  const JIANGUYUN_USER = process.env.JG_USER;
  const JIANGUYUN_PWD = process.env.JG_PWD;
  const WEBDAV_BASE = "https://dav.jianguoyun.com/dav/";

  if (!JIANGUYUN_USER || !JIANGUYUN_PWD) {
    return res.status(500).json({ error: "未配置坚果云账号密码" });
  }

  // ========== 3. 拼接请求地址 ==========
  const filePath = req.query.file || "";
  const targetUrl = new URL(filePath, WEBDAV_BASE).href;

  // ========== 4. 坚果云鉴权（自动生成） ==========
  const auth = Buffer.from(`${JIANGUYUN_USER}:${JIANGUYUN_PWD}`).toString('base64');

  // ========== 5. 转发请求到坚果云 ==========
  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        "Authorization": `Basic ${auth}`,
        "Depth": "1",
        ...(req.method === "PUT" && { "Content-Type": "application/json" })
      },
      body: req.method === "PUT" ? JSON.stringify(req.body) : undefined
    };

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: "代理请求失败", detail: err.message });
  }
}