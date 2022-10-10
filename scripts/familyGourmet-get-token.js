// 享聚卡 全家餐飲 取得Token

let body = JSON.parse($request.body);

if (body.mac && body.EnterPriseID && body.Account && body.Tokenkey) {
    $persistentStore.write(body.mac, "FamilyGourmetMac");
    $persistentStore.write(body.EnterPriseID, "FamilyGourmetEnterPriseID");
    $persistentStore.write(body.Account, "FamilyGourmetAccount");
    $persistentStore.write(body.Tokenkey, "FamilyGourmetTokenkey");
    notify("🍽 全家餐飲", "已更新必要Token", '', "已更新必要Token", null);
} else {
    notify(null, '', '', "未取得Token 可能是同名API但缺乏所需Token", body);
}

$done({ body: $request.body });

function notify(notifyTitle, notifyMsg, notifyContent, clgTitle, clgContent) {
    if (notifyTitle) {
        $notification.post(notifyTitle, notifyMsg, notifyContent);
    }
    if (clgTitle) {
        console.log(clgTitle);
        console.log(clgContent);
    }
}
