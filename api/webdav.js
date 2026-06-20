// api/webdav.js
// Vercel Serverless 函数 - 坚果云 WebDAV 代理
// 修复版：从 JSON body 读取 targetUrl 和 auth

export default async function handler(req, res) {
    // 1. CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, OPTIONS, PROPFIND, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url, x-device-id, Depth');

    // 预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 从 JSON body 中解析参数（客户端将 targetUrl 和 auth 放在 body 里）
    let targetUrl, method, auth, requestBody;

    try {
        const payload = req.body || {};
        targetUrl = payload.url;
        method = payload.method || 'GET';
        requestBody = payload.body || null;

        // auth 在 payload.headers.Authorization 或 payload.headers.authorization 中
        const clientHeaders = payload.headers || {};
        auth = clientHeaders['Authorization'] || clientHeaders['authorization'] || '';
    } catch (e) {
        console.error('❌ 解析请求体失败:', e);
        return res.status(400).json({ error: 'Invalid request body', message: e.message });
    }

    if (!targetUrl) {
        console.error('❌ 缺少 targetUrl');
        return res.status(400).json({ error: 'Missing url in request body' });
    }

    if (!auth) {
        console.error('❌ 缺少认证信息');
        return res.status(401).json({ error: 'Missing authorization in request body headers' });
    }

    // 3. 构建转发到坚果云的请求
    try {
        const clientHeaders = payload.headers || {};
        const fetchHeaders = {
            'Authorization': auth
        };

        // 转发客户端附加的 HTTP 头（ETag锁、条件请求等）
        if (clientHeaders['If-Match']) fetchHeaders['If-Match'] = clientHeaders['If-Match'];
        if (clientHeaders['If-None-Match']) fetchHeaders['If-None-Match'] = clientHeaders['If-None-Match'];
        if (clientHeaders['Depth']) fetchHeaders['Depth'] = clientHeaders['Depth'];

        // 对于有 body 的请求，设置 Content-Type
        if (requestBody) {
            fetchHeaders['Content-Type'] = clientHeaders['Content-Type'] || 'application/json';
        }

        const fetchOptions = {
            method: method,
            headers: fetchHeaders
        };

        if (requestBody && method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
        }

        console.log(`🔄 [代理] ${method} ${targetUrl}`);

        const response = await fetch(targetUrl, fetchOptions);

        // 4. 获取响应
        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                responseData = await response.json();
            } catch (e) {
                responseData = await response.text();
            }
        } else {
            responseData = await response.text();
        }

        console.log(`✅ [代理] 响应: ${response.status} ${response.statusText}`);

        // 5. 返回给客户端
        res.status(200).json({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: responseData,
            headers: Object.fromEntries(response.headers.entries())
        });

    } catch (error) {
        console.error('❌ [代理] 转发失败:', error.message);
        res.status(502).json({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            error: 'Proxy error',
            message: error.message
        });
    }
}
