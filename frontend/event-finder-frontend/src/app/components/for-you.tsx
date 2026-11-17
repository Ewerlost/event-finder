import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { EventCard } from "./event-card";
import { Button } from "./ui/button";
import { InterestSurvey, interestSurveyDismissed } from "./interest-survey";
import { useAuth } from "../context/AuthContext";
import { SERVER_URL } from "../config/serverConfig";
import { EventEntity } from "../entities/event.types";

function readPosition(): Promise<[number, number] | null> {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve([position.coords.latitude, position.coords.longitude]),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 },
        );
    });
}

export function ForYou() {
    const { token } = useAuth();
    const [events, setEvents] = useState<EventEntity[]>([]);
    const [interests, setInterests] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [surveyOpen, setSurveyOpen] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        (async () => {
            const position = await readPosition();
            if (cancelled) return;
            const params = new URLSearchParams();
            if (position) {
                params.set("lat", String(position[0]));
                params.set("lon", String(position[1]));
            }
            const query = params.toString();
            try {
                const response = await fetch(
                    `${SERVER_URL}/api/v1.0/recommendations${query ? `?${query}` : ""}`,
                    { headers: { Authorization: `Bearer ${token}` } },
                );
                if (!response.ok || cancelled) return;
                const data = await response.json();
                const nextInterests = data.interests || [];
                setEvents(data.events || []);
                setInterests(nextInterests);
                if (nextInterests.length === 0 && !interestSurveyDismissed()) {
                    setSurveyOpen(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token, reloadKey]);

    if (!token) return null;

    return (
        <section className="py-12 border-b">
            <div className="container mx-auto px-4">
                <div className="flex items-end justify-between gap-4 mb-6">
                    <div>
                        <h2>Для вас</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Подбор по интересам, прошлым записям, расстоянию и дате.
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
                    <div>
                        <p className="text-muted-foreground">
                            {interests.length === 0
                                ? "Отметьте интересы, и здесь появятся подходящие мероприятия."
                                : "Подходящих мероприятий пока нет."}
                        </p>
                        {interests.length === 0 && (
                            <Button
                                className="mt-4 cursor-pointer"
                                style={{ backgroundColor: "var(--primary-color)" }}
                                onClick={() => setSurveyOpen(true)}
                            >
                                Выбрать интересы
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </div>
            <InterestSurvey
                open={surveyOpen}
                token={token}
                onOpenChange={setSurveyOpen}
                onSaved={() => setReloadKey((value) => value + 1)}
            />
        </section>
    );
}
