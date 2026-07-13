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
            await websocket.send_text(json.dumps({"type": "error", "message": "Pokój jest pełny!"}))
            await websocket.close()
            return False
            
        room["players"].append(websocket)
        return True

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            if websocket in self.rooms[room_id]["players"]:
                self.rooms[room_id]["players"].remove(websocket)
            if len(self.rooms[room_id]["players"]) == 0:
                del self.rooms[room_id]

    async def broadcast_game_state(self, room_id: str):
        room = self.rooms[room_id]
        if len(room["players"]) == 2:
            for i, ws in enumerate(room["players"]):
                role = "Atakujacy" if i == 0 else "Obronca"
                await ws.send_text(json.dumps({
                    "type": "gameStart",
                    "role": role,
                    "message": "Gra się rozpoczęła!"
                }))

manager = ConnectionManager()

@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")

@app.get("/create-room")
async def create_room():
    room_id = str(uuid.uuid4())[:8]
    return {"room_id": room_id}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    is_connected = await manager.connect(websocket, room_id)
    if not is_connected:
        return
        
    try:
        await manager.broadcast_game_state(room_id)
        while True:
            data = await websocket.receive_text()
            print(f"Otrzymano: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
