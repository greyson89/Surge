// 享聚卡 全家餐飲 每日打卡

let mac = $persistentStore.read("FamilyGourmetMac");
let enterPriseID = $persistentStore.read("FamilyGourmetEnterPriseID");
let account = $persistentStore.read("FamilyGourmetAccount");
let tokenkey = $persistentStore.read("FamilyGourmetTokenkey");

if (!mac || !enterPriseID || !account || !tokenkey) {
    notify("🍽 全家餐飲", "請先取得必要token", '', null, null);
    $done();
}

let getActivityBody = {
    mac: mac,
    isFrom: "figapp",
    Tokenkey: tokenkey,
    EnterPriseID: enterPriseID,
    Account: account,
    act: "getactivity",
};

let activityID;

let req = {
    url: "https://fig.jh8.tw/public/AppDataVIP.ashx",
    headers: {
        "content-type": "application/x-www-form-urlencoded",
    },
};

req.body = JSON.stringify(getActivityBody);

getActivity()
    .then(() => {
        checkin();
    })
    .catch(() => {});
$done();

function getActivity() {
    return new Promise((resolve, reject) => {
        $httpClient.post(req, function (error, response, data) {
            if (error) {
                notify("🍽 全家餐飲", "尋找活動失敗", '', "尋找活動失敗1", error);
                reject();
            } else {
                if (response.status === 200) {
                    try {
                        data = data.replace('"[', "").replace(']"', "").replaceAll("\\", "");
                        const obj = JSON.parse(data);

                        if (obj.Remark.ActivityTitle === "每日固定簽到活動") {
                            activityID = obj.Remark.GID;
                            notify("🍽 全家餐飲", "找到每日簽到活動", '', "找到每日簽到活動", activityID);
                            resolve();
                        } else {
                            notify("🍽 全家餐飲", "找不到每日簽到活動", obj.ErrorMsg, "找不到每日簽到活動", obj.ErrorMsg);
                            reject();
                        }
                    } catch (error) {
                        notify("🍽 全家餐飲", "尋找活動失敗", '', "尋找活動失敗2", error);
                        reject();
                    }
                } else {
                    notify("🍽 全家餐飲", "尋找活動失敗", '', "尋找活動失敗3", error);
                    reject();
                }
            }
        });
    });
}

function checkin() {
    if (!activityID) {
        return;
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

    req.body = JSON.stringify(checkinBody);
    $httpClient.post(req, function (error, response, data) {
        if (error) {
            notify("🍽 全家餐飲", "打卡失敗", '', "打卡失敗1", error);
        } else {
            if (response.status === 200) {
                try {
                    const obj = JSON.parse(data);
                    if (obj.ErrorMsg.includes("今日已簽到成功")) {
                        notify("🍽 全家餐飲", "打卡成功", obj.ErrorMsg, "打卡成功", null);
                    } else {
                        notify("🍽 全家餐飲", "打卡失敗", obj.ErrorMsg, "打卡失敗2", obj);
                    }
                } catch (error) {
                    notify("🍽 全家餐飲", "打卡失敗", '', "打卡失敗3", error);
                }
            } else {
                notify("🍽 全家餐飲", "打卡失敗", '', "打卡失敗4", error);
            }
        }
    });
}

function notify(notifyTitle, notifyMsg, notifyContent, clgTitle, clgContent) {
    if (notifyTitle) {
        $notification.post(notifyTitle, notifyMsg, notifyContent);
    }
    if (clgTitle) {
        console.log(clgTitle);
        console.log(clgContent);
    }
}
