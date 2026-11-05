import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { EventCard } from "./event-card";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";
import { SERVER_URL } from "../config/serverConfig";
import { EventEntity } from "../entities/event.types";

export function ForYou() {
    const { token } = useAuth();
    const [events, setEvents] = useState<EventEntity[]>([]);
    const [interests, setInterests] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        fetch(`${SERVER_URL}/api/v1.0/recommendations`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async (response) => {
                if (!response.ok) return;
                const data = await response.json();
                setEvents(data.events || []);
                setInterests(data.interests || []);
            })
            .finally(() => setLoading(false));
    }, [token]);

    return (
        <section className="py-12 border-b">
            <div className="container mx-auto px-4">
                <div className="flex items-end justify-between gap-4 mb-6">
                    <div>
                        <h2>Для вас</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Подбор по интересам и прошлым записям. Модель подключится позже, сейчас работают простые правила.
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link to="/profile">Интересы</Link>
                    </Button>
                </div>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-color)]" />
                    </div>
                ) : events.length === 0 ? (
                    <p className="text-muted-foreground">
                        {interests.length === 0
                            ? "Отметьте интересы в профиле, и здесь появятся подходящие мероприятия."
                            : "Подходящих мероприятий пока нет."}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
