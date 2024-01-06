// Walkr change the cube to replicator and increase coins
// Walkr 更改取得傳說獎勵，可選擇能量方塊或設計圖，金幣提高
// 可自行調整選擇

if ($response.body == undefined) {
    $done({});
} else {
    let body = JSON.parse($response.body);
	let WalkrEpicRewardType = $persistentStore.read("WalkrEpicRewardType");
	if(WalkrEpicRewardType == undefined || WalkrEpicRewardType == null ){
		WalkrEpicRewardType = "cubes";
	}else{
		WalkrEpicRewardType = "map";
	}

    let isTarget = true;
    if (body.fetchable_contents == undefined) {
        isTarget = false;
    } else if (body.fetchable_contents.length == 0) {
        isTarget = false;
    }

    if (isTarget) {
        let vSplit = body.fetchable_contents[1].value.split(".");
        let newValue = Number(vSplit[0]) + 200000000;
        body.fetchable_contents[1].value = `${newValue}.${vSplit[1]}.${vSplit[2]}`;

        if (WalkrEpicRewardType == "cubes") {
            let newCubes = 400000;
            body.fetchable_contents[0].value = newCubes;

            console.log(`🚀 獎勵調整成功 能量方塊增加為${newCubes}\n金幣增加為${newValue}`);
            $notification.post("🚀 Walkr", `獎勵調整成功 能量方塊增加為${newCubes}\n金幣增加為${newValue}`);
        } else if (WalkrEpicRewardType == "map") {
            body.fetchable_contents[0].key = "replicator";
            body.fetchable_contents[0].value = "map";

            console.log(`🚀 獎勵調整成功 能量方塊變更為DFR設計圖\n金幣增加為${newValue}`);
            $notification.post("🚀 Walkr", `獎勵調整成功 能量方塊變更為DFR設計圖\n金幣增加為${newValue}`, "");
        }
    }

    $done({ body: JSON.stringify(body) });
}
