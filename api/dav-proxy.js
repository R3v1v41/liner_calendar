export default async function handler(req, res) {
  // 填入你的GitHub Pages域名，固定不用改其他
  const MY_GITHUB_PAGE = "https://r3v1v41.github.io";
  res.setHeader('Access-Control-Allow-Origin', MY_GITHUB_PAGE);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Depth,Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 处理跨域预检请求
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 从Vercel环境变量读取坚果云凭证，前端不会暴露账号密码
  const JIANGUYUN_USER = process.env.JG_USER;
  const JIANGUYUN_PWD = process.env.JG_PWD;
  const WEBDAV_BASE = "https://dav.jianguoyun.com/dav/";

  if (!JIANGUYUN_USER || !JIANGUYUN_PWD) {
    return res.status(500).json({ error: "Vercel未配置坚果云账号与应用密码" });
  }

  const filePath = req.query.file || "";
  const targetUrl = new URL(filePath, WEBDAV_BASE).href;
  // 后端生成鉴权串
  const authCode = Buffer.from(`${JIANGUYUN_USER}:${JIANGUYUN_PWD}`).toString('base64');

  try {
    const fetchParams = {
      method: req.method,
      headers: {
        "Authorization": `Basic ${authCode}`,
        "Depth": "1",
        ...(req.method === "PUT" && { "Content-Type": "application/json" })
      },
      body: req.method === "PUT" ? JSON.stringify(req.body) : undefined
    };
    const davResponse = await fetch(targetUrl, fetchParams);
    const resText = await davResponse.text();
    res.status(davResponse.status).send(resText);
  } catch (err) {
    res.status(500).json({ error: "代理转发坚果云请求失败", detail: err.message });
  }
}
