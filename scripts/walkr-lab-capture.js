// Walkr capture token and lab request info
// Walkr 擷取 token 與實驗室請求資訊，供自動贊助腳本使用
// 觸發：開啟實驗室時 app 送出的 GET /api/v2/labs/current 與 GET /api/v2/comments?commentable_type=lab
// 只在值有變動時寫入 $persistentStore，不修改請求

const STORE_KEYS = {
    token: "WalkrToken",
    userAgent: "WalkrUserAgent",
    labCurrentUrl: "WalkrLabCurrentUrl",
    labCommentsUrl: "WalkrLabCommentsUrl",
};

function writeIfChanged(key, value) {
    if (value == undefined || value == "" || $persistentStore.read(key) == value) {
        return false;
    }
    $persistentStore.write(value, key);
    return true;
}

function findHeader(headers, name) {
    let key = Object.keys(headers).find((k) => k.toLowerCase() == name);
    return key == undefined ? undefined : headers[key];
}

let url = $request.url;
let headers = $request.headers || {};
let changed = [];

if (writeIfChanged(STORE_KEYS.token, findHeader(headers, "authorization"))) {
    changed.push("token");
}
writeIfChanged(STORE_KEYS.userAgent, findHeader(headers, "user-agent"));

if (url.includes("/api/v2/labs/current")) {
    writeIfChanged(STORE_KEYS.labCurrentUrl, url);
} else if (url.includes("commentable_type=lab")) {
    writeIfChanged(STORE_KEYS.labCommentsUrl, url);
}

if (changed.length > 0) {
    console.log(`🚀 Walkr 已更新 ${changed.join(", ")}`);
}

$done({});
