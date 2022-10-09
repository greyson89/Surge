// 上傳調整後的進步器資訊 稍微符合高能量的情境

let body = JSON.parse($request.body);

const d = new Date();

let needWalking = d.getHours()*2000;
let needRunning = Math.floor( Math.random()*100 );

console.log(body);

// 24小時制 如未達最低值會以該小時*2000步 如中午十二點走路步數應該是12*2000= 24000 如未達到則會加上2000步後上傳
if( needWalking > body.updated_objects[0].walking){
	body.updated_objects[0].walking += 2000;
}
// 每次隨機增加100步內的跑步
body.updated_objects[0].running += needRunning;

console.log(`🚀 步數計算修改 新步數為${body.updated_objects[0].walking}, 新跑步數為${body.updated_objects[0].running}`);
// $notification.post('🚀 Walkr',`步數計算修改`,'');

$done({body:JSON.stringify(body)});

