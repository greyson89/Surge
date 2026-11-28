// Walkr pilot convert - 手動送出能量給共駕
// 由管理介面（https://walkr.mysurge.com/#pilot）呼叫 /api/pilot/convert?energy=N，直接送出 POST pilots/convert
// body 與 app 相同：裝置參數 + converted_energy（2026-11-14 HAR）；伺服器成功時回 {"success":true}
// 與步數腳本分開：不讀取也不修改 WalkrPedometerState.pendingEnergy
// 需先開啟一次 app，讓 walkr-lab-capture.js 存下 token 與 labs/current 網址（取裝置參數）

const API_BASE = "https://production.sw.fourdesire.com/api/v2";
const DEVICE_PARAM_KEYS = ["client_version", "country_code", "device_model", "locale", "os_version", "platform", "timezone"];
// 伺服器上限未知（使用者實測中），只擋掉非整數與超過 32 位元整數的值
const MAX_ENERGY = 2147483647;
// 告訴 walkr-covert-energy.js 這筆是手動送出，不要修改（若 $httpClient 的請求也經過模組規則）
const MANUAL_MARK_KEY = "WalkrPilotManualConvert";

function hasAdminHeader(headers) {
    return Object.keys(headers || {}).some((key) => key.toLowerCase() == "x-walkr-admin" && headers[key] == "1");
}

function readEnergy(url) {
    let match = url.match(/[?&]energy=([^&]*)/);
    let text = match ? decodeURIComponent(match[1]).trim() : "";
    if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > MAX_ENERGY) {
        throw new Error(`能量需為 1 ~ ${MAX_ENERGY.toLocaleString("en-US")} 的整數`);
    }
    return Number(text);
}

function readDeviceParams() {
    let labCurrentUrl = $persistentStore.read("WalkrLabCurrentUrl");
    if (!$persistentStore.read("WalkrToken") || !labCurrentUrl) {
        throw new Error("尚未擷取 token，請開啟一次 app");
    }
    let params = {};
    (labCurrentUrl.split("?")[1] || "").split("&").forEach((pair) => {
        let [key, value] = pair.split("=");
        if (DEVICE_PARAM_KEYS.includes(key)) {
            params[key] = decodeURIComponent(value || "");
        }
    });
    if (params.timezone != undefined) {
        params.timezone = Number(params.timezone);
    }
    return params;
}

// 不論 HTTP 狀態都回傳原始內容，讓使用者看到伺服器怎麼回應
function post(url, body) {
    let options = {
        url: url,
        headers: {
            Authorization: $persistentStore.read("WalkrToken"),
            "User-Agent": $persistentStore.read("WalkrUserAgent") || "",
            Accept: "*/*",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    };
    return new Promise((resolve, reject) => {
        $httpClient.post(options, (error, response, data) => {
            if (error) {
                reject(new Error(`連線失敗：${error}`));
            } else {
                resolve({ status: response.status, data: String(data == undefined ? "" : data) });
            }
        });
    });
}

function isServerSuccess(result) {
    if (result.status != 200) {
        return false;
    }
    try {
        return JSON.parse(result.data).success === true;
    } catch (e) {
        return false;
    }
}

async function convert(energy) {
    let body = Object.assign(readDeviceParams(), { converted_energy: energy });
    $persistentStore.write(JSON.stringify({ energy: energy, time: Date.now() }), MANUAL_MARK_KEY);
    let result;
    try {
        result = await post(`${API_BASE}/pilots/convert`, body);
    } finally {
        $persistentStore.write("", MANUAL_MARK_KEY);
    }
    let isSuccess = isServerSuccess(result);
    let amount = energy.toLocaleString("en-US");
    return {
        isError: !isSuccess,
        subtitle: isSuccess ? `✅ 已送出 ${amount} 能量` : `❌ 送出 ${amount} 能量失敗`,
        lines: [`HTTP ${result.status}`],
        raw: result.data,
    };
}

function finish(summary) {
    let record = Object.assign({ time: Date.now() }, summary);
    let body = [record.subtitle].concat(record.lines || []).concat(record.raw ? [record.raw.slice(0, 200)] : []).join("\n");
    console.log(`🚀 ${body}`);
    $notification.post("🚀 Walkr Pilot", record.subtitle, body.split("\n").slice(1).join("\n"));
    $done({ response: { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(record) } });
}

Promise.resolve()
    .then(() => {
        if (!hasAdminHeader($request.headers)) {
            throw new Error("請從管理介面操作");
        }
        return convert(readEnergy($request.url));
    })
    .then(finish)
    .catch((error) => finish({ isError: true, subtitle: error.message, lines: [] }));
