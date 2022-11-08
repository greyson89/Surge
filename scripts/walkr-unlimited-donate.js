// Walkr unlimited lab donate TEST

let body = JSON.parse($response.body);

body.success=false;



$done({ body: JSON.stringify(body) });

function isNumeric(val) {
    return /^\d+$/.test(parseInt(val));
}
