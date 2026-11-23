// Walkr Config API - 管理介面的 persistentStore 讀寫
// 攔截 walkr.mysurge.com/api/*，直接回應，不會連到外部
// 只允許白名單內的 key；token 不會原樣回傳，只回傳是否存在與到期時間
// write、reset 需帶 X-Walkr-Admin header：其他網站跨域送出自訂 header 會觸發 preflight 而被擋，避免 CSRF
//   GET  /api/read?key=xxx               → { found, key, value }（WRITABLE_KEYS、READONLY_KEYS）
//   POST /api/write  body: {key, value}  → { success, key, value }（WRITABLE_KEYS）
//   POST /api/reset  body: {key}         → { success, key }（RESETTABLE_KEYS）
//   GET  /api/status                     → 擷取狀態摘要（系統、實驗室、共駕步數分頁使用）

const WRITABLE_KEYS = [
    "WalkrEpicAutoEnabled",
    "WalkrEpicVoteEnabled",
    "WalkrEpicMode",
    "WalkrEpicSharePercent",
    "WalkrEpicTestItem",
    "WalkrEpicTestAmount",
    "WalkrEpicTestHitpoints",
    "WalkrEpicRewardType",
    "WalkrEpicRewardMoney",
    "WalkrEpicRewardCubes",
    "WalkrCovertBaseEnergy",
    "WalkrEnergyPerStep",
    "WalkrBridgeDisplayEnergy",
    "WalkrBridgeClaimEnergy",
    "WalkrIsExecuteMoneyModify",
    "WalkrMoney",
    "WalkrIsExecuteCubeModify",
    "WalkrCube",
    "WalkrLabAutoEnabled",
];
const READONLY_KEYS = ["WalkrEpicLastResult"];
const RESETTABLE_KEYS = ["WalkrDonateHandledRounds"];
const ADMIN_HEADER = "x-walkr-admin";

function jsonResponse(status, data) {
    $done({
        response: {
            status: status,
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(data),
        },
    });
}

function decodeBase64Url(input) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let text = input.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    let bytes = [];
    let buffer = 0;
    let bits = 0;
    for (let ch of text) {
        buffer = (buffer << 6) | chars.indexOf(ch);
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }
    return decodeURIComponent(bytes.map((b) => "%" + b.toString(16).padStart(2, "0")).join(""));
}

function parseJson(text, fallback) {
    try {
        return text ? JSON.parse(text) : fallback;
    } catch (error) {
        return fallback;
    }
}

function tokenSummary() {
    let token = $persistentStore.read("WalkrToken");
    if (!token) {
        return { found: false };
    }
    try {
        let payload = JSON.parse(decodeBase64Url(String(token).split(" ").pop().split(".")[1] || ""));
        return { found: true, coreId: payload.id || null, expiresAt: payload.exp ? payload.exp * 1000 : null };
    } catch (error) {
        return { found: true, isInvalid: true };
    }
}

function hasAdminHeader(headers) {
    return Object.keys(headers || {}).some((key) => key.toLowerCase() == ADMIN_HEADER && headers[key] == "1");
}

function handleStatus() {
    let rounds = parseJson($persistentStore.read("WalkrDonateHandledRounds"), []);
    jsonResponse(200, {
        token: tokenSummary(),
        userAgent: $persistentStore.read("WalkrUserAgent") || "",
        labCurrentUrl: $persistentStore.read("WalkrLabCurrentUrl") || "",
        labCommentsUrl: $persistentStore.read("WalkrLabCommentsUrl") || "",
        playerId: $persistentStore.read("WalkrPlayerId") || "",
        handledRoundsCount: Array.isArray(rounds) ? rounds.length : 0,
        pedometer: parseJson($persistentStore.read("WalkrPedometerState"), null),
    });
}

function handleRead(url) {
    let match = url.match(/[?&]key=([^&]*)/);
    let key = match ? decodeURIComponent(match[1]) : "";
    if (!WRITABLE_KEYS.includes(key) && !READONLY_KEYS.includes(key)) {
        return jsonResponse(400, { found: false, key: key, value: "", message: "不允許的 key" });
    }
    let value = $persistentStore.read(key);
    jsonResponse(200, { found: value != null, key: key, value: value == null ? "" : value });
}

function handleWrite(body) {
    let { key, value } = parseJson(body, {});
    if (!WRITABLE_KEYS.includes(key)) {
        return jsonResponse(400, { success: false, key: key || "", message: "不允許的 key" });
    }
    let isWritten = $persistentStore.write(String(value == null ? "" : value), key);
    jsonResponse(isWritten ? 200 : 500, { success: isWritten, key: key, value: value, message: isWritten ? "" : "寫入失敗" });
}

function handleReset(body) {
    let { key } = parseJson(body, {});
    if (!RESETTABLE_KEYS.includes(key)) {
        return jsonResponse(400, { success: false, key: key || "", message: "不允許的 key" });
    }
    let isWritten = $persistentStore.write("", key);
    jsonResponse(isWritten ? 200 : 500, { success: isWritten, key: key, message: isWritten ? "" : "清除失敗" });
}

try {
    let url = $request.url;
    let isPost = $request.method == "POST";
    let isMutation = url.includes("/api/write") || url.includes("/api/reset");
    if (isMutation && !hasAdminHeader($request.headers)) {
        jsonResponse(403, { success: false, message: "請從管理介面操作" });
    } else if (url.includes("/api/read")) {
        handleRead(url);
    } else if (url.includes("/api/status")) {
        handleStatus();
    } else if (url.includes("/api/write") && isPost) {
        handleWrite($request.body);
    } else if (url.includes("/api/reset") && isPost) {
        handleReset($request.body);
    } else {
        jsonResponse(404, { message: "未知的 API 路徑" });
    }
} catch (error) {
    jsonResponse(500, { message: `伺服器錯誤：${error.message}` });
}
