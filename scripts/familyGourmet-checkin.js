// 每日打卡
// Ver.TEST
let body = {
    isFrom: "figapp",
    act: "vipactivity",
    mac: $persistentStore.read("FamilyGourmetMac"),
    EnterPriseID: $persistentStore.read("FamilyGourmetEnterPriseID"),
    ActivityID: $persistentStore.read("FamilyGourmetActivityID"),
    Account: $persistentStore.read("FamilyGourmetAccount"),
    Tokenkey: $persistentStore.read("FamilyGourmetTokenKey"),
};

let checkinRequest = {
    url: "https://fig.jh8.tw/public/AppDataVIP.ashx",
    headers: {
        "content-type": "application/application/x-www-form-urlencoded",
    },
    body: JSON.stringify(body),
};

$httpClient.post(checkinRequest, function (error, response, data) {
    if (error) {
        $notification.post("🍽 全家餐飲", "打卡失敗1", error);
		console.log(`打卡失敗1 ${error}`);
    } else {
        if (response.status === 200) {
            try {
                const obj = JSON.parse(data);
                if (obj.ErrorMsg.incudes("今日已簽到成功")) {
                    $notification.post("🍽 全家餐飲", "打卡成功 ✅", obj.ErrorMsg);
                } else {
                    $notification.post("🍽 全家餐飲", "打卡失敗2 ‼️", obj.ErrorMsg);
					console.log(`打卡失敗2 ${obj.ErrorMsg}`);
                }
            } catch (error) {
                $notification.post("🍽 全家餐飲", "打卡失敗3", error);
				console.log(`打卡失敗3 ${error}`);
            }
        } else {
            $notification.post("🍽 全家餐飲", "打卡失敗4", error);
			console.log(`打卡失敗4 ${error}`);
        }
    }
    $done();
});
