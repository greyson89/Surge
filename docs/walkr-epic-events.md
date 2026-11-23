# Walkr 傳說（Epic）階段資料統計

整理自 `har-test/epic/` 與 `har-test/*.har` 的 `GET fleets/current`、`POST fleets/{id}/donate`。之後取得新的傳說資料再補進表格。

更新日期：2026-11-23

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

- 最多 3 格，每用掉一格後每 60 秒回復一格（`next_hitpoint_at`、`next_hitpoint_countdown`）。
- 步驟切換時（資源 → 能量）會重置成 3 格。
- `resources` 類型送 `hitpoints:0`，伺服器照樣接受。剩餘格數雖然會被扣到負數，但不會擋。

## event_type 一覽

| `event_type` | 意義 | value 對應 | 實測使用格數 |
|---|---|---|---|
| `preparation` | 第一階段「打造太空艦隊」 | a=金幣、b=食物（推測） | 未實測 |
| `currency` | 金幣、食物 | a=金幣、b=食物 | 3 格繳需求量的 1/2（金幣 400000/800000、食物 50000/100000） |
| `resources` | 星球資源 | a/b/c 三種星球資源 | 0 格，不受限制，可以一次繳滿 |
| `virtual-coins` | 星球收取的資源，`label_a` 為資源名稱（例如防禦雨傘、放大鏡） | a=數量 | 3 格繳 100（需求量 200 的 1/2） |
| `virtual-food` | 星球收取的資源，`label_a` 為資源名稱（例如藥草） | a=數量 | 2 格繳 100（剛好是剩餘量，需求量 250） |
| `travelling` | 第二段能量（只出現在請求中） | `energy` | 1/4 需求量用 2 格，1/8 需求量用 1 格 |

`virtual-*` 繳的是星球收取的資源（使用者說明：食物會轉成星球生產的資源，資源再換成 coins），但和 `resources` 不同，會消耗耐力。`resource_b`（4000、400）的意義尚未確認，只繳 `value_a` 就會完成，繳納時不需要用到。

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

114 只有 `fleet_histories` 的完成值，沒有拿到 `fleets/current`，所以缺少 path 資料。

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
