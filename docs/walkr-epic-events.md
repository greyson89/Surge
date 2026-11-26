# Walkr 傳說（Epic）階段資料統計

整理自 `har-test/epic/` 與 `har-test/*.har` 的 `GET fleets/current`、`POST fleets/{id}/donate`。之後取得新的傳說資料再補進表格。

更新日期：2026-11-24

## 階段結構

每個階段（event）分兩步，由 `fleets/current` 的 `event_status` 判斷：

| 步驟 | `event_status` | 需求 | 目前進度 |
|---|---|---|---|
| 第一段：繳納資源 | `event` | `event.resource_a/b/c`（null 表示沒有這一項） | `fleet.value_a/b/c`（全隊合計） |
| 第二段：繳納能量 | `path` | `path.required_energy` | `fleet.energy + fleet.consumed_energy` |

- 第二段的能量會在 `path.time` 小時內，依 `required_energy / time` 的速度從 `fleet.energy` 燒掉，燒掉的部分累計在 `consumed_energy`。
- `fleet.energy` 燒完但總量還沒達到需求時，飛船會停住。所以「等待飛船」就是 `path` 狀態下的燃燒時間，總繳納量足夠時不需要再繳。
- `consumed_energy == required_energy` 時進入下一個 event，`path.target_id` 是下一個 event 的 id。
- 自己在本步驟已經繳了多少：`hitpoints.value_a/b/c`（只有第一段會記錄）。

## 繳納 API

`POST /api/v2/fleets/{fleetId}/donate`，body 是裝置資訊再加上以下欄位：

| 步驟 | 欄位 |
|---|---|
| 第一段 | `event_status:"event"`、`event_id`、`event_type`、`value_a/b/c`（一次只放一項，其他填 0）、`hitpoints` |
| 第二段 | `event_status:"path"`、`event_type:"travelling"`、`event_id`、`energy`、`hitpoints` |

- 請求的 `hitpoints` 是**這次要用掉的格數**。回應的 `hitpoints.hitpoints` 是剩餘格數。
- 成功時回應 `{"success":true,"refresh":<步驟是否完成>,"donated_value"|"energy":...,"hitpoints":{...}}`。
- 格數不足時回應 `{"success":false,"message":"not enough hitpoints"}`，HTTP 狀態仍是 200。
- 伺服器會把繳納量截到剩餘需求（例如送 41391，只收 35000）。

## 耐力（hitpoints）

- `next_hitpoint_at` 是下一格回復的伺服器時間（epoch 秒），等於讀取時間（`last_consumed_at`）加上 `next_hitpoint_countdown`；耐力滿時分別是 0 和 null（2026-11-23 HAR 確認）。
- 最多 3 格，每用掉一格後每 60 秒回復一格（`next_hitpoint_at`、`next_hitpoint_countdown`）。
- 步驟切換時（資源 → 能量）會重置成 3 格。
- `resources` 類型送 `hitpoints:0`，伺服器照樣接受。剩餘格數雖然會被扣到負數，但不會擋。

## event_type 一覽

| `event_type` | 意義 | value 對應 | 實測使用格數 |
|---|---|---|---|
| `preparation` | 第一階段「打造太空艦隊」 | a=金幣、b=食物（推測） | 未實測 |
| `currency` | 金幣、食物 | a=金幣、b=食物 | 有食物的關卡：3 格繳需求量的 1/2（金幣 400000/800000、食物 50000/100000）；只有金幣（`resource_b: 0`）的關卡：3 格繳 1/2 被拒，app 選項為 2 格 1/4、1 格 1/8（見下方「只有金幣的 currency 關卡」） |
| `resources` | 星球資源 | a/b/c 三種星球資源 | 0 格，不受限制，可以一次繳滿 |
| `virtual-coins` | 星球收取的資源，`label_a` 為資源名稱（例如防禦雨傘、放大鏡） | a=數量 | 3 格繳 100（需求量 200 的 1/2） |
| `virtual-food` | 星球收取的資源，`label_a` 為資源名稱（例如藥草） | a=數量 | 2 格繳 100（剛好是剩餘量，需求量 250） |
| `voting` | 選擇題，由全隊投票，過半數或時間到才決定路線；`label_a/b/c` 為選項文字 | 選哪一項就送該項 `value_x:1`，其他 0 | 0 格 |
| `travelling` | 第二段能量（只出現在請求中） | `energy` | 1/4 需求量用 2 格，1/8 需求量用 1 格 |

`virtual-*` 繳的是星球收取的資源（使用者說明：食物會轉成星球生產的資源，資源再換成 coins），但和 `resources` 不同，會消耗耐力。`resource_b`（4000、400）的意義尚未確認，只繳 `value_a` 就會完成，繳納時不需要用到。

### 單次測試結果（無限模式是否可行）

| 時間 | 類型 | 送出 | 當時耐力 | 回應 | 結論 |
|---|---|---|---|---|---|
| 2026-11-24 15:02 | currency（event 121） | 金幣 400,000（剩餘量）、`hitpoints:0` | 2 格 | `{"success":false,"refresh":false,"message":"Unknown"}` | 伺服器拒絕 |
| 2026-11-24 | currency（event 121） | 金幣 1,000、`hitpoints:0` | — | 失敗 | 伺服器拒絕 |
| 2026-11-24 | currency（event 121） | 金幣 400,000、`hitpoints:1` | — | 失敗 | 伺服器拒絕（不會截成 1 格允許的量） |

- 結論：伺服器會檢查格數和數量，0 格（即使數量很小）或數量超過格數允許的量，都會整筆拒絕，不會自動截斷。currency 只能照 app 的選項繳，無限模式在 currency 不可行。
- 同一關由腳本 cron 用 3 格繳金幣 400,000 成功（使用者確認），這是第一次在手機上確認自動繳納有效。
- virtual-* 和能量沒有實測，使用者依遊戲經驗判斷一樣會被擋，2026-11-24 移除無限模式。

### 只有金幣的 currency 關卡（2026-11-25、11-26）

| 關卡 | 需求 | 送出 | 結果 |
|---|---|---|---|
| 117 偵查兵的補給部隊、121 進攻巨龍王 | 800,000／100,000 | 金幣 400,000（3 格） | ✅ |
| 126 從水路出發（傳說 12 水路線） | 900,000／0 | 金幣 450,000（3 格），進度 0 與 337,500 時各一次 | ❌ `Unknown` |
| 塔克警察出面制止 | 800,000／0 | 金幣 400,000（3 格），進度 0～300,000 共 24 次 | ❌ `Unknown` |
| 塔克警察出面制止 | 800,000／0 | 金幣 100,000（3 格，剩餘量） | ✅ |

- event 126 的 `event_type` 確認是 `currency`（原始回應），不是類型不同。
- app 截圖（耐力 3 格、進度 562,500/900,000）只給 1 格的 1/128～1/8 與 2 格的 1/4，沒有 3 格選項。
- 3 格繳 100,000 成功：伺服器只檢查數量不超過該格數的上限，小於上限也接受。
- 只有金幣時 3 格的實際上限尚未確認（1/8 可以、1/2 不行）。
- 腳本處理（2026-11-26）：先照標準送 3 格 1/2，回 `Unknown` 時重新讀取，改用 2 格 1/4 + 1 格 1/8（與能量相同）。

## 選擇題（voting）

截圖：題目「要如何採取行動？」、副標題「攻打他或救救他？」，選項「攻打他」「救救他」，倒數約 24 小時。

- 投票請求（巨龍王 event 120，選「攻打他」）：`event_status:"event"`、`event_type:"voting"`、`event_id:120`、`value_a:1`、`value_b:0`、`value_c:0`、`hitpoints:0`，回應 `{"success":true,"refresh":false}`。
- 選擇題當下的 `fleets/current`（2026-11-24 04:18，已投「攻打他」後擷取）：
  - `event`：`name` 為題目（「要如何採取行動？」）、`description` 為副標題（「攻打他或救救他？」）、`label_a/b` 為選項文字、`resource_*` 都是 null。
  - `fleet.value_a/b` 是各選項票數（1／0，10 人中只有自己投票）；`hitpoints.value_a/b` 是自己投的選項（`value_a:1`），上一個事件的繳納量不會殘留。
  - 投票期間就有 `path`（id 104、`target_id` 121、6 小時、36,000 能量）；`event_status` 仍是 `event`。決定路線後 `target_id` 是否改變還沒觀察到。
  - 回應中沒有截止時間欄位。`fleet.started_at`（02:35:44）是這個事件的開始時間，截圖在 02:42 顯示「剩下 23h 53m」，所以截止時間是 `started_at + 24 小時`（只有一筆樣本）。
- 路線決定後、飛行中的 `fleets/current`（2026-11-24 13:10 擷取，巨龍王 event 120）：
  - `event_status` 變成 `path`，`event` 仍是選擇題本身（id 120、`event_type:"voting"`、`label_a/b` 不變）。
  - `fleet.value_a/b` 保留最後票數（攻打他 5、救救他 1，10 人中 6 人投票），結果走「攻打他」。
  - `fleet_histories` 多一筆 id 120：`event_type:"voting"`、`value_a/b` 是最後票數、`solved_at` 是決定時間（08:56:44）。
  - `path` 跟投票中完全相同（id 104、`target_id` 121、6 小時、36,000 能量），所以 `target_id` 投票中就固定，不能用來判斷結果；要等抵達下一個事件，看事件名稱是否為攻打路線的「進攻巨龍王」。
  - `fleet.started_at` 變成 08:56:44（= `solved_at`），代表 `started_at` 是**目前步驟**的開始時間，不是事件的開始時間。用它驗證燃燒速度：到 13:10:23 經過 15,219 秒 × 36,000/21,600 = 25,365，實際 `consumed_energy` 25,330，相差約 21 秒。
  - `hitpoints` 重置成 3 格、`value_*` 全是 0。
  - 決定時間：投票從 02:35:44 開始，08:56:44 就決定（約 6 小時 21 分，沒有等到 24 小時）。當時只有 5 票投「攻打他」，未達 `floor(10/2)+1 = 6` 票，所以門檻推定是「一半」（`ceil(n/2)` = 5 票），腳本預覽已改用這個值；只有這一筆樣本，奇數人數的情況還沒看過。
- 腳本要投的路線設定在 `walkr-epic-auto-contribute.js` 的 `VOTING_CHOICES`；所有傳說的選擇題與各路線資源見 `docs/walkr-epic-routes.md`。
- 選項 A／B 對應 `value_a`／`value_b`（截圖中 `A.`／`B.` 開頭的事件就是投票結果的路線，走完後合併回主線；前綴是整理者加的分類，遊戲內的事件名稱沒有）。

## 能量選項

app 的選項是 `required_energy` 乘以下列比例（截圖：需求量 36000）：

| 比例 | 36000 | 30000 | 24000 | 使用格數 |
|---|---|---|---|---|
| 1/4 | 9000 | 7500 | 6000 | 2 |
| 1/8 | 4500 | 3750 | 3000 | 1 |
| 1/16 | 2250 | 1875 | 1500 | 1 |
| 1/32 | 1125 | 937 | 750 | 1 |
| 1/64 | 562 | 468 | 375 | 1 |
| 1/128 | 281 | 234 | 187 | 1 |

3 格最多可以繳 1/4 + 1/8 = 需求量的 3/8。

## 傳說：征討熔岩山脈的憤怒巨龍王（epic id 12）

`journey` 182、成員 4～10 人。

| event id | 名稱 | event_type | 物品 | resource_a | resource_b | resource_c | 下一段 path 能量 | path 時間（小時） |
|---|---|---|---|---|---|---|---|---|
| 113 | 打造太空艦隊 | preparation | | 2,200,000 | 180,000 | | 12,000 | 2 |
| 114 | 冰霜國度遇襲 | virtual-coins | 防禦雨傘 | 240（完成值） | | | | |
| 115 | 冰雪公主煩惱的生病了 | virtual-food | 藥草 | 250 | 400 | | 24,000 | 4 |
| 116 | 國王派出史萊姆偵查兵 | resources | | 38,000 | 35,000 | 38,000 | 24,000 | 4 |
| 117 | 偵查兵的補給部隊 | currency | | 800,000 | 100,000 | | 24,000 | 4 |
| 118 | 購買放大鏡 | virtual-coins | 放大鏡 | 200 | 4,000 | | 30,000 | 5 |
| 119 | 打噴嚏的巨龍王 | resources | | 40,000（完成值） | 20,000 | 30,000 | | |
| 120 | 要如何採取行動？ | voting | 攻打他／救救他 | | | | 36,000 | 6 |
| 121 | 進攻巨龍王（攻打路線第一關） | currency | | 800,000 | 100,000 | | 36,000 | 6 |

114 只有 `fleet_histories` 的完成值，沒有拿到 `fleets/current`，所以缺少 path 資料。

抵達分支第一關（2026-11-24 擷取，event 121）：

- 投票選「攻打他」後抵達「進攻巨龍王」，名稱、類型與需求量（金幣 800,000、食物 100,000）都和 `docs/walkr-epic-routes.md` 的 `A.進攻巨龍王` 一致，確認遊戲內名稱沒有 `A.` 前綴。
- 新的 `path`（id 106）`target_id` 是 123，跳過 122；推測 122 是「救救他」路線的第一關，123 是攻打路線的下一關「準備軍糧丸」（尚未確認）。
- `fleet_histories` 新增 120（voting），`value_a/b` 是最後票數 5／1。
- `fleet.started_at` 等於 `last_consumed_at`，是抵達的時間。
- event 狀態下 `fleet.consumed_energy` 會保留**上一段** path 的燃燒量（這次 36,000，`energy` 0），進入 `path` 狀態時才歸零（舊的 HAR 也是如此，例如 118 在 event 時 `consumed` 24,000、`path.required_energy` 30,000）。腳本只在 `path` 狀態使用 `consumed_energy`，不受影響。
- 用這筆回應模擬腳本：預覽與繳納都是「金幣 400,000（3 格）」，飛行顯示「第一段完成後需飛行 6 小時、需要 36,000 能量」，送出的 body 為 `event_type:"currency"`、`event_id:121`、`value_a:400000`、`hitpoints:3`。

## 完成獎勵（`POST fleets/{id}/finish`）

2026-11-21 HAR（巨龍王 fleet 10609920）的回應：

```json
{"success":true,"rate":0.2325,"fetchable_contents":[
  {"id":208407207,"content_type":"goal:participate:12","key":"cubes","value":"400",...},
  {"id":208407208,"content_type":"goal:contribution:12","key":"coins","value":"9300000.0:0.2325",...}]}
```

- 兩筆獎勵都對應 `GET /epics` 的欄位：
  - `goal:participate:{epic}` 是參與獎勵，`key`／`value` 等於 `participate_type`／`participate_value`。只有 DFR 工廠之旅（14）是 `replicator`／`map`（設計圖），其他傳說都是 `cubes`／數量（巨龍王 400）。
  - `goal:contribution:{epic}` 是貢獻獎勵：`contribution_value × rate`（40,000,000 × 0.2325 = 9,300,000），`value` 格式為 `金幣:比率`。
- `rewards_type`／`rewards_value`（星球）沒有出現在 finish 回應裡。這個帳號的傳說都已 `solved`，推測星球只在第一次完成時給。
- `walkr-change-epic-reward.js` 選設計圖時，會把參與獎勵那一筆改成 `key:"replicator"`、`value:"map"`，也就是 DFR 工廠之旅的參與獎勵格式。這是**取代**能量方塊，不是另外加一筆，所以領到的是「金幣 + 設計圖」，沒有能量方塊。
- 還沒看過 DFR 工廠之旅實際的 finish 回應，也還沒確認改成設計圖後 app 是否真的入帳。

## 傳說列表（`GET /epics`）

| id | 名稱 | journey | 人數 | 建立貢獻（coins） | 獎勵 |
|---|---|---|---|---|---|
| 2 | 憤怒的玉米星人 | 96 | 3～8 | 20,000,000 | planet popcorn |
| 3 | 星際考古任務 | 78 | 3～8 | 15,000,000 | planet roman |
| 4 | 食物巨大化計畫 | 60 | 2～8 | 10,000,000 | planet burger |
| 5 | 來自故鄉的思念 | 132 | 4～10 | 30,000,000 | planet bone |
| 6 | 被綁架的工程師 | 114 | 3～10 | 25,000,000 | planet racing |
| 7 | 在宇宙邊緣漂浮 | 150 | 4～10 | 35,000,000 | planet cloud |
| 10 | 中國殭屍與西洋殭屍 | 40 | 2～6 | 5,000,000 | planet tomb |
| 11 | 宇宙間的空間轉換技術 | 116 | 3～10 | 25,000,000 | planet stoneage |
| 12 | 征討熔岩山脈的憤怒巨龍王 | 182 | 4～10 | 40,000,000 | planet dragon |
| 13 | 航向世界的盡頭 | 108 | 3～8 | 23,000,000 | planet viking |
| 14 | DFR 工廠之旅 | 68 | 2～6 | 10,000,000 | replicator map |
| 15 | 小酒館的對決 | 100 | 3～8 | 20,000,000 | planet cowboy |
| 16 | 燈靈節 | 50 | 2～6 | 7,000,000 | planet jiufen |
| 17 | 解放被封印的年獸 | 140 | 4～10 | 33,000,000 | planet seal |
| 18 | 最適合冬天的暖心食譜 | 70 | 3～8 | 15,000,000 | planet matcha |
| 19 | 來自月球的神祕信號 | 176 | 4～10 | 38,000,000 | planet apollo |
| 20 | 護送迷途的星際旅人 | 56 | 2～8 | 10,000,000 | planet bt_party |
