// Walkr change the cube to replicator and increase coins
// Walkr 更改取得傳說獎勵，可選擇能量方塊或設計圖，金幣提高
// 可自行調整選擇
// 觸發：POST /api/v2/fleets/{id}/finish，回應 fetchable_contents 內 key 為 cubes / coins
// coins 的 value 格式為 "金幣:比率"，例如 "9300000.0:0.2325"

const DEFAULT_REWARD_MONEY = 500_000_000;
const DEFAULT_REWARD_CUBES = 5000;

function readNumber(key, fallback) {
    let raw = $persistentStore.read(key);
    let value = Number(raw);
    return raw != null && raw !== "" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function modifyCoins(content, rewardMoney) {
    let [amount, ...rest] = String(content.value).split(":");
    if (amount === "" || !Number.isFinite(Number(amount))) {
        console.log(`🚀 coins 格式無法解析，保留原值：${content.value}`);
        return null;
    }
    let newAmount = Number(amount) + rewardMoney;
    let newValue = [newAmount.toFixed(1), ...rest].join(":");
    return { content: { ...content, value: newValue }, message: `金幣增加為${newAmount}` };
}

function modifyCubes(content, rewardType, rewardCubes) {
    if (rewardType == "map") {
        return { content: { ...content, key: "replicator", value: "map" }, message: "能量方塊變更為DFR設計圖" };
    }
    return { content: { ...content, value: String(rewardCubes) }, message: `能量方塊增加為${rewardCubes}` };
}

if ($response.body == undefined) {
    $done({});
} else {
    let body = null;
    try {
        body = JSON.parse($response.body);
    } catch (error) {
        console.log(`🚀 finish 回應非 JSON，略過：${error}`);
    }
    let rewardType = $persistentStore.read("WalkrEpicRewardType") == "map" ? "map" : "cubes";
    let rewardMoney = readNumber("WalkrEpicRewardMoney", DEFAULT_REWARD_MONEY);
    let rewardCubes = readNumber("WalkrEpicRewardCubes", DEFAULT_REWARD_CUBES);

    if (body == null || !Array.isArray(body.fetchable_contents) || body.fetchable_contents.length == 0) {
        $done({});
    } else {
        let messages = [];
        let newContents = body.fetchable_contents.map((content) => {
            let result = null;
            if (content.key == "coins") {
                result = modifyCoins(content, rewardMoney);
            } else if (content.key == "cubes") {
                result = modifyCubes(content, rewardType, rewardCubes);
            }
            if (result == null) {
                return content;
            }
            messages.push(result.message);
            return result.content;
        });

        if (messages.length > 0) {
            let message = `獎勵調整成功 ${messages.join("\n")}`;
            console.log(`🚀 ${message}`);
            $notification.post("🚀 Walkr", message, "");
        }

        $done({ body: JSON.stringify({ ...body, fetchable_contents: newContents }) });
    }
}
