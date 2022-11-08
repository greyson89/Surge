// Walkr modify lab donate reward TEST
// https:\/\/production\.sw\.(fourdesireplay|fourdesire)\.(io|com)\/api\/v2\/labs\/[\d]{1,6}\/donate

let body = JSON.parse($response.body);

let count = body.reward_amount / 5000;

let WalkrIsExecuteDonateModify = $persistentStore.read("WalkrIsExecuteDonateModify");
let WalkrDonateRewardType = $persistentStore.read("WalkrDonateRewardType");
let WalkrDonateRewardValue = $persistentStore.read("WalkrDonateRewardValue");

if (WalkrIsExecuteDonateModify !== "true") {
    $done({ body: JSON.stringify(body) });
}

// 捐贈換回的獎勵
body.reward_amount = count * WalkrDonateRewardValue;
// 卷贈換回的獎勵類型 猜測可能有 cube or cubes, energy
body.reward_type = WalkrDonateRewardType;

// 捐贈的量（影響對方 但實際捐出還是500）
body.donation = 500;

$done({ body: JSON.stringify(body) });
