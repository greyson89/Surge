// 嘗試取得token

let body = $request.body;

let result = '';
if(body.mac){
	result += '取得mac\n';
	$persistStore.write(body.mac,'FamilyGourmetMac');
}
if(body.EnterPriseID){
	result += '取得enterPriseID\n';
	$persistStore.write(body.mac,'FamilyGourmetEnterPriseID');
}
if(body.ActivityID){
	result += '取得ActivityID\n';
	$persistStore.write(body.mac,'FamilyGourmetActivityID');
}
if(body.Account){
	result += '取得Account\n';
	$persistStore.write(body.mac,'FamilyGourmetAccount');
}
if(body.TokenKey){
	result += '取得TokenKey\n';
	$persistStore.write(body.mac,'FamilyGourmetTokenKey');
}



$notification.post('🍽 全家餐飲',result,'');

$done({body:body});