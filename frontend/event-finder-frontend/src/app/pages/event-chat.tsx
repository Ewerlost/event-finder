import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Megaphone, Send } from "lucide-react";
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
    kind?: string;
    text: string;
    hasImage?: boolean;
    createdAt: string;
}

function ChatImage({ eventId, messageId, token }: { eventId: string; messageId: string; token: string }) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl = "";
        let cancelled = false;
        fetch(`${SERVER_URL}/api/v1.0/events/${eventId}/chat/messages/${messageId}/image`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((response) => response.ok ? response.blob() : null)
            .then((blob) => {
                if (!blob || cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            })
            .catch(() => setSrc(null));
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [eventId, messageId, token]);

    if (!src) return null;
    return <img src={src} alt="" className="max-h-64 rounded-md" />;
}

export function EventChatPage() {
    const { id } = useParams();
    const { token, userName } = useAuth();
    const [title, setTitle] = useState("");
    const [access, setAccess] = useState<"full" | "history" | "none">("none");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [asAnnouncement, setAsAnnouncement] = useState(false);
    const [isOrganizer, setIsOrganizer] = useState(false);
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
                setIsOrganizer(!!data.isOrganizer);
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
        socket.send(JSON.stringify({ text, kind: asAnnouncement ? "announcement" : "text" }));
        setDraft("");
    };

    const uploadImage = async (file: File) => {
        if (!token || !id) return;
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`${SERVER_URL}/api/v1.0/events/${id}/chat/images`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        });
        if (!response.ok) {
            setError("Не удалось отправить изображение");
            return;
        }
        const saved = await response.json();
        setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved]);
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
                                    {message.kind === "announcement" && (
                                        <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs">
                                            Объявление
                                        </span>
                                    )}
                                    {message.authorIsOrganizer && (
                                        <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs">
                                            Организатор
                                        </span>
                                    )}
                                    <span className="text-muted-foreground">
                                        {new Date(message.createdAt).toLocaleString("ru-RU")}
                                    </span>
                                </div>
                                {message.kind === "image" && token && id ? (
                                    <ChatImage eventId={id} messageId={message.id} token={token} />
                                ) : (
                                    <p>{message.text}</p>
                                )}
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                    {access === "full" ? (
                        <div className="mt-4 space-y-2">
                            {isOrganizer && (
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={asAnnouncement}
                                        onChange={(event) => setAsAnnouncement(event.target.checked)}
                                    />
                                    <Megaphone className="h-4 w-4" />
                                    Отправить как объявление
                                </label>
                            )}
                            <div className="flex gap-2">
                            <Input
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") send();
                                }}
                                placeholder="Сообщение"
                                disabled={!connected}
                            />
                            <Input
                                type="file"
                                accept="image/png,image/jpeg,image/gif,image/bmp"
                                className="max-w-48 cursor-pointer"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) uploadImage(file);
                                    event.target.value = "";
                                }}
                            />
                            <Button onClick={send} disabled={!connected || !draft.trim()} style={{ backgroundColor: "var(--primary-color)" }}>
                                {connected ? <Send className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                            </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </main>
            <Footer />
        </div>
    );
}
