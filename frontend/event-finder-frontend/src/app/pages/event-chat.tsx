import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/AuthContext";
import { SERVER_URL } from "../config/serverConfig";

interface ChatMessage {
    id: string;
    authorName: string;
    authorIsOrganizer: boolean;
    text: string;
    createdAt: string;
}

export function EventChatPage() {
    const { id } = useParams();
    const { token, userName } = useAuth();
    const [title, setTitle] = useState("");
    const [access, setAccess] = useState<"full" | "history" | "none">("none");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!token || !id) return;
        let stopped = false;
        let retry: number | undefined;

        const connect = () => {
            const url = `${SERVER_URL.replace(/^http/, "ws")}/api/v1.0/events/${id}/chat/ws?token=${encodeURIComponent(token)}`;
            const socket = new WebSocket(url);
            socketRef.current = socket;
            socket.onopen = () => {
                if (!stopped) setConnected(true);
            };
            socket.onmessage = (event) => {
                const payload = JSON.parse(event.data);
                if (payload.type === "history") {
                    setAccess(payload.access);
                    setMessages(payload.messages);
                    setError(null);
                } else if (payload.type === "message") {
                    setMessages((current) => [...current, payload.message]);
                } else if (payload.type === "error") {
                    setError(payload.message);
                }
            };
            socket.onclose = () => {
                if (stopped) return;
                setConnected(false);
                retry = window.setTimeout(connect, 2000);
            };
        };

        fetch(`${SERVER_URL}/api/v1.0/events/${id}/chat`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async (response) => {
                if (!response.ok) {
                    setAccess("none");
                    setError(response.status === 403 ? "Чат доступен организатору и участникам" : "Чат не найден");
                    return;
                }
                const data = await response.json();
                setTitle(data.title);
                setAccess(data.access);
                setMessages(data.messages);
                connect();
            })
            .catch(() => setError("Не удалось открыть чат"));

        return () => {
            stopped = true;
            if (retry) window.clearTimeout(retry);
            socketRef.current?.close();
        };
    }, [token, id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = () => {
        const text = draft.trim();
        const socket = socketRef.current;
        if (!text || !socket || socket.readyState !== WebSocket.OPEN || access !== "full") return;
        socket.send(JSON.stringify({ text }));
        setDraft("");
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header isAuthenticated={!!token} userName={userName} />
            <main className="flex-1">
                <div className="container mx-auto px-4 py-8 max-w-3xl">
                    <Link to={`/events/${id}`} className="text-sm text-muted-foreground hover:underline">
                        К мероприятию
                    </Link>
                    <h1 className="mt-2 mb-4">{title || "Чат мероприятия"}</h1>
                    {access === "history" && (
                        <p className="mb-4 text-sm text-muted-foreground">
                            Вы вышли из мероприятия и видите переписку только до момента выхода.
                        </p>
                    )}
                    {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
                    <div className="border rounded-lg h-[28rem] overflow-y-auto p-4 space-y-3 bg-card">
                        {messages.length === 0 && (
                            <p className="text-sm text-muted-foreground">Сообщений пока нет.</p>
                        )}
                        {messages.map((message) => (
                            <div key={message.id} className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium">{message.authorName}</span>
                                    {message.authorIsOrganizer && (
                                        <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs">
                                            Организатор
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">
                                        {new Date(message.createdAt).toLocaleString("ru-RU")}
                                    </span>
                                </div>
                                <p>{message.text}</p>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                    {access === "full" ? (
                        <div className="mt-4 flex gap-2">
                            <Input
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") send();
                                }}
                                placeholder="Сообщение"
                                disabled={!connected}
                            />
                            <Button onClick={send} disabled={!connected || !draft.trim()} style={{ backgroundColor: "var(--primary-color)" }}>
                                {connected ? <Send className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
}
