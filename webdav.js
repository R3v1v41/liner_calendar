// api/webdav.js
// Vercel Serverless 函数 - 坚果云 WebDAV 代理

export default async function handler(req, res) {
    // 1. 设置 CORS 响应头（让浏览器信任 Vercel 的响应）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, OPTIONS, PROPFIND');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Origin');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 从请求中获取坚果云地址和认证信息
    const { url, method, headers, body } = req;
    
    // 客户端在请求头中传递目标 URL 和认证信息
    const targetUrl = req.headers['x-target-url'];
    const auth = req.headers['authorization'];

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing x-target-url header' });
    }

    if (!auth) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    try {
        // 3. 构建转发请求
        const fetchOptions = {
            method: method || 'GET',
            headers: {
                'Authorization': auth,
                'Content-Type': req.headers['content-type'] || 'application/json',
                'Depth': req.headers['depth'] || '0'
            }
        };

        // 如果有请求体，添加
        if (body && method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = body;
        }

        // 4. 转发请求到坚果云
        console.log(`🔄 代理请求: ${method} ${targetUrl}`);
        
        const response = await fetch(targetUrl, fetchOptions);

        // 5. 获取响应数据
        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // 6. 返回响应给客户端
        res.status(response.status).json({
            status: response.status,
            statusText: response.statusText,
            data: responseData,
            headers: Object.fromEntries(response.headers)
        });

    } catch (error) {
        console.error('❌ 代理错误:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message
        });
    }
}