// Walkr Config Page - Walkr 管理介面（分頁：傳說、共駕步數、帳號資源、實驗室、資訊、系統）
// 攔截 walkr.mysurge.com 首頁，回傳 HTML；頁面透過同網域 API 操作：
//   /api/read、/api/write、/api/reset、/api/status → walkr-config-api.js（白名單參數）
//   /api/epic/status、/api/epic/run、/api/epic/test、/api/epic/raw → walkr-epic-auto-contribute.js
//   /data/epics → walkr-epic-info.js（資訊分頁的傳說資料）
// 一般設定以 FORMS 描述欄位，由 renderForm 產生；網址 hash（#epic 等）記住目前分頁

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Walkr 管理</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    background: linear-gradient(135deg, #0b1d26 0%, #12343f 50%, #0b1d26 100%);
    min-height: 100vh; padding: 20px 16px; color: #e0e0e0;
}
.container { max-width: 500px; margin: 0 auto; }
h1 {
    text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 16px; letter-spacing: 1px;
    background: linear-gradient(90deg, #6ee7d8, #b4f0a8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.tabs {
    position: sticky; top: 0; z-index: 10; display: flex; gap: 4px; padding: 4px; margin-bottom: 16px;
    background: rgba(11, 29, 38, 0.92); border: 1px solid rgba(110, 231, 216, 0.25); border-radius: 12px;
    -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
}
.tabs button {
    flex: 1; padding: 8px 2px; font-size: 12px; font-weight: 600; line-height: 1.4;
    background: transparent; color: #8aa; border-radius: 9px; width: auto;
}
.tabs button .icon { display: block; font-size: 17px; }
.tabs button.active { background: rgba(110, 231, 216, 0.18); color: #6ee7d8; }
.tab { display: none; }
.tab.active { display: block; }
.card {
    background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(110, 231, 216, 0.25);
    border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.card.danger { border-color: rgba(240, 114, 114, 0.45); }
.card-title { font-size: 15px; font-weight: 600; color: #6ee7d8; margin-bottom: 14px; }
.card.danger .card-title { color: #f6a96b; }
.hint { font-size: 12px; color: #8aa; margin: -6px 0 14px; line-height: 1.6; }
.card-title + .hint { margin-top: 0; }
label { display: block; font-size: 13px; color: #aaa; margin-bottom: 6px; font-weight: 500; }
input[type="number"], input[type="text"], select {
    width: 100%; padding: 12px 14px; font-size: 15px; margin-bottom: 14px;
    border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px;
    background: rgba(255, 255, 255, 0.06); color: #fff; outline: none; -webkit-appearance: none;
}
select option { color: #000; }
.row { display: flex; gap: 10px; }
.row > * { flex: 1; min-width: 0; }
button {
    width: 100%; padding: 13px; font-size: 15px; font-weight: 600; border: none; border-radius: 10px;
    cursor: pointer; color: #062a2a; background: linear-gradient(90deg, #6ee7d8, #b4f0a8);
}
button.secondary { background: rgba(255, 255, 255, 0.12); color: #e0e0e0; }
button.danger { background: linear-gradient(90deg, #f6a96b, #f07272); color: #2a0a0a; }
button:disabled { opacity: 0.5; }
.switch-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.switch-row label { margin: 0; }
.badge { flex-shrink: 0; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
.badge.on { background: rgba(110, 231, 216, 0.2); color: #6ee7d8; }
.badge.off { background: rgba(240, 114, 114, 0.2); color: #f07272; }
.result {
    margin-top: 14px; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.7;
    background: rgba(0, 0, 0, 0.25); white-space: pre-wrap; display: none;
}
/* 每行一個區塊，換行時第二行起縮排對齊；只有超長字串（例如測試回應 JSON）才強制斷開 */
.result .line { padding-left: 1.6em; text-indent: -1.6em; word-break: normal; overflow-wrap: anywhere; }
.result.error { color: #f07272; }
.result textarea {
    display: block; width: 100%; height: 320px; margin: 8px 0; padding: 10px; border-radius: 8px; resize: vertical;
    border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(0, 0, 0, 0.3); color: #e0e0e0;
    font: 12px/1.5 ui-monospace, Menlo, monospace; white-space: pre;
}
.result .title { font-weight: 600; color: #fff; }
.result .progress { margin: 6px 0 8px; }
.result .progress-head { display: flex; justify-content: space-between; gap: 8px; }
.result .bar { height: 8px; margin-top: 4px; border-radius: 4px; background: rgba(255, 255, 255, 0.12); overflow: hidden; }
.result .bar span { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #6ee7d8, #b4f0a8); }
.result .capsules { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 12px 0 4px; }
.result .capsule { width: 30px; height: 12px; border-radius: 6px; border: 1.5px solid #6ee7d8; }
.result .capsules .name { margin-right: 2px; }
.result .capsules .recovery { margin-left: 4px; color: #8aa; font-size: 12px; }
.result .capsule.full { background: #6ee7d8; }
.result hr { border: none; border-top: 1px solid rgba(255, 255, 255, 0.15); margin: 8px 0; }
.result .time { color: #8aa; font-size: 12px; }
.info { font-size: 13px; line-height: 1.7; }
.info-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.info-row:last-child { border-bottom: none; }
.info-row .name { color: #aaa; flex-shrink: 0; }
.info-row .value { text-align: right; overflow-wrap: anywhere; }
.info-row .value.ok { color: #6ee7d8; }
.info-row .value.bad { color: #f07272; }
.missing { color: #f07272; font-weight: 600; }
details.epic { border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
details.epic:last-child { border-bottom: none; }
details.epic summary { padding: 12px 0; font-size: 14px; font-weight: 600; cursor: pointer; }
details.epic summary .sub { display: block; margin-top: 2px; font-size: 12px; font-weight: 400; color: #8aa; }
.epic-meta { font-size: 12px; color: #aaa; line-height: 1.7; margin-bottom: 8px; }
.event { padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 13px; line-height: 1.6; }
.event .event-name { font-weight: 600; color: #fff; }
.event .need { color: #ccc; }
.event .flight { color: #8aa; font-size: 12px; }
.event .note { color: #8aa; font-size: 12px; }
.event .game { color: #6ee7d8; font-size: 12px; }
.event.vote { background: rgba(110, 231, 216, 0.08); border-radius: 8px; padding: 8px; margin: 4px 0; }
.route { display: inline-block; min-width: 18px; margin-right: 6px; padding: 0 5px; border-radius: 5px; font-size: 11px; text-align: center; background: rgba(246, 169, 107, 0.25); color: #f6a96b; }
.route.b { background: rgba(140, 170, 255, 0.25); color: #9db4ff; }
</style>
</head>
<body>
<div class="container">
    <h1>🚀 Walkr 管理</h1>
    <nav class="tabs" id="tabs">
        <button data-tab="epic"><span class="icon">🚀</span>傳說</button>
        <button data-tab="pilot"><span class="icon">👟</span>共駕步數</button>
        <button data-tab="account"><span class="icon">💰</span>帳號資源</button>
        <button data-tab="lab"><span class="icon">🧪</span>實驗室</button>
        <button data-tab="info"><span class="icon">📖</span>資訊</button>
        <button data-tab="system"><span class="icon">⚙️</span>系統</button>
    </nav>

    <section class="tab" id="tab-epic">
        <div class="card">
            <div class="card-title">繳納狀態</div>
            <div class="hint">「預覽」只讀取目前狀態與預計繳納內容；「立即繳納」依耐力規則實際送出，不受自動執行開關限制；「原始回應」顯示 fleets/current 的完整 JSON，可複製給開發者確認新欄位（例如選擇題）。</div>
            <div class="row">
                <button class="secondary" id="btnStatus" onclick="callEpic('status', this)">預覽</button>
                <button id="btnRun" onclick="callEpic('run', this)">立即繳納</button>
            </div>
            <button class="secondary" style="margin-top:10px" onclick="callEpic('raw', this)">原始回應</button>
            <div class="result" id="epicResult"></div>
        </div>
        <div id="form-epicSettings"></div>
        <div class="card">
            <div class="card-title">單次測試繳納</div>
            <div class="hint">依下方參數送出一筆繳納請求並顯示伺服器原始回應，用來測試耐力與數量限制。會實際送到伺服器。</div>
            <label for="testItem">項目</label>
            <select id="testItem">
                <option value="">自動（目前步驟第一個未完成項目）</option>
                <option value="a">value_a（金幣 / 星球資源 A）</option>
                <option value="b">value_b（食物 / 星球資源 B）</option>
                <option value="c">value_c（星球資源 C）</option>
                <option value="energy">能量</option>
            </select>
            <div class="row">
                <div>
                    <label for="testAmount">數量（空白 = 剩餘量）</label>
                    <input type="number" id="testAmount" placeholder="剩餘需求量">
                </div>
                <div>
                    <label for="testHitpoints">使用格數</label>
                    <input type="number" id="testHitpoints" min="0" max="3" placeholder="1">
                </div>
            </div>
            <button class="danger" onclick="runTest(this)">送出測試</button>
            <div class="result" id="testResult"></div>
        </div>
        <div id="form-epicReward"></div>
    </section>

    <section class="tab" id="tab-pilot">
        <div id="form-pilot"></div>
        <div class="card">
            <div class="card-title">今日步數狀態</div>
            <div class="hint">由步數腳本自動維護，跨日後重新計算。</div>
            <div class="info" id="pedometerInfo">讀取中…</div>
        </div>
        <div id="form-bridge"></div>
    </section>

    <section class="tab" id="tab-account">
        <div id="form-money"></div>
        <div id="form-cube"></div>
    </section>

    <section class="tab" id="tab-lab">
        <div id="form-lab"></div>
        <div class="card">
            <div class="card-title">贊助紀錄</div>
            <div class="info" id="labInfo">讀取中…</div>
            <div class="hint" style="margin-top:12px">已處理的輪次不會重複贊助；清除後，下次執行會重新檢查目前的需求。</div>
            <button class="secondary" onclick="resetRounds(this)">清除已處理紀錄</button>
            <div class="result" id="labResult"></div>
        </div>
    </section>

    <section class="tab" id="tab-info">
        <div class="card">
            <div class="card-title">傳說資訊</div>
            <div class="hint">各傳說的事件順序、需求資源與飛行能量／時間。數值多數整理自截圖，繳納以遊戲內 fleets/current 為準；<span class="missing">紅色</span>是遺漏或有疑問、等實測補齊的資料，標示「✓ 遊戲內確認」的是已用遊戲資料核對過的事件。A／B 是選擇題的分支路線。</div>
            <div id="epicInfo">讀取中…</div>
        </div>
    </section>

    <section class="tab" id="tab-system">
        <div class="card">
            <div class="card-title">擷取狀態</div>
            <div class="hint">開啟一次 Walkr app 時，擷取腳本會更新 token 與網址。這裡不會顯示 token 本身。</div>
            <div class="info" id="systemInfo">讀取中…</div>
            <button class="secondary" style="margin-top:14px" onclick="loadStatus()">重新整理</button>
        </div>
    </section>
</div>

<script>
var API_BASE = "/api";
var TABS = ["epic", "pilot", "account", "lab", "info", "system"];

// 一般設定表單：toggle 點擊後立即寫入，其餘欄位按「儲存」一起寫入
var FORMS = {
    epicSettings: {
        title: "自動繳納設定",
        fields: [
            { key: "WalkrEpicAutoEnabled", label: "自動執行（cron 每 10 分鐘）", type: "toggle", defaultOn: true },
            { key: "WalkrEpicVoteEnabled", label: "選擇題自動投票", type: "toggle", defaultOn: true,
              hint: "依腳本內 VOTING_CHOICES 投票；關閉時只通知一次題目與選項，不投票。" },
            { key: "WalkrEpicSharePercent", label: "第一段個人上限（每項需求量的 %）", type: "number", min: 1, max: 100, integer: true, defaultValue: "100",
              hint: "第一段每項用 3 格繳需求量的 1/2，能量用 2+1 格繳 1/4 + 1/8；星球資源一律 0 格繳納；能量不受個人上限限制。" }
        ]
    },
    epicReward: {
        title: "傳說完成獎勵",
        hint: "傳說完成、領取獎勵時修改回應中的獎勵內容。",
        fields: [
            { key: "WalkrEpicRewardType", label: "能量方塊獎勵改為", type: "select", options: [["cubes", "能量方塊（數量依下方設定）"], ["map", "DFR 設計圖"]], defaultValue: "cubes" },
            { key: "WalkrEpicRewardMoney", label: "額外金幣", type: "number", min: 0, integer: true, placeholder: "未設定時 500,000,000" },
            { key: "WalkrEpicRewardCubes", label: "能量方塊數量", type: "number", min: 0, integer: true, placeholder: "未設定時 5,000" }
        ]
    },
    pilot: {
        title: "走路轉換能量",
        hint: "每次轉換時額外提供「基礎值 + 0~9,999」能量給共駕，上傳的步數依每步能量同步增加。",
        fields: [
            { key: "WalkrCovertBaseEnergy", label: "額外能量基礎值", type: "number", min: 0, integer: true, required: true, placeholder: "建議 20000",
              hint: "數值越大步數越不合理，建議不超過 30,000。" },
            { key: "WalkrEnergyPerStep", label: "每一步可轉換的能量", type: "number", min: 0.01, step: "0.01", required: true, placeholder: "實測約 1.3" }
        ],
        extra: '<div class="hint" id="stepEstimate"></div>'
    },
    bridge: {
        title: "艦橋共駕能量",
        fields: [
            { key: "WalkrBridgeDisplayEnergy", label: "畫面顯示值（每位共駕）", type: "number", min: 1, integer: true, placeholder: "未設定時 160,000",
              hint: "進入艦橋時顯示的共駕能量，只影響畫面。" },
            { key: "WalkrBridgeClaimEnergy", label: "實際領取值（每次）", type: "number", min: 1, integer: true, placeholder: "未設定時 80,000",
              hint: "點共駕領取時實際拿到的能量。" }
        ]
    },
    money: {
        title: "修改金幣",
        danger: true,
        hint: "重新登入帳號時，以現有金幣加上下方數值送給伺服器。需熟悉流程並做好資料備份。",
        fields: [
            { key: "WalkrIsExecuteMoneyModify", label: "啟用金幣修改", type: "toggle", defaultOn: false },
            { key: "WalkrMoney", label: "增加的金幣", type: "number", min: 0, integer: true, placeholder: "建議低於 30 億" }
        ]
    },
    cube: {
        title: "修改能量方塊",
        danger: true,
        hint: "重新登入帳號時，以現有能量方塊加上下方數值送給伺服器。安全範圍不明，請小心使用。",
        fields: [
            { key: "WalkrIsExecuteCubeModify", label: "啟用能量方塊修改", type: "toggle", defaultOn: false },
            { key: "WalkrCube", label: "增加的能量方塊", type: "number", min: 0, integer: true, placeholder: "例如 150000" }
        ]
    },
    lab: {
        title: "實驗室自動贊助",
        fields: [
            { key: "WalkrLabAutoEnabled", label: "自動執行（cron 每 30 分鐘）", type: "toggle", defaultOn: true }
        ]
    }
};

function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
}

function formatNumber(value) {
    return Number(value).toLocaleString("en-US");
}

function formatTime(ms) {
    return new Date(ms).toLocaleString("zh-TW", { hour12: false });
}

// X-Walkr-Admin 讓 API 確認請求來自本頁（避免其他網站 CSRF）
var ADMIN_HEADERS = { "X-Walkr-Admin": "1" };

function getJson(path) {
    return fetch(API_BASE + path, { headers: ADMIN_HEADERS }).then(function(r) { return r.json(); });
}

function postJson(path, data) {
    return fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Walkr-Admin": "1" },
        body: JSON.stringify(data)
    }).then(function(r) { return r.json(); }).then(function(result) {
        if (!result.success) { throw new Error(result.message || "寫入失敗"); }
        return result;
    });
}

function readKey(key) {
    return getJson("/read?key=" + encodeURIComponent(key)).then(function(data) { return data.value; });
}

function writeKey(key, value) {
    return postJson("/write", { key: key, value: value });
}

function lineHtml(lines) {
    return (lines || []).map(function(line) { return '<div class="line">' + escapeHtml(line) + "</div>"; }).join("");
}

function progressHtml(item) {
    var percent = item.required > 0 ? Math.min(100, (item.current / item.required) * 100) : 0;
    return '<div class="progress"><div class="progress-head"><span>' + escapeHtml(item.label) + "</span><span>" +
        formatNumber(item.current) + " / " + formatNumber(item.required) + escapeHtml(item.unit || "") + '</span></div><div class="bar"><span style="width:' +
        percent.toFixed(1) + '%"></span></div></div>';
}

function capsulesHtml(hitpoints) {
    if (!hitpoints) { return ""; }
    var html = "";
    for (var i = 0; i < hitpoints.max; i++) {
        html += '<span class="capsule' + (i < hitpoints.value ? " full" : "") + '"></span>';
    }
    var recovery = hitpoints.recovery ? '<span class="recovery">' + escapeHtml(hitpoints.recovery) + "</span>" : "";
    return '<div class="capsules"><span class="name">耐力</span>' + html + recovery + "</div>";
}

// 傳說預覽：進度條 → 耐力格（投票、星球資源沒有）與預計繳納 → 分隔線 → 下一階段飛行資訊
function epicViewHtml(view) {
    var flight = view.flightLines.length > 0 ? "<hr>" + lineHtml(view.flightLines) : "";
    return view.progress.map(progressHtml).join("") + capsulesHtml(view.hitpoints) + lineHtml(view.actionLines) + flight;
}

function showRecord(el, record) {
    el.style.display = "block";
    el.className = "result" + (record.isError ? " error" : "");
    el.innerHTML = '<div class="time">' + escapeHtml(record.time ? formatTime(record.time) : "") + "</div>" +
        '<div class="title">' + escapeHtml(record.subtitle) + "</div>" +
        (record.view ? epicViewHtml(record.view) : lineHtml(record.lines)) +
        (record.raw ? '<textarea readonly>' + escapeHtml(record.raw) + '</textarea><button class="secondary" onclick="copyRaw(this)">複製</button>' : "");
}

function copyRaw(btn) {
    var textarea = btn.previousElementSibling;
    textarea.select();
    var copied = navigator.clipboard ? navigator.clipboard.writeText(textarea.value) : Promise.reject(new Error("不支援"));
    copied.then(function() { btn.textContent = "已複製"; })
        .catch(function() { btn.textContent = "請長按文字框手動複製"; });
}

function showMessage(el, text, isError) {
    el.style.display = "block";
    el.className = "result" + (isError ? " error" : "");
    el.textContent = text;
}

function withLoading(btn, promise) {
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "處理中…";
    return promise.finally(function() { btn.disabled = false; btn.textContent = label; });
}

function infoRows(rows) {
    return rows.map(function(row) {
        return '<div class="info-row"><span class="name">' + escapeHtml(row[0]) + '</span><span class="value ' + (row[2] || "") + '">' + escapeHtml(row[1]) + "</span></div>";
    }).join("");
}

// ===== 分頁 =====
function showTab(name) {
    var tab = TABS.indexOf(name) >= 0 ? name : "epic";
    TABS.forEach(function(t) {
        document.getElementById("tab-" + t).classList.toggle("active", t === tab);
    });
    document.querySelectorAll("#tabs button").forEach(function(btn) {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    if (tab === "pilot" || tab === "lab" || tab === "system") { loadStatus(); }
    if (tab === "info") { loadEpicInfo(); }
}

document.getElementById("tabs").addEventListener("click", function(event) {
    var btn = event.target.closest("button");
    if (btn) { location.hash = btn.getAttribute("data-tab"); }
});
window.addEventListener("hashchange", function() { showTab(location.hash.slice(1)); });

// ===== 一般設定表單 =====
function fieldHtml(field) {
    var id = "field-" + field.key;
    var hint = field.hint ? '<div class="hint">' + escapeHtml(field.hint) + "</div>" : "";
    if (field.type === "toggle") {
        return '<div class="switch-row"><label>' + escapeHtml(field.label) + '</label><span class="badge" id="' + id + '">讀取中</span></div>' + hint;
    }
    var label = '<label for="' + id + '">' + escapeHtml(field.label) + "</label>";
    if (field.type === "select") {
        var options = field.options.map(function(o) { return '<option value="' + o[0] + '">' + escapeHtml(o[1]) + "</option>"; }).join("");
        return label + '<select id="' + id + '">' + options + "</select>" + hint;
    }
    var attrs = ' min="' + (field.min != null ? field.min : "") + '"' + (field.max != null ? ' max="' + field.max + '"' : "") +
        ' step="' + (field.step || (field.integer ? "1" : "any")) + '" placeholder="' + escapeHtml(field.placeholder || field.defaultValue || "") + '"';
    return label + '<input type="number" inputmode="decimal" id="' + id + '"' + attrs + ">" + hint;
}

function renderForm(name) {
    var form = FORMS[name];
    var hasInputs = form.fields.some(function(f) { return f.type !== "toggle"; });
    var html = '<div class="card' + (form.danger ? " danger" : "") + '"><div class="card-title">' + escapeHtml(form.title) + "</div>" +
        (form.hint ? '<div class="hint">' + escapeHtml(form.hint) + "</div>" : "") +
        form.fields.map(fieldHtml).join("") + (form.extra || "") +
        (hasInputs ? '<button onclick="saveForm(\\'' + name + '\\', this)">儲存</button>' : "") +
        '<div class="result" id="result-' + name + '"></div></div>';
    document.getElementById("form-" + name).innerHTML = html;
    form.fields.forEach(function(field) { loadField(name, field); });
}

function renderToggle(field, isOn) {
    var badge = document.getElementById("field-" + field.key);
    badge.textContent = isOn ? "已開啟" : "已關閉";
    badge.className = "badge " + (isOn ? "on" : "off");
    badge.onclick = function() { toggleField(field, !isOn); };
}

function loadField(formName, field) {
    readKey(field.key).then(function(value) {
        if (field.type === "toggle") {
            renderToggle(field, value === "" ? field.defaultOn : value === "true");
            return;
        }
        var el = document.getElementById("field-" + field.key);
        el.value = value !== "" ? value : (field.type === "select" ? field.defaultValue : "");
        if (formName === "pilot") { updateStepEstimate(); }
    });
}

function toggleField(field, next) {
    var form = Object.keys(FORMS).map(function(k) { return FORMS[k]; }).find(function(f) { return f.fields.indexOf(field) >= 0; });
    if (next && form.danger && !confirm("確定要啟用「" + field.label + "」？")) { return; }
    writeKey(field.key, next ? "true" : "false")
        .then(function() { renderToggle(field, next); })
        .catch(function(err) { alert("❌ " + err.message); });
}

function validateField(field, text) {
    if (field.type === "select") { return null; }
    if (text === "") { return field.required ? "「" + field.label + "」必須填寫" : null; }
    var value = Number(text);
    if (!isFinite(value)) { return "「" + field.label + "」必須是數字"; }
    if (field.integer && Math.floor(value) !== value) { return "「" + field.label + "」必須是整數"; }
    if (field.min != null && value < field.min) { return "「" + field.label + "」不能小於 " + field.min; }
    if (field.max != null && value > field.max) { return "「" + field.label + "」不能大於 " + field.max; }
    return null;
}

function saveForm(name, btn) {
    var form = FORMS[name];
    var resultEl = document.getElementById("result-" + name);
    var fields = form.fields.filter(function(f) { return f.type !== "toggle"; });
    var values = fields.map(function(f) { return document.getElementById("field-" + f.key).value.trim(); });
    var errors = fields.map(function(f, i) { return validateField(f, values[i]); }).filter(Boolean);
    if (errors.length > 0) { return showMessage(resultEl, "❌ " + errors.join("\\n"), true); }
    if (form.danger && !confirm("確定要儲存「" + form.title + "」？")) { return; }
    withLoading(btn, Promise.all(fields.map(function(f, i) { return writeKey(f.key, values[i]); }))
        .then(function() { showMessage(resultEl, "✅ 已儲存", false); })
        .catch(function(err) { showMessage(resultEl, "❌ " + err.message, true); }));
}

function updateStepEstimate() {
    var el = document.getElementById("stepEstimate");
    var base = Number(document.getElementById("field-WalkrCovertBaseEnergy").value);
    var perStep = Number(document.getElementById("field-WalkrEnergyPerStep").value);
    el.textContent = base > 0 && perStep > 0
        ? "每次轉換約額外增加 " + formatNumber(Math.ceil(base / perStep)) + " ～ " + formatNumber(Math.ceil((base + 9999) / perStep)) + " 步"
        : "";
}

// ===== 傳說 =====
function callEpic(action, btn) {
    var el = document.getElementById("epicResult");
    return withLoading(btn, getJson("/epic/" + action)
        .then(function(record) { showRecord(el, record); })
        .catch(function(err) { showMessage(el, "❌ " + err, true); }));
}

function runTest(btn) {
    var el = document.getElementById("testResult");
    var hitpointsText = document.getElementById("testHitpoints").value.trim();
    if (!confirm("確定要送出測試繳納？")) { return; }
    withLoading(btn, Promise.all([
        writeKey("WalkrEpicTestItem", document.getElementById("testItem").value),
        writeKey("WalkrEpicTestAmount", document.getElementById("testAmount").value.trim()),
        writeKey("WalkrEpicTestHitpoints", hitpointsText === "" ? "1" : hitpointsText)
    ]).then(function() { return getJson("/epic/test"); })
      .then(function(record) { showRecord(el, record); })
      .catch(function(err) { showMessage(el, "❌ " + err.message, true); }));
}

function loadEpic() {
    readKey("WalkrEpicTestItem").then(function(v) { document.getElementById("testItem").value = v || ""; });
    readKey("WalkrEpicTestAmount").then(function(v) { document.getElementById("testAmount").value = v || ""; });
    readKey("WalkrEpicTestHitpoints").then(function(v) { document.getElementById("testHitpoints").value = v === "" ? "1" : v; });
    // 進入畫面時自動預覽一次目前狀態（不顯示上次的暫存結果）
    callEpic("status", document.getElementById("btnStatus"));
}

// ===== 資訊（傳說資料） =====
// 資料來自 walkr-epic-info.js：0 = 不需要、null = 遺漏
var ENERGY_PER_HOUR = 6000;
var isEpicInfoLoaded = false;

function missingHtml(text) {
    return '<span class="missing">' + escapeHtml(text) + "</span>";
}

function amountHtml(label, value) {
    if (value === null) { return escapeHtml(label) + " " + missingHtml("遺漏"); }
    return value > 0 ? escapeHtml(label + " " + formatNumber(value)) : "";
}

function needHtml(ev) {
    var parts = [
        ev.item ? escapeHtml(ev.item) : "",
        amountHtml("金幣", ev.coins), amountHtml("食物", ev.food),
        amountHtml("資源 A", ev.a), amountHtml("資源 B", ev.b), amountHtml("資源 C", ev.c)
    ].filter(Boolean);
    return parts.length > 0 ? parts.join("・") : missingHtml("需求資源遺漏");
}

function flightHtml(ev) {
    var energy = ev.energy === null ? missingHtml("遺漏") : formatNumber(ev.energy);
    var hours = ev.hours === null ? missingHtml("遺漏") : escapeHtml(ev.hours + " 小時");
    var isMismatch = ev.energy !== null && ev.hours !== null && ev.energy !== ev.hours * ENERGY_PER_HOUR;
    return '<div class="flight">→ 飛行能量 ' + energy + "・" + hours +
        (isMismatch ? " " + missingHtml("（與每小時 6,000 能量不符）") : "") + "</div>";
}

function eventHtml(ev) {
    var extra = (ev.game ? '<div class="game">✓ 遊戲內確認：' + escapeHtml(ev.game) + "</div>" : "") +
        (ev.note ? '<div class="note">' + escapeHtml(ev.note) + "</div>" : "");
    if (ev.vote) {
        return '<div class="event vote"><div class="event-name">❓ ' + escapeHtml(ev.vote) + '</div><div class="need">' +
            '<span class="route">A</span>' + escapeHtml(ev.optionA) + '　<span class="route b">B</span>' + escapeHtml(ev.optionB) +
            "</div>" + flightHtml(ev) + extra + "</div>";
    }
    var route = ev.name.match(/^([AB])\.(.*)$/);
    var name = route ? '<span class="route' + (route[1] === "B" ? " b" : "") + '">' + route[1] + "</span>" + escapeHtml(route[2]) : escapeHtml(ev.name);
    return '<div class="event"><div class="event-name">' + name + '</div><div class="need">' + needHtml(ev) + "</div>" + flightHtml(ev) + extra + "</div>";
}

function epicInfoHtml(epic) {
    var totalEnergy = epic.events.reduce(function(sum, ev) { return sum + (ev.energy || 0); }, 0);
    var participate = epic.participate ? escapeHtml(epic.participate) : epic.cubes === null ? "能量方塊 " + missingHtml("遺漏") : escapeHtml("能量方塊 " + formatNumber(epic.cubes));
    var finish = epic.finish === null ? missingHtml("遺漏") : escapeHtml(epic.finish);
    var votes = epic.events.filter(function(ev) { return ev.vote; }).length;
    return '<details class="epic"><summary>' + escapeHtml(epic.id + ". " + epic.name) +
        '<span class="sub">' + escapeHtml(epic.members + " 人・" + epic.events.length + " 個事件" + (votes > 0 ? "・" + votes + " 題選擇題" : "")) + "</span></summary>" +
        '<div class="epic-meta">完成：' + finish + "<br>獎勵：" + escapeHtml(formatNumber(epic.contribution) + " × 貢獻度 金幣") + "＋" + participate +
        "<br>" + escapeHtml("journey " + epic.journey + "・列出的飛行能量合計 " + formatNumber(totalEnergy) + "（含所有分支）") +
        (epic.note ? '<br><span class="missing">' + escapeHtml(epic.note) + "</span>" : "") + "</div>" +
        epic.events.map(eventHtml).join("") + "</details>";
}

function loadEpicInfo() {
    if (isEpicInfoLoaded) { return; }
    var el = document.getElementById("epicInfo");
    fetch("/data/epics", { headers: ADMIN_HEADERS })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            isEpicInfoLoaded = true;
            el.innerHTML = data.epics.map(epicInfoHtml).join("") +
                '<div class="hint" style="margin:12px 0 0">資料更新：' + escapeHtml(data.updatedAt) + "</div>";
        })
        .catch(function(err) { el.textContent = "❌ " + err; });
}

// ===== 狀態（共駕步數、實驗室、系統） =====
function renderStatus(status) {
    // p.date 是 app 上傳步數的當地午夜 epoch 秒；不是今天時，代表今天尚未同步步數
    var p = status.pedometer;
    var todayStart = new Date().setHours(0, 0, 0, 0) / 1000;
    var isToday = p && Number(p.date) === todayStart;
    document.getElementById("pedometerInfo").innerHTML = p ? infoRows([
        ["日期", p.date ? new Date(Number(p.date) * 1000).toLocaleDateString("zh-TW") + (isToday ? "" : "（前次紀錄）") : "-", isToday ? "" : "bad"],
        [isToday ? "今日額外步數" : "當日額外步數", formatNumber(p.extraSteps || 0)],
        ["待轉換能量", formatNumber(p.pendingEnergy || 0)]
    ]) : "尚無紀錄";
    document.getElementById("labInfo").innerHTML = infoRows([
        ["玩家 id", status.playerId ? status.playerId.split(":").pop() : "尚未取得"],
        ["已處理輪次", status.handledRoundsCount + " 筆"]
    ]);
    var token = status.token;
    var isExpired = token.expiresAt && token.expiresAt < Date.now();
    document.getElementById("systemInfo").innerHTML = infoRows([
        ["Token", !token.found ? "尚未擷取" : token.isInvalid ? "格式無法解析" : isExpired ? "已過期" : "已擷取", token.found && !token.isInvalid && !isExpired ? "ok" : "bad"],
        ["到期時間", token.expiresAt ? formatTime(token.expiresAt) : "-"],
        ["帳號 id", token.coreId || "-"],
        ["App 版本", (status.labCurrentUrl.match(/client_version=([^&]*)/) || [])[1] || "-"],
        ["User-Agent", status.userAgent || "-"],
        ["實驗室網址", status.labCurrentUrl ? "已擷取" : "尚未擷取", status.labCurrentUrl ? "ok" : "bad"],
        ["實驗室留言網址", status.labCommentsUrl ? "已擷取" : "尚未擷取", status.labCommentsUrl ? "ok" : "bad"]
    ]);
}

function loadStatus() {
    getJson("/status").then(renderStatus).catch(function(err) {
        ["pedometerInfo", "labInfo", "systemInfo"].forEach(function(id) { document.getElementById(id).textContent = "❌ " + err; });
    });
}

function resetRounds(btn) {
    var el = document.getElementById("labResult");
    if (!confirm("確定要清除已處理的贊助紀錄？")) { return; }
    withLoading(btn, postJson("/reset", { key: "WalkrDonateHandledRounds" })
        .then(function() { showMessage(el, "✅ 已清除", false); loadStatus(); })
        .catch(function(err) { showMessage(el, "❌ " + err.message, true); }));
}

Object.keys(FORMS).forEach(renderForm);
["WalkrCovertBaseEnergy", "WalkrEnergyPerStep"].forEach(function(key) {
    document.getElementById("field-" + key).addEventListener("input", updateStepEstimate);
});
loadEpic();
showTab(location.hash.slice(1));
</script>
</body>
</html>`;

$done({ response: { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html } });
