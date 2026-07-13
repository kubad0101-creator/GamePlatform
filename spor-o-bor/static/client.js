const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (!roomId) {
    window.location.href = '/';
}

document.getElementById('inviteLink').value = window.location.href;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}`);

ws.onopen = () => {
    console.log("Połączono z pokojem: " + roomId);
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'error') {
        alert(data.message);
        window.location.href = '/';
    }
    
    if (data.type === 'gameStart') {
        document.getElementById('myRole').innerText = `Twoja rola: ${data.role}`;
        document.getElementById('inviteLink').style.display = 'none';
        renderDam();
    }
};

function renderDam() {
    const damContainer = document.getElementById('dam-tiles');
    damContainer.innerHTML = '';
    
    for(let i=0; i<7; i++) {
        const tileDiv = document.createElement('div');
        tileDiv.classList.add('tile');
        damContainer.appendChild(tileDiv);
    }
}
