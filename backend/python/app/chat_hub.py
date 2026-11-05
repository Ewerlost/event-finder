from fastapi import WebSocket


class ChatHub:
    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}
        self.info: dict[WebSocket, dict] = {}

    async def connect(self, event_id: str, websocket: WebSocket, meta: dict) -> None:
        await websocket.accept()
        self.rooms.setdefault(event_id, set()).add(websocket)
        self.info[websocket] = meta

    def disconnect(self, event_id: str, websocket: WebSocket) -> None:
        self.rooms.get(event_id, set()).discard(websocket)
        self.info.pop(websocket, None)

    def set_left_at(self, websocket: WebSocket, left_at) -> None:
        if websocket in self.info:
            self.info[websocket]["left_at"] = left_at

    async def broadcast(self, event_id: str, payload: dict, created_at) -> None:
        dead: list[WebSocket] = []
        for websocket in list(self.rooms.get(event_id, set())):
            meta = self.info.get(websocket, {})
            left_at = meta.get("left_at")
            if left_at is not None and created_at > left_at:
                continue
            try:
                await websocket.send_json(payload)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(event_id, websocket)


hub = ChatHub()
