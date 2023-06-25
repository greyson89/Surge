// 上傳調整後的進步器資訊 稍微符合高能量的情境
// XXX: 似乎無效 暫時擱置

let body = JSON.parse($request.body);

const d = new Date();

let needWalking = d.getHours()*20000;
let needRunning = Math.floor( Math.random()*400 );

console.log(body);
let obj = body.updated_objects ?? body.created_objects;

// 24小時制 如未達最低值會以該小時*2000步 如中午十二點走路步數應該是12*2000= 24000 如未達到則會加上2000步後上傳
if( needWalking > obj[0].walking){
	obj[0].walking += 2000;
}
// 每次隨機增加100步內的跑步
obj[0].running += needRunning;

console.log(`🚀 步數計算修改 新步數為${obj[0].walking}, 新跑步數為${obj[0].running}`);
// $notification.post('🚀 Walkr',`步數計算修改`,'');

$done({body:JSON.stringify(body)});

