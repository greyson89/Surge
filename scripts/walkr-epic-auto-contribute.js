// Walkr epic auto contribute
// Walkr 傳說自動繳納：讀取 fleets/current，判斷目前步驟，繳納資源或能量；第一段完成時接著繳納第二段能量
// 需先開啟一次 app，讓 walkr-lab-capture.js 存下 token 與 labs/current 網址（裝置參數與 fleets/current 相同）
//
// 執行方式（同一支腳本）：
//   cron（$argument 空白）：受「自動執行」開關控制
//   $argument=run：手動立即繳納，不受開關控制
//   $argument=test：依 WalkrEpicTest* 參數送出單次繳納，用來測試伺服器限制
//   http-request（管理介面）：/api/epic/run、/api/epic/status（只預覽不繳納）、/api/epic/test
//
// 參數（persistentStore，可由管理介面修改）：
//   WalkrEpicAutoEnabled   true/false，cron 是否執行，預設 true
//   WalkrEpicMode          standard（依耐力規則）/unlimited（0 格、一次繳滿剩餘量），預設 standard
//   WalkrEpicSharePercent  第一段每一項自己最多繳需求量的幾 %（1~100），預設 100；能量不受此限制
//   WalkrEpicTestItem      a/b/c/energy，空白為自動選擇目前步驟第一個未完成項目
//   WalkrEpicTestAmount    數量，空白為剩餘需求量
//   WalkrEpicTestHitpoints 請求中要使用的格數，預設 1

const API_BASE = "https://production.sw.fourdesire.com/api/v2";
const REQUEST_INTERVAL_MS = 2500;
const MAX_HITPOINTS = 3;
const ENERGY_TIERS = [
    { ratio: 1 / 4, cost: 2 },
    { ratio: 1 / 8, cost: 1 },
];
const STANDARD_EVENT_RATIO = 1 / 2;
const DEVICE_PARAM_KEYS = ["client_version", "country_code", "device_model", "locale", "os_version", "platform", "timezone"];
const ITEM_KEYS = ["a", "b", "c"];
const LAST_RESULT_KEY = "WalkrEpicLastResult";
const FLIGHT_INDENT = "　　";

function httpError(message, status) {
    let error = new Error(message);
    error.status = status;
    return error;
}

function notify(subtitle, body = "") {
    console.log(`🚀 ${subtitle}\n${body}`);
    $notification.post("🚀 Walkr Epic", subtitle, body);
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
                reject(httpError("token 已失效，請開啟一次 app", 401));
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

function formatNumber(value) {
    return Number(value).toLocaleString("en-US");
}

function readDeviceQuery(url) {
    return (url.split("?")[1] || "")
        .split("&")
        .filter((pair) => DEVICE_PARAM_KEYS.includes(pair.split("=")[0]))
        .join("&");
}

function readDeviceParams(query) {
    let params = {};
    query.split("&").forEach((pair) => {
        let [key, value] = pair.split("=");
        params[key] = decodeURIComponent(value || "");
    });
    if (params.timezone != undefined) {
        params.timezone = Number(params.timezone);
    }
    return params;
}

function readSettings() {
    let percent = Number($persistentStore.read("WalkrEpicSharePercent"));
    return {
        isAutoEnabled: $persistentStore.read("WalkrEpicAutoEnabled") != "false",
        isUnlimited: $persistentStore.read("WalkrEpicMode") == "unlimited",
        sharePercent: percent >= 1 && percent <= 100 ? percent : 100,
    };
}

function itemLabel(event, key) {
    let type = event.event_type;
    if (type == "currency" || type == "preparation") {
        return { a: "金幣", b: "食物", c: "資源 C" }[key];
    }
    if (type == "resources") {
        return `星球資源 ${key.toUpperCase()}`;
    }
    return event[`label_${key}`] || `物品 ${key.toUpperCase()}`;
}

// 將 fleets/current 整理成腳本需要的狀態；沒有參與傳說時回傳 null
function parseState(data) {
    if (!data || !data.fleet || !data.event) {
        return null;
    }
    let { fleet, event, path } = data;
    let hitpoints = data.hitpoints || {};
    // virtual-* 只需要繳物品數量 a，resource_b 不是需求（實測只繳 a 就完成）
    let keys = String(event.event_type).startsWith("virtual-") ? ["a"] : ITEM_KEYS;
    let items = keys.filter((key) => event[`resource_${key}`] != null).map((key) => ({
        key: key,
        label: itemLabel(event, key),
        required: Number(event[`resource_${key}`]),
        current: Number(fleet[`value_${key}`]) || 0,
        mine: Number(hitpoints[`value_${key}`]) || 0,
    }));
    return {
        fleetId: fleet.id,
        eventId: event.id,
        eventName: event.name,
        eventType: event.event_type,
        status: data.event_status,
        hitpoints: Number(hitpoints.hitpoints) || 0,
        nextHitpointCountdown: hitpoints.next_hitpoint_countdown,
        items: items,
        energy: {
            required: Number(path && path.required_energy) || 0,
            donated: (Number(fleet.energy) || 0) + (Number(fleet.consumed_energy) || 0),
            stored: Number(fleet.energy) || 0,
            consumed: Number(fleet.consumed_energy) || 0,
            hours: Number(path && path.time) || 0,
        },
    };
}

function shareRemaining(item, sharePercent) {
    let fleetRemaining = item.required - item.current;
    let myRemaining = Math.ceil((item.required * sharePercent) / 100) - item.mine;
    return Math.max(0, Math.min(fleetRemaining, myRemaining));
}

// 第一段：resources 不耗耐力，全部繳滿；其他類型標準模式每項用 3 格繳需求量的 1/2，無限模式 0 格繳滿
function planEventDonations(state, settings) {
    let hitpoints = state.hitpoints;
    let isFree = state.eventType == "resources" || settings.isUnlimited;
    let plans = [];
    for (let item of state.items) {
        let remaining = shareRemaining(item, settings.sharePercent);
        if (remaining <= 0) {
            continue;
        }
        if (isFree) {
            plans.push({ item: item, amount: remaining, cost: 0 });
            continue;
        }
        if (hitpoints < MAX_HITPOINTS) {
            break;
        }
        let amount = Math.min(remaining, Math.ceil(item.required * STANDARD_EVENT_RATIO));
        plans.push({ item: item, amount: amount, cost: MAX_HITPOINTS });
        hitpoints -= MAX_HITPOINTS;
    }
    return plans;
}

// 第二段：標準模式依 app 選項（1/4 用 2 格、1/8 用 1 格）用完剩餘耐力，無限模式 0 格一次繳滿
function planEnergyDonations(state, settings) {
    let remaining = state.energy.required - state.energy.donated;
    if (remaining <= 0) {
        return [];
    }
    if (settings.isUnlimited) {
        return [{ amount: remaining, cost: 0 }];
    }
    let [largeTier, smallTier] = ENERGY_TIERS;
    let smallAmount = Math.floor(state.energy.required * smallTier.ratio);
    let hitpoints = state.hitpoints;
    let plans = [];
    while (remaining > 0 && hitpoints >= smallTier.cost) {
        // 剩餘量用小選項就能繳完時不浪費 2 格
        let tier = hitpoints >= largeTier.cost && remaining > smallAmount ? largeTier : smallTier;
        let amount = Math.min(remaining, Math.floor(state.energy.required * tier.ratio));
        plans.push({ amount: amount, cost: tier.cost });
        remaining -= amount;
        hitpoints -= tier.cost;
    }
    return plans;
}

function eventBody(state, item, amount, cost) {
    let values = {};
    ITEM_KEYS.forEach((key) => (values[`value_${key}`] = key == item.key ? amount : 0));
    return { event_status: "event", event_id: state.eventId, event_type: state.eventType, hitpoints: cost, ...values };
}

function energyBody(state, amount, cost) {
    return { event_status: "path", event_id: state.eventId, event_type: "travelling", hitpoints: cost, energy: amount };
}

async function fetchState(context) {
    let data = await request("GET", `${API_BASE}/fleets/current?${context.query}`);
    if (data.success === false) {
        throw new Error(`讀取傳說失敗：${data.message || "success=false"}`);
    }
    return parseState(data);
}

async function donate(context, state, body) {
    let url = `${API_BASE}/fleets/${state.fleetId}/donate`;
    return request("POST", url, { ...context.deviceParams, ...body });
}

async function sendPlans(context, state, plans, buildBody, label) {
    let results = [];
    for (let plan of plans) {
        if (context.sentCount > 0) {
            await sleep(REQUEST_INTERVAL_MS);
        }
        context.sentCount += 1;
        let record = { label: label(plan), amount: plan.amount, cost: plan.cost };
        try {
            let response = await donate(context, state, buildBody(plan));
            let donated = response.donated_value ? response.donated_value[`value_${plan.item.key}`] : response.energy;
            results.push({ ...record, isSuccess: response.success === true, amount: donated != undefined ? donated : plan.amount, isStepDone: response.refresh === true, error: response.message || "success=false" });
        } catch (error) {
            results.push({ ...record, isSuccess: false, error: error.message });
        }
        if (!results[results.length - 1].isSuccess) {
            break;
        }
    }
    return results;
}

function describeWaiting(state, settings) {
    if (state.status != "event" && state.status != "path") {
        return `目前狀態：${state.status}`;
    }
    if (state.status == "path") {
        return state.energy.donated >= state.energy.required ? "能量已足夠，等待飛船抵達" : `耐力不足，剩 ${state.hitpoints} 格`;
    }
    let isAllFilled = state.items.every((item) => shareRemaining(item, settings.sharePercent) <= 0);
    if (isAllFilled) {
        return settings.sharePercent < 100 ? `已達個人上限 ${settings.sharePercent}%` : "資源已繳滿";
    }
    let countdown = state.nextHitpointCountdown ? `，${state.nextHitpointCountdown} 秒後回復 1 格` : "";
    return `耐力不足，剩 ${state.hitpoints} 格${countdown}`;
}

function progressLine(state) {
    if (state.status != "event" && state.status != "path") {
        return `${state.eventName}（${state.status}）`;
    }
    if (state.status == "path") {
        return `能量 ${formatNumber(Math.min(state.energy.donated, state.energy.required))}/${formatNumber(state.energy.required)}`;
    }
    return state.items.map((item) => `${item.label} ${formatNumber(item.current)}/${formatNumber(item.required)}`).join("｜");
}

async function contribute(context, settings, isDryRun) {
    let state = await fetchState(context);
    if (state == null) {
        return { subtitle: "目前沒有參與中的傳說", lines: [] };
    }
    let results = [];
    if (state.status == "event") {
        let plans = planEventDonations(state, settings);
        if (isDryRun) {
            return previewResult(state, plans.map((p) => `${p.item.label} ${formatNumber(p.amount)}（${p.cost} 格）`), settings);
        }
        results = await sendPlans(context, state, plans, (p) => eventBody(state, p.item, p.amount, p.cost), (p) => p.item.label);
        if (results.some((r) => r.isStepDone)) {
            await sleep(REQUEST_INTERVAL_MS);
            state = await fetchState(context);
        }
    }
    if (state != null && state.status == "path") {
        let plans = planEnergyDonations(state, settings);
        if (isDryRun) {
            return previewResult(state, plans.map((p) => `能量 ${formatNumber(p.amount)}（${p.cost} 格）`), settings);
        }
        let energyResults = await sendPlans(context, state, plans, (p) => energyBody(state, p.amount, p.cost), () => "能量");
        results = results.concat(energyResults);
        if (energyResults.some((r) => r.isSuccess)) {
            state = await fetchState(context);
        }
    }
    return buildSummary(state, results, settings);
}

function previewResult(state, planLines, settings) {
    let lines = planLines.length > 0 ? planLines.map((line) => `🔍 ${line}`) : [`⏸ ${describeWaiting(state, settings)}`];
    return { subtitle: `${state.eventName}｜預覽`, lines: lines.concat(progressLine(state), flightLines(state, Date.now())) };
}

function formatDuration(seconds) {
    let minutes = Math.ceil(seconds / 60);
    let hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours} 小時 ${minutes % 60} 分` : `${minutes} 分`;
}

function formatClock(ms) {
    let date = new Date(ms);
    let pad = (n) => String(n).padStart(2, "0");
    return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 飛行剩餘時間：fleets/current 讀取當下伺服器已結算燃燒量（last_consumed_at 等於讀取時間），
// 能量以 required_energy / time 小時的固定速度燃燒；能量不夠時飛船會在燒完時停住
// 回傳多行，第二行起以 FLIGHT_INDENT 縮排，避免時間在窄螢幕被拆開
function flightLines(state, nowMs) {
    let { required, stored, consumed, hours } = state.energy;
    if (required <= 0 || hours <= 0) {
        return [];
    }
    if (state.status == "event") {
        return [`🛸 第一段完成後需飛行 ${hours} 小時`, `${FLIGHT_INDENT}需要 ${formatNumber(required)} 能量`];
    }
    if (state.status != "path") {
        return [];
    }
    let ratePerSecond = required / (hours * 3600);
    let remainingBurn = required - consumed;
    if (stored >= remainingBurn) {
        let seconds = remainingBurn / ratePerSecond;
        return [`🛸 預計 ${formatDuration(seconds)}後抵達下一階段`, `${FLIGHT_INDENT}抵達時間：${formatClock(nowMs + seconds * 1000)}`];
    }
    let stallSeconds = stored / ratePerSecond;
    let fullSeconds = remainingBurn / ratePerSecond;
    if (stored <= 0) {
        return [`🛸 飛船已停住，還差 ${formatNumber(remainingBurn)} 能量`, `${FLIGHT_INDENT}補滿後約 ${formatDuration(fullSeconds)}抵達`];
    }
    return [
        `🛸 能量只夠再飛 ${formatDuration(stallSeconds)}`,
        `${FLIGHT_INDENT}還差 ${formatNumber(remainingBurn - stored)} 能量`,
        `${FLIGHT_INDENT}補滿後約 ${formatDuration(fullSeconds)}抵達`,
    ];
}

function buildSummary(state, results, settings) {
    if (state == null) {
        return { subtitle: "傳說已結束", lines: results.map(resultLine), hasDonation: results.length > 0 };
    }
    let succeeded = results.filter((r) => r.isSuccess).length;
    let failed = results.length - succeeded;
    let subtitle = results.length == 0 ? `${state.eventName}｜不需繳納` : `${state.eventName}｜完成 ${succeeded} 筆${failed > 0 ? `｜失敗 ${failed} 筆` : ""}`;
    let lines = results.map(resultLine);
    if (results.length == 0) {
        lines.push(`⏸ ${describeWaiting(state, settings)}`);
    }
    lines.push(progressLine(state));
    return { subtitle: subtitle, lines: lines, hasDonation: results.length > 0 };
}

function resultLine(r) {
    return r.isSuccess ? `✅ ${r.label} ${formatNumber(r.amount)}（${r.cost} 格）` : `❌ ${r.label} ${formatNumber(r.amount)}：${r.error}`;
}

// 單次測試：依參數送出一筆繳納，回傳送出的內容與伺服器原始回應
async function testDonate(context) {
    let state = await fetchState(context);
    if (state == null) {
        return { subtitle: "目前沒有參與中的傳說", lines: [] };
    }
    let itemKey = $persistentStore.read("WalkrEpicTestItem") || "";
    let amountText = $persistentStore.read("WalkrEpicTestAmount") || "";
    let costText = $persistentStore.read("WalkrEpicTestHitpoints");
    let cost = costText == null || costText === "" ? 1 : Number(costText);
    let isEnergy = itemKey == "energy" || (itemKey == "" && state.status == "path");
    let item = isEnergy ? null : state.items.find((i) => (itemKey ? i.key == itemKey : i.current < i.required));
    if (!isEnergy && item == undefined) {
        throw new Error(`找不到可測試的項目（${itemKey || "自動"}）`);
    }
    let remaining = isEnergy ? state.energy.required - state.energy.donated : item.required - item.current;
    let amount = amountText === "" ? remaining : Number(amountText);
    if (!Number.isFinite(amount) || !Number.isFinite(cost)) {
        throw new Error(`測試參數格式錯誤：數量「${amountText}」、格數「${costText}」`);
    }
    let body = isEnergy ? energyBody(state, amount, cost) : eventBody(state, item, amount, cost);
    let response = await donate(context, state, body);
    return {
        subtitle: `測試｜${isEnergy ? "能量" : item.label} ${formatNumber(amount)}（${cost} 格）｜${response.success === true ? "成功" : "失敗"}`,
        lines: [`步驟：${state.status}｜繳納前 ${progressLine(state)}｜剩 ${state.hitpoints} 格`, `送出：${JSON.stringify(body)}`, `回應：${JSON.stringify(response)}`],
        hasDonation: true,
    };
}

// 管理介面的請求需帶 X-Walkr-Admin header，避免其他網站用 GET 觸發繳納（CSRF）
function hasAdminHeader(headers) {
    return Object.keys(headers || {}).some((key) => key.toLowerCase() == "x-walkr-admin" && headers[key] == "1");
}

function readRoute() {
    if (typeof $request != "undefined") {
        if (!hasAdminHeader($request.headers)) {
            return "forbidden";
        }
        let match = $request.url.match(/\/api\/epic\/(run|status|test)/);
        return match ? match[1] : "unknown";
    }
    return typeof $argument == "string" && $argument ? $argument : "cron";
}

function buildContext() {
    let labCurrentUrl = $persistentStore.read("WalkrLabCurrentUrl");
    if (!$persistentStore.read("WalkrToken") || !labCurrentUrl) {
        throw new Error("尚未擷取 token，請開啟一次 app");
    }
    let query = readDeviceQuery(labCurrentUrl);
    return { query: query, deviceParams: readDeviceParams(query), sentCount: 0 };
}

async function runRoute(route) {
    let settings = readSettings();
    if (route == "forbidden") {
        throw new Error("請從管理介面操作");
    }
    if (route == "cron" && !settings.isAutoEnabled) {
        return { subtitle: "自動執行已關閉", lines: [], isSkipped: true };
    }
    let context = buildContext();
    if (route == "test") {
        return testDonate(context);
    }
    if (route == "run" || route == "cron" || route == "status") {
        return contribute(context, settings, route == "status");
    }
    throw new Error(`未知的執行方式：${route}`);
}

function finish(route, summary, isError) {
    let record = { time: Date.now(), route: route, isError: isError, subtitle: summary.subtitle, lines: summary.lines };
    if (route != "status" && !summary.isSkipped) {
        $persistentStore.write(JSON.stringify(record), LAST_RESULT_KEY);
    }
    // cron 沒有繳納時只記 log，避免每 10 分鐘通知一次
    if (isError || summary.hasDonation || (route != "cron" && route != "status")) {
        notify(summary.subtitle, summary.lines.join("\n"));
    } else {
        console.log(`🚀 ${summary.subtitle}\n${summary.lines.join("\n")}`);
    }
    if (typeof $request != "undefined") {
        $done({ response: { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(record) } });
    } else {
        $done();
    }
}

let route = readRoute();
runRoute(route)
    .then((summary) => finish(route, summary, false))
    .catch((error) => finish(route, { subtitle: error.message, lines: [] }, true));
