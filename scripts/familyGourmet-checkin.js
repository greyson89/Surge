// 每日打卡
// Ver.TEST

let mac = $persistentStore.read("FamilyGourmetMac");
let enterPriseID = $persistentStore.read("FamilyGourmetEnterPriseID");
let account = $persistentStore.read("FamilyGourmetAccount");
let tokenkey = $persistentStore.read("FamilyGourmetTokenkey");

let getActivityBody = {
    "mac": mac,
    "isFrom": "figapp",
    "Tokenkey": tokenkey,
    "EnterPriseID": enterPriseID,
    "Account": account,
    "act": "getactivity"
};

let activityID;

let req = {
    url: "https://fig.jh8.tw/public/AppDataVIP.ashx",
    headers: {
        "content-type": "application/x-www-form-urlencoded",
    },
};

req.body = JSON.stringify(getActivityBody);
$httpClient.post(req, function (error, response, data) {
    if (error) {
        $notification.post("🍽 全家餐飲", "尋找活動失敗", error);
		console.log(`尋找活動失敗1 ${error}`);
    } else {
        if (response.status === 200) {
            try {
				data = data.replace('"[',"").replace(']"',"").replaceAll("\\","");
                const obj =  JSON.parse(data);

                if (obj.Remark.ActivityTitle === "每日固定簽到活動") {
					activityID = obj.Remark.GID;
					console.log(`找到每日簽到活動 ${activityID}`);
                } else {
                    $notification.post("🍽 全家餐飲", "找不到每日簽到活動 ‼️", obj.ErrorMsg);
					console.log(`找不到每日簽到活動 ${obj}`);
                }
            } catch (error) {
                $notification.post("🍽 全家餐飲", "尋找活動失敗", error);
				console.log(`尋找活動失敗2 ${error}`);
            }
        } else {
            $notification.post("🍽 全家餐飲", "尋找活動失敗", error);
			console.log(`尋找活動失敗3 ${error}`);
        }
    }
});

if(!activityID){
	$done();
}


let checkinBody = {
    isFrom: "figapp",
    act: "vipactivity",
    mac: mac,
    EnterPriseID: enterPriseID,
    ActivityID: activityID,
    Account: account,
    Tokenkey: tokenkey,
};
console.log(`checkinBody`);
console.log(checkinBody);

req.body = JSON.stringify(checkinBody);
$httpClient.post(req, function (error, response, data) {
    if (error) {
        $notification.post("🍽 全家餐飲", "打卡失敗1", error);
		console.log(`打卡失敗1 ${error}`);
    } else {
        if (response.status === 200) {
            try {
                const obj = JSON.parse(data);
                if (obj.ErrorMsg.includes("今日已簽到成功")) {
                    $notification.post("🍽 全家餐飲", "打卡成功 ✅", obj.ErrorMsg);
                } else {
                    $notification.post("🍽 全家餐飲", "打卡失敗2 ‼️", obj.ErrorMsg);
					console.log(`打卡失敗2 ${obj}`);
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
