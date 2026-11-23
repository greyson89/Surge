// Walkr Config API - 管理介面的 persistentStore 讀寫
// 攔截 walkr.mysurge.com/api/read、/api/write，直接回應，不會連到外部
// 只允許 WalkrEpic 開頭的 key，避免頁面讀到 token
//   GET  /api/read?key=xxx               → { found, key, value }
//   POST /api/write  body: {key, value}  → { success, key, value }

const ALLOWED_KEY_PREFIX = "WalkrEpic";

function jsonResponse(status, data) {
    $done({
        response: {
            status: status,
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(data),
        },
    });
}

function isAllowedKey(key) {
    return typeof key == "string" && key.startsWith(ALLOWED_KEY_PREFIX);
}

function handleRead(url) {
    let match = url.match(/[?&]key=([^&]*)/);
    let key = match ? decodeURIComponent(match[1]) : "";
    if (!isAllowedKey(key)) {
        return jsonResponse(400, { found: false, key: key, value: "", message: "不允許的 key" });
    }
    let value = $persistentStore.read(key);
    jsonResponse(200, { found: value != null, key: key, value: value == null ? "" : value });
}

function handleWrite(body) {
    let { key, value } = JSON.parse(body || "{}");
    if (!isAllowedKey(key)) {
        return jsonResponse(400, { success: false, key: key || "", message: "不允許的 key" });
    }
    let isWritten = $persistentStore.write(String(value == null ? "" : value), key);
    jsonResponse(isWritten ? 200 : 500, { success: isWritten, key: key, value: value, message: isWritten ? "" : "寫入失敗" });
}

try {
    if ($request.url.includes("/api/read")) {
        handleRead($request.url);
    } else if ($request.url.includes("/api/write") && $request.method == "POST") {
        handleWrite($request.body);
    } else {
        jsonResponse(404, { message: "未知的 API 路徑" });
    }
} catch (error) {
    jsonResponse(500, { message: `伺服器錯誤：${error.message}` });
}
