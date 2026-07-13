const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
if (!roomId) window.location.href = '/';

document.getElementById('inviteLink').value = window.location.href;

let clientId = localStorage.getItem('sob_client_id');
if (!clientId) {
    clientId = Math.random().toString(36).substring(2, 10);
    localStorage.setItem('sob_client_id', clientId);
}

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}?client_id=${clientId}`);

let gameState = null;
let selectedCardIndex = null;

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'error') {
        alert(data.message);
    } else if (data.type === 'gameState') {
        gameState = data.state;
        document.getElementById('inviteBox').style.display = 'none';
        document.getElementById('gameInfo').style.display = 'block';
        selectedCardIndex = null;
        renderAll();
    }
};

function renderAll() {
    if (gameState.winner) alert(`Koniec gry! Zwycięzca: ${gameState.winner}`);

    const isMyTurn = gameState.turn === gameState.my_id;
    document.getElementById('myRole').innerText = gameState.my_role;
    document.getElementById('myRole').style.color = gameState.my_role === 'Atakujacy' ? '#e74c3c' : '#3498db';
    document.getElementById('deckCount').innerText = gameState.deck_size;
    document.getElementById('discardCount').innerText = gameState.discard_pile.length;
    document.getElementById('cauldronInfo').innerText = gameState.cauldrons;
    
    let turnText = isMyTurn ? "TWOJA TURA" : "Czekaj";
    if (isMyTurn && gameState.phase === "attack_resolution") turnText += " (ATAK)";
    document.getElementById('turnInfo').innerText = turnText;
    document.getElementById('turnInfo').className = isMyTurn ? "active-turn" : "waiting-turn";

    renderHand();
    renderBoard();
}

function renderHand() {
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = '';
    
    if (gameState.phase === 'attack_resolution' && gameState.turn === gameState.my_id) {
        const skipBtn = document.createElement('button');
        skipBtn.innerText = "POMIŃ ATAK -> ZAGRAJ KARTĘ";
        skipBtn.style.padding = "15px"; skipBtn.style.fontWeight = "bold"; skipBtn.style.background = "#e67e22"; skipBtn.style.cursor = "pointer";
        skipBtn.onclick = () => ws.send(JSON.stringify({action: "skip_attack"}));
        handDiv.appendChild(skipBtn);
        return; 
    }

    gameState.hand.forEach((card, index) => {
        const cDiv = document.createElement('div');
        cDiv.className = `card hand-card ${card.color} ${index === selectedCardIndex ? 'selected' : ''}`;
        cDiv.innerText = card.value;
        cDiv.onclick = () => {
            if (gameState.turn === gameState.my_id) {
                selectedCardIndex = index;
                renderHand(); 
            }
        };
        handDiv.appendChild(cDiv);
    });
}

function renderBoard() {
    const board = document.getElementById('horizontal-board');
    board.innerHTML = '';
    const amIAttacker = gameState.my_role === 'Atakujacy';

    gameState.tiles.forEach((tile, index) => {
        const col = document.createElement('div');
        col.className = 'board-col';
        
        // Zawsze MOJE karty lądują na dole, przeciwnika u góry
        const oppCardsData = amIAttacker ? tile.defender : tile.attacker;
        const myCardsData = amIAttacker ? tile.attacker : tile.defender;

        // Kontener Górny (Przeciwnik)
        const oppArea = document.createElement('div');
        oppArea.className = 'table-cards-area opp-area';
        oppCardsData.forEach(c => oppArea.appendChild(createMiniCard(c)));

        // Środek (Kafelek na tle rzeki)
        const tileDiv = document.createElement('div');
        tileDiv.className = `tile ${tile.state}`;
        tileDiv.innerHTML = `<span>${tile.name}</span><span>${tile.capacity} KART</span><span>(${tile.rule})</span>`;
        
        tileDiv.onclick = () => {
            if (selectedCardIndex !== null && gameState.turn === gameState.my_id && gameState.phase === "play_card") {
                ws.send(JSON.stringify({ action: "play_card", card_index: selectedCardIndex, tile_index: index }));
            }
        };

        // Przyciski akcji
        if (gameState.turn === gameState.my_id && tile.state !== 'zniszczona') {
            if (amIAttacker && gameState.phase === 'attack_resolution' && tile.attacker.length === tile.capacity) {
                const atkBtn = document.createElement('button');
                atkBtn.className = 'action-btn attack-btn'; atkBtn.innerText = 'ATAKUJ';
                atkBtn.onclick = (e) => { e.stopPropagation(); ws.send(JSON.stringify({ action: "attack", tile_index: index })); };
                tileDiv.appendChild(atkBtn);
            }
            if (!amIAttacker && gameState.phase === 'play_card' && gameState.cauldrons > 0 && tile.attacker.length > 0) {
                const caulBtn = document.createElement('button');
                caulBtn.className = 'action-btn cauldron-btn'; caulBtn.innerText = 'SMOŁA';
                caulBtn.onclick = (e) => { e.stopPropagation(); ws.send(JSON.stringify({ action: "cauldron", tile_index: index })); };
                tileDiv.appendChild(caulBtn);
            }
        }

        // Kontener Dolny (Ja)
        const myArea = document.createElement('div');
        myArea.className = 'table-cards-area my-area';
        myCardsData.forEach(c => myArea.appendChild(createMiniCard(c)));

        // Układanie kolumny od góry do dołu
        col.appendChild(oppArea);
        col.appendChild(tileDiv);
        col.appendChild(myArea);
        board.appendChild(col);
    });
}

function createMiniCard(card) {
    const d = document.createElement('div');
    d.className = `card card-mini ${card.color}`;
    d.innerText = card.value;
    return d;
}

function openDiscardModal() {
    const modal = document.getElementById("discardModal");
    const list = document.getElementById("discardList");
    list.innerHTML = '';
    
    if (gameState && gameState.discard_pile.length > 0) {
        gameState.discard_pile.forEach(card => {
            const c = createMiniCard(card);
            c.style.marginTop = '0'; // W oknie odrzuconych nie chcemy, żeby nachodziły
            list.appendChild(c);
        });
    } else {
        list.innerHTML = "<p style='color: white;'>Brak odrzuconych kart.</p>";
    }
    modal.style.display = "block";
}

function closeDiscardModal() {
    document.getElementById("discardModal").style.display = "none";
}
