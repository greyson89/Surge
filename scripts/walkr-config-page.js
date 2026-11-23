// Walkr Config Page - 傳說自動繳納管理介面
// 攔截 walkr.mysurge.com 首頁，回傳 HTML；頁面透過同網域 API 操作：
//   /api/read、/api/write → walkr-config-api.js（讀寫 WalkrEpic* 參數）
//   /api/epic/status、/api/epic/run、/api/epic/test → walkr-epic-auto-contribute.js

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Walkr 傳說管理</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    background: linear-gradient(135deg, #0b1d26 0%, #12343f 50%, #0b1d26 100%);
    min-height: 100vh; padding: 20px 16px; color: #e0e0e0;
}
.container { max-width: 500px; margin: 0 auto; }
h1 {
    text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 24px; letter-spacing: 1px;
    background: linear-gradient(90deg, #6ee7d8, #b4f0a8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.card {
    background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(110, 231, 216, 0.25);
    border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.card-title { font-size: 15px; font-weight: 600; color: #6ee7d8; margin-bottom: 14px; }
.hint { font-size: 12px; color: #8aa; margin-bottom: 12px; line-height: 1.6; }
label { display: block; font-size: 13px; color: #aaa; margin-bottom: 6px; font-weight: 500; }
input[type="number"], input[type="text"], select {
    width: 100%; padding: 12px 14px; font-size: 15px; margin-bottom: 14px;
    border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px;
    background: rgba(255, 255, 255, 0.06); color: #fff; outline: none; -webkit-appearance: none;
}
select option { color: #000; }
.row { display: flex; gap: 10px; }
.row > * { flex: 1; }
button {
    width: 100%; padding: 13px; font-size: 15px; font-weight: 600; border: none; border-radius: 10px;
    cursor: pointer; color: #062a2a; background: linear-gradient(90deg, #6ee7d8, #b4f0a8);
}
button.secondary { background: rgba(255, 255, 255, 0.12); color: #e0e0e0; }
button.danger { background: linear-gradient(90deg, #f6a96b, #f07272); color: #2a0a0a; }
button:disabled { opacity: 0.5; }
.switch-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.badge { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
.badge.on { background: rgba(110, 231, 216, 0.2); color: #6ee7d8; }
.badge.off { background: rgba(240, 114, 114, 0.2); color: #f07272; }
.result {
    margin-top: 14px; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.7;
    background: rgba(0, 0, 0, 0.25); white-space: pre-wrap; word-break: break-all; display: none;
}
.result.error { color: #f07272; }
.result .title { font-weight: 600; color: #fff; }
.result .time { color: #8aa; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
    <h1>🚀 Walkr 傳說管理</h1>

    <div class="card">
        <div class="card-title">繳納狀態</div>
        <div class="hint">「預覽」只讀取目前狀態與預計繳納內容；「立即繳納」會實際送出，不受自動執行開關限制。</div>
        <div class="row">
            <button class="secondary" id="btnStatus" onclick="callEpic('status', this)">預覽</button>
            <button id="btnRun" onclick="callEpic('run', this)">立即繳納</button>
        </div>
        <div class="result" id="epicResult"></div>
    </div>

    <div class="card">
        <div class="card-title">自動繳納設定</div>
        <div class="switch-row">
            <label style="margin:0">自動執行（cron）</label>
            <span class="badge" id="autoBadge" onclick="toggleAuto()">讀取中</span>
        </div>
        <label for="mode">模式</label>
        <select id="mode">
            <option value="standard">標準（依耐力規則）</option>
            <option value="unlimited">無限（0 格一次繳滿）</option>
        </select>
        <div class="hint">標準：第一段每項用 3 格繳需求量的 1/2，能量用 2+1 格繳 1/4 + 1/8。無限：需先用單次測試確認伺服器接受。</div>
        <label for="sharePercent">第一段個人上限（每項需求量的 %，1~100）</label>
        <input type="number" id="sharePercent" min="1" max="100" placeholder="100">
        <div class="hint">星球資源一律 0 格繳納；能量不受個人上限限制。</div>
        <button onclick="saveSettings(this)">儲存設定</button>
        <div class="result" id="settingsResult"></div>
    </div>

    <div class="card">
        <div class="card-title">單次測試繳納</div>
        <div class="hint">依下方參數送出一筆繳納請求並顯示伺服器原始回應，用來測試耐力與數量限制。會實際送到伺服器。</div>
        <label for="testItem">項目</label>
        <select id="testItem">
            <option value="">自動（目前步驟第一個未完成項目）</option>
            <option value="a">value_a（金幣 / 星球資源 A / 物品）</option>
            <option value="b">value_b（食物 / 星球資源 B）</option>
            <option value="c">value_c（星球資源 C）</option>
            <option value="energy">能量</option>
        </select>
        <div class="row">
            <div>
                <label for="testAmount">數量（空白 = 剩餘需求量）</label>
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
</div>

<script>
var API_BASE = "/api";
var autoEnabled = true;

function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
}

function readKey(key) {
    return fetch(API_BASE + "/read?key=" + encodeURIComponent(key))
        .then(function(r) { return r.json(); })
        .then(function(data) { return data.value; });
}

function writeKey(key, value) {
    return fetch(API_BASE + "/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key, value: value })
    }).then(function(r) { return r.json(); }).then(function(data) {
        if (!data.success) { throw new Error(data.message || "寫入失敗"); }
        return data;
    });
}

function showRecord(el, record) {
    el.style.display = "block";
    el.className = "result" + (record.isError ? " error" : "");
    var time = record.time ? new Date(record.time).toLocaleString("zh-TW", { hour12: false }) : "";
    el.innerHTML = '<div class="time">' + escapeHtml(time) + "</div>" +
        '<div class="title">' + escapeHtml(record.subtitle) + "</div>" +
        escapeHtml((record.lines || []).join("\\n"));
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

function callEpic(action, btn) {
    var el = document.getElementById("epicResult");
    return withLoading(btn, fetch(API_BASE + "/epic/" + action)
        .then(function(r) { return r.json(); })
        .then(function(record) { showRecord(el, record); })
        .catch(function(err) { showMessage(el, "❌ " + err, true); }));
}

function renderAuto() {
    var badge = document.getElementById("autoBadge");
    badge.textContent = autoEnabled ? "已開啟" : "已關閉";
    badge.className = "badge " + (autoEnabled ? "on" : "off");
}

function toggleAuto() {
    var next = !autoEnabled;
    writeKey("WalkrEpicAutoEnabled", next ? "true" : "false")
        .then(function() { autoEnabled = next; renderAuto(); })
        .catch(function(err) { showMessage(document.getElementById("settingsResult"), "❌ " + err.message, true); });
}

function saveSettings(btn) {
    var el = document.getElementById("settingsResult");
    var percentText = document.getElementById("sharePercent").value.trim();
    var percent = percentText === "" ? 100 : Number(percentText);
    if (!(percent >= 1 && percent <= 100)) {
        return showMessage(el, "❌ 個人上限需介於 1~100", true);
    }
    withLoading(btn, Promise.all([
        writeKey("WalkrEpicMode", document.getElementById("mode").value),
        writeKey("WalkrEpicSharePercent", String(percent))
    ]).then(function() { showMessage(el, "✅ 已儲存", false); })
      .catch(function(err) { showMessage(el, "❌ " + err.message, true); }));
}

function runTest(btn) {
    var el = document.getElementById("testResult");
    var hitpointsText = document.getElementById("testHitpoints").value.trim();
    if (!confirm("確定要送出測試繳納？")) { return; }
    withLoading(btn, Promise.all([
        writeKey("WalkrEpicTestItem", document.getElementById("testItem").value),
        writeKey("WalkrEpicTestAmount", document.getElementById("testAmount").value.trim()),
        writeKey("WalkrEpicTestHitpoints", hitpointsText === "" ? "1" : hitpointsText)
    ]).then(function() { return fetch(API_BASE + "/epic/test"); })
      .then(function(r) { return r.json(); })
      .then(function(record) { showRecord(el, record); })
      .catch(function(err) { showMessage(el, "❌ " + err.message, true); }));
}

function loadSettings() {
    readKey("WalkrEpicAutoEnabled").then(function(v) { autoEnabled = v !== "false"; renderAuto(); });
    readKey("WalkrEpicMode").then(function(v) { document.getElementById("mode").value = v === "unlimited" ? "unlimited" : "standard"; });
    readKey("WalkrEpicSharePercent").then(function(v) { document.getElementById("sharePercent").value = v || "100"; });
    readKey("WalkrEpicTestItem").then(function(v) { document.getElementById("testItem").value = v || ""; });
    readKey("WalkrEpicTestAmount").then(function(v) { document.getElementById("testAmount").value = v || ""; });
    readKey("WalkrEpicTestHitpoints").then(function(v) { document.getElementById("testHitpoints").value = v === "" ? "1" : v; });
    readKey("WalkrEpicLastResult").then(function(v) {
        if (v) { showRecord(document.getElementById("epicResult"), JSON.parse(v)); }
    });
}

loadSettings();
</script>
</body>
</html>`;

$done({ response: { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: html } });
