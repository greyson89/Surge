// Walkr get special spaceship if you don't have
// Walkr 取得特殊飛船 如果尚未持有
// execute when login account

let body = JSON.parse($response.body);

let addList = [
    {
        shipName: "rudolph",
        exist: false,
		shipChName: "雪橇馴鹿號",
    },
    {
        shipName: "flyingfish-gold",
        exist: false,
		shipChName: "黃金飛魚號",
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
