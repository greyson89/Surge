// Walkr epic auto contribute
// Walkr 傳說自動繳納：讀取 fleets/current，判斷目前步驟，繳納資源或能量；第一段完成時接著繳納第二段能量
// 需先開啟一次 app，讓 walkr-lab-capture.js 存下 token 與 labs/current 網址（裝置參數與 fleets/current 相同）
//
// 執行方式（同一支腳本）：
//   cron（$argument 空白）：受「自動執行」開關控制
//   $argument=run：手動立即繳納，不受開關控制
//   $argument=test：依 WalkrEpicTest* 參數送出單次繳納，用來測試伺服器限制
//   http-request（管理介面）：/api/epic/run、/api/epic/status（只預覽不繳納）、/api/epic/test、/api/epic/raw（fleets/current 原始回應）
//
// 參數（persistentStore，可由管理介面修改）：
//   WalkrEpicAutoEnabled   true/false，cron 是否執行，預設 true
//   WalkrEpicVoteEnabled   true/false，選擇題是否自動投票，預設 true；關閉時只通知一次題目與選項
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
// 3 格繳 1/2 不被接受時伺服器回的訊息（只有金幣、食物為 0 的 currency 關卡，2026-11-25/26 實測）
const RULE_REJECTED_MESSAGE = "Unknown";
const DEVICE_PARAM_KEYS = ["client_version", "country_code", "device_model", "locale", "os_version", "platform", "timezone"];
const ITEM_KEYS = ["a", "b", "c"];
const LAST_RESULT_KEY = "WalkrEpicLastResult";
const FLIGHT_INDENT = "　　";

// 選擇題（event_type = voting）要投的路線，依傳說 id（fleet.epic.id）分組
// 題目與選項整理自截圖（docs/walkr-epic-routes.md，含各路線的資源比較），可能與遊戲文字略有不同，所以比對時：
//   question 與 event.name 或 event.description 相同，或 a、b 分別與 label_a、label_b 相同，就算同一題
//   「相同」是忽略空白與標點後，其中一方包含另一方（例如「救他」與「救救他」）
// answer："a" 或 "b"，要投的路線（對應截圖的 A. / B.）；空字串表示不投票，只通知一次
const VOTING_CHOICES = {
    // 來自故鄉的思念
    5: [{ question: "憤怒的史萊姆", a: "反擊", b: "賄賂", answer: "b" }],
    // 被綁架的工程師
    6: [{ question: "兩條線索", a: "先檢查看看", b: "勇往直前", answer: "a" }],
    // 中國殭屍與西洋殭屍
    10: [{ question: "打造太空船", a: "大龍船", b: "飛行木鳥", answer: "b" }],
    // 征討熔岩山脈的憤怒巨龍王
    12: [
        { question: "要如何採取行動", a: "攻打", b: "救他", answer: "a" },
        { question: "兩條線索", a: "陸路出發", b: "水路出發", answer: "b" },
    ],
    // DFR 工廠之旅
    14: [{ question: "收到訊息", a: "女王的密函", b: "博士的來信", answer: "b" }],
    // 小酒館的對決
    15: [{ question: "路上遭遇到賊搶劫", a: "抵抗", b: "賄賂", answer: "b" }],
    // 解放被封印的年獸
    17: [
        { question: "探索被封印的謎之怪物", a: "北風森林", b: "南海海域", answer: "a" },
        { question: "巫師谷的入口", a: "左邊大門", b: "右邊大門", answer: "a" },
    ],
    // 來自月球的神祕信號
    19: [
        { question: "岔路難題", a: "七彩水晶宇宙道路", b: "黑曜石宇宙道路", answer: "b" },
        { question: "靠食物還是靠武力", a: "做草藥蛋糕", b: "戳破泡泡路障", answer: "a" },
    ],
};
const VOTING_KEYS = ["a", "b"];
const VOTED_EVENTS_KEY = "WalkrEpicVotedEvents";
const MAX_VOTED_RECORDS = 50;
// 選擇題投票時間：截止時間 = fleet.started_at（事件開始時間）+ 24 小時（2026-11-24 截圖倒數推得）
const VOTING_HOURS = 24;
// 只讀取、不寫入上次結果也不通知的執行方式
const READ_ONLY_ROUTES = ["status", "raw"];

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
        isVoteEnabled: $persistentStore.read("WalkrEpicVoteEnabled") != "false",
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
    let isVoting = event.event_type == "voting";
    let keys = isVoting ? [] : String(event.event_type).startsWith("virtual-") ? ["a"] : ITEM_KEYS;
    // 選擇題的選項文字在 label_a/b/c；fleet.value_* 是各選項票數、hitpoints.value_* 是自己投的選項（2026-11-24 HAR 確認）
    let options = !isVoting ? [] : ITEM_KEYS.filter((key) => event[`label_${key}`]).map((key) => ({
        key: key,
        label: String(event[`label_${key}`]),
        votes: Number(fleet[`value_${key}`]) || 0,
        mine: Number(hitpoints[`value_${key}`]) || 0,
    }));
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
        epicId: fleet.epic ? fleet.epic.id : null,
        startedAt: Number(fleet.started_at) || 0,
        membersCount: Number(fleet.members_count) || 0,
        eventName: event.name,
        eventDescription: event.description,
        eventType: event.event_type,
        options: options,
        status: data.event_status,
        hitpoints: Number(hitpoints.hitpoints) || 0,
        nextHitpointCountdown: hitpoints.next_hitpoint_countdown,
        nextHitpointAt: Number(hitpoints.next_hitpoint_at) || 0,
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

// 第一段：resources 不耗耐力，全部繳滿；其他類型每項用 3 格繳需求量的 1/2（伺服器會檢查格數與數量，0 格或超量會整筆拒絕）
function planEventDonations(state, settings) {
    let hitpoints = state.hitpoints;
    let isFree = state.eventType == "resources";
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

// 依 app 選項（1/4 用 2 格、1/8 用 1 格）用完剩餘耐力；伺服器接受小於選項上限的數量（2026-11-26 實測 3 格繳 1/8）
function planTiers(remaining, required, hitpoints) {
    let [largeTier, smallTier] = ENERGY_TIERS;
    let smallAmount = Math.floor(required * smallTier.ratio);
    let plans = [];
    while (remaining > 0 && hitpoints >= smallTier.cost) {
        // 剩餘量用小選項就能繳完時不浪費 2 格
        let tier = hitpoints >= largeTier.cost && remaining > smallAmount ? largeTier : smallTier;
        let amount = Math.min(remaining, Math.floor(required * tier.ratio));
        plans.push({ amount: amount, cost: tier.cost });
        remaining -= amount;
        hitpoints -= tier.cost;
    }
    return plans;
}

// 第二段：能量
function planEnergyDonations(state) {
    let remaining = state.energy.required - state.energy.donated;
    return remaining > 0 ? planTiers(remaining, state.energy.required, state.hitpoints) : [];
}

// 第一段備用：3 格繳 1/2 被拒時，每項改用 2 格 1/4 + 1 格 1/8
function planTieredEventDonations(state, settings) {
    let hitpoints = state.hitpoints;
    let plans = [];
    for (let item of state.items) {
        for (let tier of planTiers(shareRemaining(item, settings.sharePercent), item.required, hitpoints)) {
            plans.push({ item: item, ...tier });
            hitpoints -= tier.cost;
        }
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

function sendEventPlans(context, state, plans) {
    return sendPlans(context, state, plans, (p) => eventBody(state, p.item, p.amount, p.cost), (p) => p.item.label);
}

// 最後一筆是 3 格繳 1/2 被伺服器規則拒絕時，重新讀取（以伺服器的耐力與進度為準）後改用 1/4 + 1/8
async function retryRejectedWithTiers(context, state, settings, results) {
    let last = results[results.length - 1];
    if (state.eventType == "resources" || last == undefined || last.isSuccess || last.error != RULE_REJECTED_MESSAGE) {
        return { state: state, results: results };
    }
    let note = { isNote: true, line: `↪ ${last.label} ${formatNumber(last.amount)}（${last.cost} 格）被拒，改用 1/4＋1/8` };
    await sleep(REQUEST_INTERVAL_MS);
    let latest = await fetchState(context);
    if (latest == null || latest.status != "event") {
        return { state: latest, results: results.slice(0, -1).concat(note) };
    }
    let plans = planTieredEventDonations(latest, settings);
    // 沒有可送的備用（例如被拒仍扣了耐力）時保留失敗紀錄，避免通知顯示「完成 0 筆」卻沒有標出失敗
    if (plans.length == 0) {
        return { state: latest, results: results.slice(0, -1).concat({ ...last, error: `${last.error}，改用 1/4＋1/8 時耐力剩 ${latest.hitpoints} 格` }) };
    }
    let retried = await sendEventPlans(context, latest, plans);
    return { state: latest, results: results.slice(0, -1).concat(note, retried) };
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

// withCountdown=false 給管理介面預覽用，回復時間改顯示在耐力格旁邊
function describeWaiting(state, settings, withCountdown = true) {
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
    let countdown = withCountdown && state.nextHitpointCountdown ? `，${state.nextHitpointCountdown} 秒後回復 1 格` : "";
    return `耐力不足，剩 ${state.hitpoints} 格${countdown}`;
}

function progressLine(state) {
    if (state.status != "event" && state.status != "path") {
        return `${state.eventName}（${state.status}）`;
    }
    if (state.status == "path") {
        return `能量 ${formatNumber(Math.min(state.energy.donated, state.energy.required))}/${formatNumber(state.energy.required)}`;
    }
    if (state.eventType == "voting") {
        return state.options.map((o) => `${o.label} ${o.votes} 票`).join("｜");
    }
    return state.items.map((item) => `${item.label} ${formatNumber(item.current)}/${formatNumber(item.required)}`).join("｜");
}

function readVoteRecords() {
    try {
        return JSON.parse($persistentStore.read(VOTED_EVENTS_KEY) || "{}") || {};
    } catch (error) {
        return {};
    }
}

function writeVoteRecord(state, record) {
    let records = readVoteRecords();
    delete records[`${state.fleetId}:${state.eventId}`];
    records[`${state.fleetId}:${state.eventId}`] = record;
    let keys = Object.keys(records);
    keys.slice(0, Math.max(0, keys.length - MAX_VOTED_RECORDS)).forEach((key) => delete records[key]);
    $persistentStore.write(JSON.stringify(records), VOTED_EVENTS_KEY);
}

// 已投票的選項文字：腳本投過的紀錄優先，其次是 hitpoints.value_*（在 app 手動投票的情況）
function readMyVote(state) {
    let record = readVoteRecords()[`${state.fleetId}:${state.eventId}`];
    if (record && record.voted) {
        return record.voted;
    }
    let mine = state.options.find((option) => option.mine > 0);
    return mine ? mine.label : null;
}

function normalizeText(text) {
    return String(text || "").replace(/[\s\p{P}\p{S}]/gu, "");
}

function isSimilarText(left, right) {
    let a = normalizeText(left);
    let b = normalizeText(right);
    return a !== "" && b !== "" && (a.includes(b) || b.includes(a));
}

function isSameOptions(choice, state) {
    return VOTING_KEYS.every((key) => {
        let option = state.options.find((o) => o.key == key);
        return option != undefined && isSimilarText(choice[key], option.label);
    });
}

function isSameQuestion(choice, state) {
    return isSimilarText(choice.question, state.eventName) || isSimilarText(choice.question, state.eventDescription);
}

// 依 VOTING_CHOICES 找出要投的選項；讀不到遊戲選項文字時，以設定的文字顯示
// 先比對選項文字（題目標題可能是各題共用的「要如何採取行動？」），都沒有命中才比對題目
function findVotingChoice(state) {
    let choices = VOTING_CHOICES[state.epicId] || [];
    return choices.find((c) => isSameOptions(c, state)) || choices.find((c) => isSameQuestion(c, state));
}

function findVotingOption(state) {
    let choice = findVotingChoice(state);
    if (choice == undefined) {
        return { reason: "這一題不在 VOTING_CHOICES 中" };
    }
    if (!choice.answer) {
        return { reason: `尚未設定要投的路線（A. ${choice.a}／B. ${choice.b}）` };
    }
    if (!VOTING_KEYS.includes(choice.answer)) {
        return { reason: `answer 只能是 "a" 或 "b"（目前是「${choice.answer}」）` };
    }
    let option = state.options.find((o) => o.key == choice.answer);
    return { option: option || { key: choice.answer, label: choice[choice.answer] } };
}

// 剩餘時間與決定票數（同一項達成員數一半，或時間到才決定路線；2026-11-24 巨龍王 10 人時 5 票就決定）
function requiredVotes(state) {
    return Math.ceil(state.membersCount / 2);
}

function votingStatusLine(state, nowMs) {
    let totalVotes = state.options.reduce((sum, o) => sum + o.votes, 0);
    let votesText = `已投 ${totalVotes}/${state.membersCount} 人｜達一半需 ${requiredVotes(state)} 票`;
    if (state.startedAt <= 0) {
        return [`⏳ ${votesText}`];
    }
    let deadlineMs = (state.startedAt + VOTING_HOURS * 3600) * 1000;
    let remainingSeconds = (deadlineMs - nowMs) / 1000;
    let timeText = remainingSeconds > 0 ? `剩 ${formatDuration(remainingSeconds)}（截止 ${formatClock(deadlineMs)}）` : "已到截止時間，等待結算";
    return [`⏳ ${timeText}`, `${FLIGHT_INDENT}${votesText}`];
}

function votingLines(state) {
    let options = state.options.length > 0 ? state.options.map((o) => `${o.label} ${o.votes} 票`).join("｜") : "讀不到選項（label_a/b/c 都是空的）";
    return [`❓ ${state.eventName}｜${state.eventDescription}`, `選項：${options}`]
        .concat(votingStatusLine(state, Date.now()), `傳說 id ${state.epicId}｜event id ${state.eventId}`);
}

// 選擇題摘要：標題用 VOTING_CHOICES 的題目（遊戲的 event.name 可能是各題共用的標題），比對不到才用 event.name
// view 以進度條顯示各選項票數（目標為決定票數），不顯示耐力格（投票不耗耐力）
function votingSummary(state, firstLine, extra = {}) {
    let choice = findVotingChoice(state);
    let mine = readMyVote(state);
    let view = {
        progress: state.options.map((o) => ({ label: o.label == mine ? `${o.label}（已投）` : o.label, current: o.votes, required: requiredVotes(state), unit: " 票" })),
        hitpoints: null,
        actionLines: [firstLine].concat(votingStatusLine(state, Date.now()), `傳說 id ${state.epicId}｜event id ${state.eventId}`),
        flightLines: flightLines(state, Date.now()),
    };
    return { subtitle: `${choice ? choice.question : state.eventName}｜選擇題`, lines: [firstLine].concat(votingLines(state)), view: view, ...extra };
}

// 選擇題：依 VOTING_CHOICES 投票，每題只投一次；由全隊過半數或時間到決定路線，之後才進入能量階段
// 回傳 { summary }（不需再處理）或 { result }（已送出投票）
async function handleVoting(context, state, settings, isDryRun) {
    let summary = (firstLine, extra) => votingSummary(state, firstLine, extra);
    let voted = readMyVote(state);
    if (voted) {
        return { summary: summary(`🗳 已選「${voted}」，等待票數達一半或時間結束`) };
    }
    let { option, reason } = findVotingOption(state);
    if (option != undefined && !settings.isVoteEnabled) {
        reason = `自動投票已關閉（設定為「${option.label}」）`;
        option = undefined;
    }
    if (option == undefined) {
        let isFirstNotice = !readVoteRecords()[`${state.fleetId}:${state.eventId}`];
        if (!isDryRun && isFirstNotice) {
            writeVoteRecord(state, { notified: true });
        }
        return { summary: summary(`⏸ ${reason}，不投票`, { shouldNotify: isFirstNotice && !isDryRun }) };
    }
    if (isDryRun) {
        return { summary: summary(`🔍 將選擇「${option.label}」`) };
    }
    let label = `選擇「${option.label}」`;
    try {
        let response = await donate(context, state, eventBody(state, option, 1, 0));
        if (response.success !== true) {
            throw new Error(response.message || "success=false");
        }
        writeVoteRecord(state, { voted: option.label });
        return { result: { isSuccess: true, line: `✅ ${label}`, isStepDone: response.refresh === true } };
    } catch (error) {
        // 同一題、同一個錯誤只通知一次，之後的 cron 仍會重試但只記 log
        let record = readVoteRecords()[`${state.fleetId}:${state.eventId}`];
        if (record && record.failed == error.message) {
            return { summary: summary(`❌ ${label}：${error.message}（重複失敗，不再通知）`) };
        }
        writeVoteRecord(state, { failed: error.message });
        return { result: { isSuccess: false, line: `❌ ${label}：${error.message}` } };
    }
}

async function contribute(context, settings, isDryRun) {
    let state = await fetchState(context);
    if (state == null) {
        return { subtitle: "目前沒有參與中的傳說", lines: [] };
    }
    let results = [];
    if (state.status == "event" && state.eventType == "voting") {
        let vote = await handleVoting(context, state, settings, isDryRun);
        if (vote.summary) {
            return vote.summary;
        }
        results.push(vote.result);
        context.sentCount += 1;
        // 投票成功後重新讀取，讓摘要顯示最新票數；refresh:true 時接著繳能量
        if (vote.result.isSuccess) {
            await sleep(REQUEST_INTERVAL_MS);
            state = await fetchState(context);
        }
    } else if (state.status == "event") {
        let plans = planEventDonations(state, settings);
        if (isDryRun) {
            return previewResult(state, plans.map((p) => `${p.item.label} ${formatNumber(p.amount)}（${p.cost} 格）`), settings);
        }
        ({ state, results } = await retryRejectedWithTiers(context, state, settings, await sendEventPlans(context, state, plans)));
        if (results.some((r) => r.isStepDone)) {
            await sleep(REQUEST_INTERVAL_MS);
            state = await fetchState(context);
        }
    }
    if (state != null && state.status == "path") {
        let plans = planEnergyDonations(state);
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

// 預覽：lines 是純文字版；view 給管理介面畫進度條與耐力格（順序：進度 → 耐力與預計繳納 → 分隔線 → 飛行）
// 標題為「關卡名稱｜目前階段」
function previewResult(state, planLines, settings) {
    let planText = planLines.map((line) => `🔍 ${line}`);
    let actionLines = planText.length > 0 ? planText : [`⏸ ${describeWaiting(state, settings)}`];
    let flight = flightLines(state, Date.now());
    let view = {
        progress: progressItems(state),
        // 星球資源不耗耐力，不顯示耐力格
        hitpoints: state.status == "event" && state.eventType == "resources" ? null : { value: state.hitpoints, max: MAX_HITPOINTS, recovery: hitpointRecoveryText(state) },
        actionLines: planText.length > 0 ? planText : [`⏸ ${describeWaiting(state, settings, false)}`],
        flightLines: flight,
    };
    let stage = state.status == "path" ? "飛行中" : "繳納資源";
    return { subtitle: `${state.eventName}｜${stage}`, lines: [progressLine(state)].concat(actionLines, flight), view: view };
}

// next_hitpoint_at 是伺服器給的下一格回復時間（epoch 秒，HAR 確認 = 讀取時間 + countdown）；耐力滿時為 0
// 用伺服器時間，不受手機時鐘誤差影響；回復約每分鐘 1 格，所以顯示到秒
function hitpointRecoveryText(state) {
    if (state.hitpoints >= MAX_HITPOINTS) {
        return "已滿";
    }
    if (state.nextHitpointAt <= 0) {
        return "";
    }
    let date = new Date(state.nextHitpointAt * 1000);
    let pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} 回復 1 格`;
}

function progressItems(state) {
    if (state.status == "path") {
        return [{ label: "能量", current: Math.min(state.energy.donated, state.energy.required), required: state.energy.required }];
    }
    return state.items.map((item) => ({ label: item.label, current: item.current, required: item.required }));
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
    let donations = results.filter((r) => !r.isNote);
    let succeeded = donations.filter((r) => r.isSuccess).length;
    let failed = donations.length - succeeded;
    let subtitle = results.length == 0 ? `${state.eventName}｜不需繳納` : `${state.eventName}｜完成 ${succeeded} 筆${failed > 0 ? `｜失敗 ${failed} 筆` : ""}`;
    let lines = results.map(resultLine);
    if (results.length == 0) {
        lines.push(`⏸ ${describeWaiting(state, settings)}`);
    }
    lines.push(progressLine(state));
    return { subtitle: subtitle, lines: lines, hasDonation: results.length > 0 };
}

function resultLine(r) {
    if (r.line) {
        return r.line;
    }
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

// 原始回應：直接回傳 fleets/current 的 JSON（$httpClient 不帶 If-None-Match，一定是 200 完整內容），用來確認新的欄位
async function fetchRaw(context) {
    let data = await request("GET", `${API_BASE}/fleets/current?${context.query}`);
    return { subtitle: "fleets/current 原始回應", lines: [], raw: JSON.stringify(data, null, 2) };
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
        let match = $request.url.match(/\/api\/epic\/(run|status|test|raw)/);
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
    if (route == "raw") {
        return fetchRaw(context);
    }
    if (route == "run" || route == "cron" || route == "status") {
        return contribute(context, settings, route == "status");
    }
    throw new Error(`未知的執行方式：${route}`);
}

function finish(route, summary, isError) {
    let record = { time: Date.now(), route: route, isError: isError, subtitle: summary.subtitle, lines: summary.lines };
    if (summary.raw != undefined) {
        record.raw = summary.raw;
    }
    if (summary.view != undefined) {
        record.view = summary.view;
    }
    if (!READ_ONLY_ROUTES.includes(route) && !summary.isSkipped) {
        $persistentStore.write(JSON.stringify(record), LAST_RESULT_KEY);
    }
    // cron 沒有繳納時只記 log，避免每 10 分鐘通知一次
    if (isError || summary.hasDonation || summary.shouldNotify || (route != "cron" && !READ_ONLY_ROUTES.includes(route))) {
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
