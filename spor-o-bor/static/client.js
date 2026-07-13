const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
if (!roomId) window.location.href = '/';

document.getElementById('inviteLink').value = window.location.href;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}`);

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
        selectedCardIndex = null; // Reset zaznaczenia po ruchu
        renderAll();
    }
};

function renderAll() {
    if (gameState.winner) {
        alert(`Koniec gry! Zwycięzca: ${gameState.winner}`);
    }

    // Status
    const isMyTurn = gameState.turn === gameState.my_id;
    document.getElementById('myRole').innerText = gameState.my_role;
    document.getElementById('myRole').style.color = gameState.my_role === 'Atakujacy' ? '#e74c3c' : '#3498db';
    document.getElementById('deckCount').innerText = gameState.deck_size;
    
    let turnText = isMyTurn ? "TWOJA TURA" : "Tura przeciwnika";
    if (isMyTurn && gameState.phase === "attack_resolution") turnText += " (Faza Ataku)";
    document.getElementById('turnInfo').innerText = turnText;
    document.getElementById('turnInfo').className = isMyTurn ? "active-turn" : "waiting-turn";

    if (gameState.my_role === 'Obronca') {
        document.getElementById('cauldronInfo').innerText = `Kotły ze smołą: ${gameState.cauldrons}`;
    }

    renderHand();
    renderBoard();
}

function renderHand() {
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = '';
    
    if (gameState.phase === 'attack_resolution' && gameState.turn === gameState.my_id) {
        const skipBtn = document.createElement('button');
        skipBtn.innerText = "Pomiń Atak -> Przejdź do grania kart";
        skipBtn.onclick = () => ws.send(JSON.stringify({action: "skip_attack"}));
        handDiv.appendChild(skipBtn);
        return; // Blokujemy zagrywanie kart w fazie ataku
    }

    gameState.hand.forEach((card, index) => {
        const cDiv = document.createElement('div');
        cDiv.className = `card ${card.color} ${index === selectedCardIndex ? 'selected' : ''}`;
        cDiv.innerText = card.value;
        cDiv.onclick = () => {
            if (gameState.turn === gameState.my_id) {
                selectedCardIndex = index;
                renderHand(); // Odśwież zaznaczenie
            }
        };
        handDiv.appendChild(cDiv);
    });
}

function renderBoard() {
    const damContainer = document.getElementById('dam-tiles');
    const oppArea = document.getElementById('opponent-area');
    const myArea = document.getElementById('my-area');
    
    damContainer.innerHTML = ''; oppArea.innerHTML = ''; myArea.innerHTML = '';

    gameState.tiles.forEach((tile, index) => {
        // Kolumny dla kart leżących na stole
        const oppCol = document.createElement('div'); oppCol.className = 'tile-column';
        const myCol = document.createElement('div'); myCol.className = 'tile-column';
        
        const amIAttacker = gameState.my_role === 'Atakujacy';
        const myCards = amIAttacker ? tile.attacker : tile.defender;
        const oppCards = amIAttacker ? tile.defender : tile.attacker;

        // Rysowanie kart na stole
        oppCards.forEach(c => oppCol.appendChild(createMiniCard(c)));
        myCards.forEach(c => myCol.appendChild(createMiniCard(c)));

        // Rysowanie kafelka Tamy
        const tileDiv = document.createElement('div');
        tileDiv.className = `tile ${tile.state}`;
        tileDiv.innerHTML = `<strong>${tile.name}</strong><br>${tile.capacity} karty<br>(${tile.rule})`;
        
        // Kliknięcie w kafelek = zagranie karty
        tileDiv.onclick = () => {
            if (selectedCardIndex !== null && gameState.turn === gameState.my_id && gameState.phase === "play_card") {
                ws.send(JSON.stringify({ action: "play_card", card_index: selectedCardIndex, tile_index: index }));
            }
        };

        // Przyciski akcji (Atak / Kocioł)
        if (gameState.turn === gameState.my_id && tile.state !== 'zniszczona') {
            if (amIAttacker && gameState.phase === 'attack_resolution' && tile.attacker.length === tile.capacity) {
                const atkBtn = document.createElement('button');
                atkBtn.className = 'action-btn attack-btn'; atkBtn.innerText = 'ATAKUJ';
                atkBtn.onclick = (e) => { e.stopPropagation(); ws.send(JSON.stringify({ action: "attack", tile_index: index })); };
                tileDiv.appendChild(atkBtn);
            }
            if (!amIAttacker && gameState.phase === 'play_card' && gameState.cauldrons > 0 && tile.attacker.length > 0) {
                const caulBtn = document.createElement('button');
                caulBtn.className = 'action-btn cauldron-btn'; caulBtn.innerText = 'UŻYJ SMOŁY';
                caulBtn.onclick = (e) => { e.stopPropagation(); ws.send(JSON.stringify({ action: "cauldron", tile_index: index })); };
                tileDiv.appendChild(caulBtn);
            }
        }

        damContainer.appendChild(tileDiv);
        oppArea.appendChild(oppCol);
        myArea.appendChild(myCol);
    });
}

function createMiniCard(card) {
    const d = document.createElement('div');
    d.className = `card card-mini ${card.color}`;
    d.innerText = card.value;
    return d;
}
