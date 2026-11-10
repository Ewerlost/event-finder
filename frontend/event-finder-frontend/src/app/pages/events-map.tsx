import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MapPin, Search } from "lucide-react";
import { Map, Placemark } from "@pbe/react-yandex-maps";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { EventCard } from "../components/event-card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuth } from "../context/AuthContext";
import { eventsService } from "../services/eventsService";
import { EventEntity } from "../entities/event.types";
import { EVENT_CATEGORIES } from "../constants/defaultConstants";
import { showError } from "../helpers/toastUtils";

const MINSK: [number, number] = [53.9006, 27.559];
const NEAR_ME_RADIUS_KM = 15;

function distanceKm(from: [number, number], to: [number, number]) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(to[0] - from[0]);
    const dLon = toRad(to[1] - from[1]);
    const lat1 = toRad(from[0]);
    const lat2 = toRad(to[0]);
    const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function hasCoordinates(event: EventEntity): event is EventEntity & { coordinates: [number, number] } {
    return Array.isArray(event.coordinates) && event.coordinates.length >= 2;
}

export function EventsMapPage() {
    const navigate = useNavigate();
    const { token, userName } = useAuth();
    const [events, setEvents] = useState<EventEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [category, setCategory] = useState("Все категории");
    const [nearMe, setNearMe] = useState(false);
    const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
    const [locating, setLocating] = useState(false);
    const [center, setCenter] = useState<[number, number]>(MINSK);
    const [zoom, setZoom] = useState(12);
    const [searchReady, setSearchReady] = useState(false);

    const loadEvents = async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            setEvents(await eventsService.getAllEvents(token));
        } catch {
            setError("Не удалось загрузить мероприятия");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) loadEvents();
    }, [token]);

    const filtered = useMemo(() => {
        return events.filter((event) => {
            const titleMatches = event.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
            const categoryMatches = category === "Все категории" || event.category === category;
            const nearMatches = !nearMe || !myLocation || (
                hasCoordinates(event) && distanceKm(myLocation, event.coordinates) <= NEAR_ME_RADIUS_KM
            );
            return titleMatches && categoryMatches && nearMatches;
        });
    }, [events, searchQuery, category, nearMe, myLocation]);

    const enableNearMe = () => {
        if (nearMe) {
            setNearMe(false);
            setCenter(MINSK);
            setZoom(12);
            return;
        }
        if (!navigator.geolocation) {
            showError("Браузер не отдает геолокацию");
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const next: [number, number] = [position.coords.latitude, position.coords.longitude];
                setMyLocation(next);
                setCenter(next);
                setZoom(13);
                setNearMe(true);
                setLocating(false);
            },
            () => {
                setLocating(false);
                showError("Не удалось определить местоположение");
            },
        );
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header isAuthenticated={!!token} userName={userName} />
            <main className="flex-1 bg-muted/30">
                <div className="container mx-auto px-4 py-6">
                    <h1 className="mb-4">Карта</h1>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                name="map-event-search"
                                autoComplete="off"
                                readOnly={!searchReady}
                                onFocus={() => setSearchReady(true)}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Поиск по названию..."
                                className="pl-10"
                            />
                        </div>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="cursor-pointer">
                                <SelectValue placeholder="Категория" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Все категории">Все категории</SelectItem>
                                {EVENT_CATEGORIES.map((item) => (
                                    <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant={nearMe ? "default" : "outline"}
                            onClick={enableNearMe}
                            disabled={locating}
                            className="cursor-pointer"
                            style={nearMe ? { backgroundColor: "var(--primary-color)" } : undefined}
                        >
                            {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                            Рядом со мной
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                        {error && (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-red-500">{error}</p>
                                <Button onClick={loadEvents}>Попробовать снова</Button>
                            </div>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <div className="lg:col-span-3 h-[420px] lg:h-[calc(100vh-220px)] rounded-lg overflow-hidden border bg-card">
                                <Map state={{ center, zoom }} width="100%" height="100%">
                                    {nearMe && myLocation && (
                                        <Placemark
                                            geometry={myLocation}
                                            options={{ preset: "islands#blueCircleDotIcon" }}
                                            properties={{ iconCaption: "Вы здесь" }}
                                        />
                                    )}
                                    {filtered.filter(hasCoordinates).map((event) => (
                                        <Placemark
                                            key={event.id}
                                            geometry={event.coordinates}
                                            properties={{ hintContent: event.title, iconCaption: event.title }}
                                            options={{ preset: "islands#redDotIcon" }}
                                            onClick={() => navigate(`/events/${event.id}`)}
                                        />
                                    ))}
                                </Map>
                            </div>
                            <div className="lg:col-span-2 lg:h-[calc(100vh-220px)] overflow-y-auto space-y-3 pr-1">
                                {filtered.length === 0 ? (
                                    <p className="text-muted-foreground p-4">Ничего не найдено.</p>
                                ) : filtered.map((event) => (
                                    <EventCard key={event.id} event={event} compact />
                                ))}
                            </div>
                        </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
