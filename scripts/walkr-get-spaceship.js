// Walkr get special spaceship if you don't have
// Walkr 取得特殊飛船 如果尚未持有
// execute when login account

let body = JSON.parse($response.body);

// 糖果探勘號
// 破雪號
// 超級貓飛船
// 波奇歷險號
let addList = [
    {
        shipName: "rudolph",
        exist: false,
		shipChName: "聖誕馴鹿號",
    },
    {
        shipName: "flyingfish-gold",
        exist: false,
		shipChName: "飛鰭偵查艇-金",
    },
    {
        shipName: "flyingfish-bone",
        exist: false,
		shipChName: "飛鰭偵查艇-骨",
    },
    {
        shipName: "supercat-orange",
        exist: false,
		shipChName: "超級貓飛船-橘",
    },
    {
        shipName: "supercat-white",
        exist: false,
		shipChName: "超級貓飛船-白",
    },
	{
        shipName: "supercat-grey",
        exist: false,
		shipChName: "超級貓飛船-灰",
    },
	{
        shipName: "supercat-black",
        exist: false,
		shipChName: "超級貓飛船-黑",
    },
    {
        shipName: "penguin-emperor",
        exist: false,
		shipChName: "破雪號-皇帝企鵝",
    },
    {
        shipName: "candy_seeker-pumpkin",
        exist: false,
		shipChName: "糖果探勘號-南瓜",
    },
];

// 檢查是否存在
for (const ship of body.objects) {
    for (const addShip of addList) {
        if (ship.identifier === addShip.shipName) {
            addShip.exist = true;
        }
    }
}

let count = 0;
let result = "添加";
for (const addShip of addList) {
    if (addShip.exist == false) {
        body.objects.push({
            identifier: addShip.shipName,
            slot_reference: 0,
            activated_at: 0,
        });
		count++;
		result += ` ${addShip.shipChName}`;
    }
}

if(count>0){
	console.log(`🚀 ${result} 成功`);
	$notification.post('🚀 Walkr',`${result}`,'');
}else{
	console.log(`🚀 無可添加的飛船`);
}

$done({ body: JSON.stringify(body) });
