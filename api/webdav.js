// api/webdav.js
// Vercel Serverless 函数 - 坚果云 WebDAV 代理
// 修复版 v2：从 JSON body 读取 targetUrl 和 auth，正确的作用域

export default async function handler(req, res) {
    // 1. CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, OPTIONS, PROPFIND, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url, x-device-id, Depth, If-Match, If-None-Match');

    // 预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 从 JSON body 中解析参数
    //    所有变量在 try 外部声明，确保后续代码可访问
    let targetUrl, method, auth, requestBody;
    let ifMatch, ifNoneMatch, depth;

    try {
        const payload = req.body || {};
        targetUrl = payload.url;
        method = payload.method || 'GET';
        requestBody = payload.body || null;

        // 客户端 headers（Authorization, If-Match 等）
        const clientHeaders = payload.headers || {};
        auth = clientHeaders['Authorization'] || clientHeaders['authorization'] || '';

        // 保存条件请求头，稍后转发到坚果云
        ifMatch = clientHeaders['If-Match'] || null;
        ifNoneMatch = clientHeaders['If-None-Match'] || null;
        depth = clientHeaders['Depth'] || null;
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
        const fetchHeaders = {
            'Authorization': auth
        };

        // 转发客户端附加的 HTTP 头
        if (ifMatch) fetchHeaders['If-Match'] = ifMatch;
        if (ifNoneMatch) fetchHeaders['If-None-Match'] = ifNoneMatch;
        if (depth) fetchHeaders['Depth'] = depth;

        // 有 body 时设置 Content-Type
        if (requestBody) {
            fetchHeaders['Content-Type'] = 'application/json';
        }

        const fetchOptions = {
            method: method,
            headers: fetchHeaders
        };

        if (requestBody && method !== 'GET' && method !== 'HEAD') {
            fetchOptions.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
        }

        console.log('🔄 [代理] ' + method + ' ' + targetUrl);

        const response = await fetch(targetUrl, fetchOptions);

        // 4. 获取响应（★ 坚果云可能不返回 application/json，需要智能解析）
        let responseData;
        const rawText = await response.text();

        // 尝试解析为JSON（无论Content-Type如何）
        try {
            responseData = JSON.parse(rawText);
        } catch (e) {
            // 不是JSON，保留原始文本
            responseData = rawText;
        }

        console.log('✅ [代理] 响应: ' + response.status + ' ' + response.statusText);

        // 5. 返回给客户端（包含 ETag 等关键响应头）
        const responseHeaders = {};
        try {
            // 提取关键响应头
            const etag = response.headers.get('etag') || response.headers.get('ETag');
            if (etag) responseHeaders['etag'] = etag;
        } catch (e) {
            // headers 迭代可能失败，忽略
        }

        res.status(200).json({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: responseData,
            headers: responseHeaders
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
