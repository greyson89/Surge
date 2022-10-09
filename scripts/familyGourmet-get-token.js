// 嘗試取得token

let body = JSON.parse($request.body);

if(body.mac && body.EnterPriseID && body.Account && body.TokenKey){
	$persistentStore.write(body.mac,'FamilyGourmetMac');
	$persistentStore.write(body.EnterPriseID,'FamilyGourmetEnterPriseID');
	$persistentStore.write(body.Account,'FamilyGourmetAccount');
	$persistentStore.write(body.Tokenkey,'FamilyGourmetTokenkey');
	$notification.post('🍽 全家餐飲','已更新必要Token','');
	console.log(`全家 get token success`);
}else{
	console.log(`全家 get token error`);
	console.log(body);
}

$done({body:$request.body});