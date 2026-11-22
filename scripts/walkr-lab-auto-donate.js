// Walkr lab auto donate
// Walkr 實驗室自動贊助：定期檢查實驗室成員的贊助需求，補滿自己本輪可贊助的次數
// 需先開啟一次 app 的實驗室畫面，讓 walkr-lab-capture.js 存下 token 與請求網址
// 注意：能量扣除與 coins 獎勵是 app 本機計算後同步，自動贊助不會反映到自己的帳號資源

const API_BASE = "https://production.sw.fourdesire.com/api/v2";
const REQUEST_INTERVAL_MS = 1500;
const DEVICE_PARAM_KEYS = ["client_version", "country_code", "device_model", "locale", "os_version", "platform", "timezone"];
const HANDLED_ROUNDS_KEY = "WalkrDonateHandledRounds";
const HANDLED_ROUNDS_LIMIT = 100;

function httpError(message, status) {
    let error = new Error(message);
    error.status = status;
    return error;
}

function notify(subtitle, body = "") {
    console.log(`🚀 ${subtitle}\n${body}`);
    $notification.post("🚀 Walkr Auto Donate", subtitle, body);
}

function request(method, url, body) {
    let options = {
        url: url,
        headers: {
            Authorization: $persistentStore.read("WalkrToken"),
            "User-Agent": $persistentStore.read("WalkrUserAgent") || "",
            Accept: "*/*",
            "Content-Type": "application/json",
        },
    };
    if (body != undefined) {
        options.body = JSON.stringify(body);
    }
    let methodName = method == "POST" ? "post" : "get";
    return new Promise((resolve, reject) => {
        $httpClient[methodName](options, (error, response, data) => {
            if (error) {
                reject(httpError(`連線失敗：${error}`));
            } else if (response.status == 401) {
                reject(httpError("token 已失效，請開啟一次 app 的實驗室畫面", 401));
            } else if (response.status != 200) {
                reject(httpError(`HTTP ${response.status}：${String(data).slice(0, 100)}`, response.status));
            } else {
                try {
                    resolve(JSON.parse(data));
                } catch (parseError) {
                    reject(httpError(`回應非 JSON：${String(data).slice(0, 100)}`));
                }
            }
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

function readDeviceParams(url) {
    let query = url.split("?")[1] || "";
    let params = {};
    query.split("&").forEach((pair) => {
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

// JWT 的 id 是 core 帳號 id，會出現在成員 avatar 路徑 /users/{id}/，以此對應出 Walkr 玩家 id
function readCoreId() {
    try {
        let payload = $persistentStore.read("WalkrToken").split(" ")[1].split(".")[1];
        return JSON.parse(decodeBase64Url(payload)).id;
    } catch (error) {
        throw new Error("token 格式無法解析，請開啟一次 app 的實驗室畫面");
    }
}

// 儲存格式 "coreId:playerId"，換帳號時不會誤用舊帳號的玩家 id
function findMyPlayerId(members) {
    let coreId = readCoreId();
    let me = members.find((m) => String(m.avatar || "").includes(`/users/${coreId}/`));
    if (me != undefined) {
        $persistentStore.write(`${coreId}:${me.id}`, "WalkrPlayerId");
        return me.id;
    }
    let [storedCoreId, storedPlayerId] = String($persistentStore.read("WalkrPlayerId") || "").split(":");
    return storedCoreId == String(coreId) && storedPlayerId ? Number(storedPlayerId) : undefined;
}

function roundKey(comment) {
    return `${comment.id}:${comment.comment.last_requested_at}`;
}

function readHandledRounds() {
    try {
        let rounds = JSON.parse($persistentStore.read(HANDLED_ROUNDS_KEY) || "[]");
        return Array.isArray(rounds) ? rounds : [];
    } catch (error) {
        return [];
    }
}

function saveHandledRounds(rounds) {
    $persistentStore.write(JSON.stringify(rounds.slice(-HANDLED_ROUNDS_LIMIT)), HANDLED_ROUNDS_KEY);
}

// donated_counter 格式："玩家id|500+500,玩家id|2000"
function donatedAmount(counter, playerId) {
    let entry = String(counter || "")
        .split(",")
        .find((item) => item.split("|")[0] == String(playerId));
    if (entry == undefined) {
        return 0;
    }
    return entry
        .split("|")[1]
        .split("+")
        .reduce((sum, value) => sum + (Number(value) || 0), 0);
}

// 回傳尚未達標、非自己發起的需求，amount 為本次可贊助量（<= 0 代表本輪已捐滿或已處理過）
// amount 取「自己本輪剩餘額度」與「對方剩餘需求（向上取整到 donation_value 倍數）」較小者
function buildDonations(comments, myPlayerId, handledRounds) {
    return comments
        .filter((c) => c.comment && c.comment.type == "donation" && c.user && c.user.id != myPlayerId)
        .filter((c) => c.comment.total_donation < c.comment.requirements)
        .map((c) => {
            let info = c.comment;
            if (handledRounds.includes(roundKey(c))) {
                return { comment: c, amount: 0 };
            }
            let myRemaining = info.max_donation_count * info.donation_value - donatedAmount(info.donated_counter, myPlayerId);
            let needed = Math.ceil((info.requirements - info.total_donation) / info.donation_value) * info.donation_value;
            return { comment: c, amount: Math.min(myRemaining, needed) };
        });
}

function buildSummary(results, skippedCount) {
    let succeeded = results.filter((r) => r.isSuccess);
    let failedCount = results.length - succeeded.length;
    let total = succeeded.reduce((sum, r) => sum + r.amount, 0);
    let subtitle = [`完成 ${succeeded.length} 人`, failedCount > 0 ? `失敗 ${failedCount} 人` : null, `共 ${total} 能量`]
        .filter((text) => text != null)
        .join("｜");
    let lines = results.map((r) => `${r.isSuccess ? "✅" : "❌"} ${r.name}｜${r.identifier}｜${r.isSuccess ? r.amount : r.error}`);
    if (skippedCount > 0) {
        lines.push(`略過 ${skippedCount} 筆（本輪已捐滿或已處理）`);
    }
    return { subtitle: subtitle, body: lines.join("\n") };
}

async function main() {
    let labCurrentUrl = $persistentStore.read("WalkrLabCurrentUrl");
    let labCommentsUrl = $persistentStore.read("WalkrLabCommentsUrl");
    if (!$persistentStore.read("WalkrToken") || !labCurrentUrl || !labCommentsUrl) {
        throw new Error("尚未擷取 token 或實驗室資訊，請開啟一次 app 的實驗室畫面");
    }

    let labData = await request("GET", labCurrentUrl);
    let myPlayerId = findMyPlayerId(labData.members || []);
    if (myPlayerId == undefined) {
        throw new Error("找不到自己的玩家 id，略過本次贊助");
    }

    let commentsData = await request("GET", labCommentsUrl);
    let handledRounds = readHandledRounds();
    let candidates = buildDonations(commentsData.comments || [], myPlayerId, handledRounds);
    let donations = candidates.filter((d) => d.amount > 0);
    if (donations.length == 0) {
        console.log("🚀 目前沒有需要贊助的成員");
        return;
    }

    let deviceParams = readDeviceParams(labCurrentUrl);
    let results = [];
    for (let { comment, amount } of donations) {
        let record = { name: comment.user.name, identifier: comment.comment.identifier, amount: amount };
        let body = {
            ...deviceParams,
            donation: amount,
            donation_type: comment.comment.donation_type,
            identifier: comment.comment.identifier,
            requirement_id: comment.id,
            timestamp: comment.comment.last_requested_at,
        };
        try {
            let result = await request("POST", `${API_BASE}/labs/${labData.lab.id}/donate`, body);
            results.push({ ...record, isSuccess: result.success === true, error: "回應 success=false" });
            handledRounds.push(roundKey(comment));
        } catch (error) {
            results.push({ ...record, isSuccess: false, error: error.message });
            // 4xx（401 除外）視為本輪無法贊助，不再重試；網路錯誤與 5xx 下次再試
            if (error.status >= 400 && error.status < 500 && error.status != 401) {
                handledRounds.push(roundKey(comment));
            }
        }
        await sleep(REQUEST_INTERVAL_MS);
    }
    saveHandledRounds(handledRounds);
    let summary = buildSummary(results, candidates.length - donations.length);
    notify(summary.subtitle, summary.body);
}

main()
    .catch((error) => notify(error.message))
    .finally(() => $done());
