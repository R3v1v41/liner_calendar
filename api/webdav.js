// api/webdav.js
export default async function handler(req, res) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, OPTIONS, PROPFIND, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Origin, x-target-url');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只接受 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 解析请求体
        var { method, url, headers, body } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'Missing url in request body' });
        }

        if (!headers || !headers.Authorization) {
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        console.log('🔄 转发请求:', method, url);

        // 构建转发请求
        var fetchOptions = {
            method: method || 'GET',
            headers: {
                'Authorization': headers.Authorization,
                'Content-Type': headers['Content-Type'] || 'application/json'
            }
        };

        if (body) {
            fetchOptions.body = body;
        }

        // 转发到坚果云
        var response = await fetch(url, fetchOptions);

        // 获取响应数据
        var responseData;
        var contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        console.log('📡 响应状态:', response.status);

        // 返回给前端
        res.status(200).json({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data: responseData
        });

    } catch (error) {
        console.error('❌ 代理错误:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message
        });
    }
}
