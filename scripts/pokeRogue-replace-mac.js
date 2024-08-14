
if($response.body==undefined){
	$done({});
}

// 要查找的字段
let searchString = "this.gachaCursor=0;const t=this.getUi();";
// 要插入的新內容
let newString = "window.qaz = this.scene;";
let injectMenu = `

let buttonContainer = document.createElement('div');
buttonContainer.style.position = 'fixed';
buttonContainer.style.top = '1rem';
buttonContainer.style.right = '1rem';
buttonContainer.style.zIndex = '9999';
buttonContainer.style.backgroundColor = 'white';
buttonContainer.style.borderRadius = '10px';
buttonContainer.style.display = 'flex';
buttonContainer.style.flexDirection = 'column';
buttonContainer.style.gap = '0.5rem';
document.body.appendChild(buttonContainer);

let minimizeButton = document.createElement('button');
minimizeButton.innerText = 'MIN';
minimizeButton.className = "btn";
minimizeButton.style.margin = '0.25rem';
minimizeButton.style.backgroundColor = 'brown';
minimizeButton.addEventListener('click', toggleContainerSize);
buttonContainer.appendChild(minimizeButton);

function createButton(text, onClick, bgColor) {
	let button = document.createElement('button');
	button.innerText = text;
	button.style.margin = '0.25rem';
	button.addEventListener('click', onClick);
	button.className = 'btn btn-primary';
	button.style.backgroundColor = bgColor;
	buttonContainer.appendChild(button);
}

function createHr(){
	let hrr = document.createElement('hr');
	hrr.style.backgroundColor = 'black';
	hrr.style.width = '5rem';
	buttonContainer.appendChild(hrr);
}

function moneyBtn() {
	qaz.money =888888888;
}

function ballBtn(){
	qaz.pokeballCounts[4] = 888;
}

function enemyHPBtn(){
	qaz.currentBattle.enemyParty[0].hp=1;
}

createButton('money', moneyBtn, 'limegreen');
createButton('ball', ballBtn, 'red');
createButton('enemy HP', enemyHPBtn, 'deepskyblue');

let isMinimized = false;

function toggleContainerSize() {
	if (isMinimized) {
		buttonContainer.style.width = '';
		buttonContainer.style.height = '';
		buttonContainer.style.top = '1rem';
		buttonContainer.style.right = '1rem';
		minimizeButton.innerText = 'min';
		Array.from(buttonContainer.children).forEach((button, index) => {
			if (index > 0) button.style.display = 'block';
		});
	} else {
		buttonContainer.style.width = '5rem';
		buttonContainer.style.height = '2.5rem';
		buttonContainer.style.top = '1rem';
		buttonContainer.style.right = '1rem';
		minimizeButton.innerText = 'max';
		Array.from(buttonContainer.children).forEach((button, index) => {
			if (index > 0) button.style.display = 'none';
		});
	}
	isMinimized = !isMinimized;
}
`;

let body = $response.body;

// 查找指定字段的位置
let position = body.indexOf(searchString);
$notification.post('⚽️ PokeRogue','嘗試尋找插入點',`position = ${position}`);
if (position !== -1) {
    // 在指定字段之後插入新內容
    let modifiedString = body.slice(0, position + searchString.length) 
                        + newString 
                        + body.slice(position + searchString.length)
						+ injectMenu;

    // 顯示修改後的整個字串內容
    // console.log(modifiedString);
    console.log('注入成功');
    $notification.post('⚽️ PokeRogue','注入成功','關鍵字qaz');
    $done({body:modifiedString});
} else {
    console.log("未找到指定字段");
    $notification.post('⚽️ PokeRogue','注入失敗','未找到指定字段');
    $done({});
}
