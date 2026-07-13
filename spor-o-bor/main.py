from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import uuid
import json
from game_engine import GameEngine

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

class ConnectionManager:
    def __init__(self):
        self.rooms = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {"engine": GameEngine(), "players": []}
            
        room = self.rooms[room_id]
        if len(room["players"]) >= 2:
            await websocket.send_text(json.dumps({"type": "error", "message": "Pokój pełny!"}))
            await websocket.close()
            return False
            
        room["players"].append(websocket)
        return True

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms and websocket in self.rooms[room_id]["players"]:
            self.rooms[room_id]["players"].remove(websocket)
            if len(self.rooms[room_id]["players"]) == 0:
                del self.rooms[room_id]

    async def broadcast_state(self, room_id: str):
        room = self.rooms[room_id]
        if len(room["players"]) == 2:
            engine = room["engine"]
            for i, ws in enumerate(room["players"]):
                pid = "p1" if i == 0 else "p2"
                try:
                    await ws.send_text(json.dumps({"type": "gameState", "state": engine.get_state(pid)}))
                except:
                    pass

manager = ConnectionManager()

@app.get("/")
async def root(): return RedirectResponse(url="/static/index.html")

@app.get("/create-room")
async def create_room(): return {"room_id": str(uuid.uuid4())[:8]}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    if not await manager.connect(websocket, room_id): return
    
    try:
        await manager.broadcast_state(room_id)
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            room = manager.rooms[room_id]
            engine = room["engine"]
            
            p_idx = room["players"].index(websocket)
            pid = "p1" if p_idx == 0 else "p2"

            try:
                if msg["action"] == "play_card":
                    engine.play_card(pid, msg["card_index"], msg["tile_index"])
                elif msg["action"] == "attack":
                    engine.attempt_attack(pid, msg["tile_index"])
                elif msg["action"] == "skip_attack":
                    engine.skip_attack(pid)
                elif msg["action"] == "cauldron":
                    engine.use_tar_cauldron(pid, msg["tile_index"])
            except ValueError as e:
                await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))

            await manager.broadcast_state(room_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
