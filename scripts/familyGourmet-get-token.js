// 嘗試取得token

let body = $request.body;

let result = '';
if(body.mac){
	result += '取得mac\n';
}
if(body.EnterPriseID){
	result += '取得enterPriseID\n';
}
if(body.ActivityID){
	result += '取得ActivityID\n';
}
if(body.Account){
	result += '取得Account\n';
}
if(body.TokenKey){
	result += '取得TokenKey\n';
}

$notification.post('🍽 全家餐飲',result,'');

$done({body:JSON.stringify(body)});