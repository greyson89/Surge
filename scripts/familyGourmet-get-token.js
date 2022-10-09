// 嘗試取得token

let body = JSON.parse($request.body);
console.log(`$request.body = ${typeof $request.body}`);
console.log(`body = ${typeof $request.body}`);
console.log(body);

let result = '';
if(body.mac){
	result += '取得mac\n';
	console.log(`get mac ${body.mac}`);
	$persistentStore.write(body.mac,'FamilyGourmetMac');
}else{
	result += '未取得mac\n';
	console.log(`get mac ${body.mac}`);
}
if(body.EnterPriseID){
	result += '取得enterPriseID\n';
	console.log(`get mac ${body.EnterPriseID}`);
	$persistentStore.write(body.EnterPriseID,'FamilyGourmetEnterPriseID');
}
if(body.ActivityID){
	result += '取得ActivityID\n';
	console.log(`get mac ${body.ActivityID}`);
	$persistentStore.write(body.ActivityID,'FamilyGourmetActivityID');
}
if(body.Account){
	result += '取得Account\n';
	console.log(`get mac ${body.Account}`);
	$persistentStore.write(body.Account,'FamilyGourmetAccount');
}
if(body.TokenKey){
	result += '取得TokenKey\n';
	console.log(`get mac ${body.TokenKey}`);
	$persistentStore.write(body.TokenKey,'FamilyGourmetTokenKey');
}



$notification.post('🍽 全家餐飲',result,'');

$done({body:body});