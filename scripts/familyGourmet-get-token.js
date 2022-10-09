// 嘗試取得token

let body = JSON.parse($request.body);

if(body.mac && body.EnterPriseID && body.ActivityID && body.Account && body.TokenKey){
	$persistentStore.write(body.mac,'FamilyGourmetMac');
	$persistentStore.write(body.EnterPriseID,'FamilyGourmetEnterPriseID');
	$persistentStore.write(body.ActivityID,'FamilyGourmetActivityID');
	$persistentStore.write(body.Account,'FamilyGourmetAccount');
	$persistentStore.write(body.TokenKey,'FamilyGourmetTokenKey');
	$notification.post('🍽 全家餐飲','已更新必要Token','');
}

$done({body:$request.body});