import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { EventCard } from "./event-card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useAuth } from "../context/AuthContext";
import { eventsService } from "../services/eventsService";
import { EventEntity } from '../entities/event.types'
import { showError } from "../helpers/toastUtils";

export function EventFeed() {
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все категории");
  const [allEvents, setAllEvents] = useState<EventEntity[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventEntity[]>([]);
  const [displayedEvents, setDisplayedEvents] = useState<EventEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchReady, setSearchReady] = useState(false);

  const cities = [...new Set(allEvents.map(event => event.address?.split(',')[0]?.trim() || event.location))];
  const categories = [...new Set(allEvents.map(event => event.category))];

  useEffect(() => {
    if (token) {
      loadEvents();
    }
  }, [token]);

  const loadEvents = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const events = await eventsService.getAllEvents(token);
      setAllEvents(events);
      setFilteredEvents(events);
      setDisplayedEvents(events.slice(0, 6));
    } catch (err: any) {
      console.error("Failed to load events:", err);
      setError("Не удалось загрузить мероприятия");
      showError("Не удалось загрузить мероприятия");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = allEvents;

    if (searchQuery) {
      filtered = filtered.filter(
          (event) =>
              event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              event.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCity && selectedCity !== "Все города") {
      filtered = filtered.filter((event) =>
          (event.address || event.location).toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    if (selectedCategory && selectedCategory !== "Все категории") {
      filtered = filtered.filter((event) => event.category === selectedCategory);
    }

    setFilteredEvents(filtered);
    setDisplayedEvents(filtered.slice(0, 6));
  }, [searchQuery, selectedCity, selectedCategory, allEvents]);

  const loadMore = () => {
    const currentLength = displayedEvents.length;
    const nextEvents = filteredEvents.slice(currentLength, currentLength + 6);
    setDisplayedEvents([...displayedEvents, ...nextEvents]);
  };

  if (loading) {
    return (
        <section id="events" className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="mb-8">Мероприятия</h2>
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
            </div>
          </div>
        </section>
    );
  }

  if (error) {
    return (
        <section id="events" className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="mb-8">Мероприятия</h2>
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={loadEvents} className="cursor-pointer hover:opacity-90">Попробовать снова</Button>
            </div>
          </div>
        </section>
    );
  }

  return (
      <section id="events" className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-8">Мероприятия</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  type="search"
                  name="event-search"
                  autoComplete="off"
                  readOnly={!searchReady}
                  onFocus={() => setSearchReady(true)}
                  placeholder="Поиск по названию или описанию..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Город" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Все города" className="cursor-pointer">Все города</SelectItem>
                {cities.map((city) => (
                    <SelectItem key={city} value={city} className="cursor-pointer">
                      {city}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Все категории" className="cursor-pointer">Все категории</SelectItem>
                {categories.map((category) => (
                    <SelectItem key={category} value={category} className="cursor-pointer">
                      {category}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {displayedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
            ))}
          </div>

          {displayedEvents.length < filteredEvents.length && (
              <div className="text-center">
                <Button
                    onClick={loadMore}
                    size="lg"
                    className="cursor-pointer hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--primary-color)',
                      transition: 'var(--hover-button-transition)'
                    }}
                >
                  Показать еще
                </Button>
              </div>
          )}

          {filteredEvents.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Мероприятий не найдено. Попробуйте изменить фильтры.
              </div>
          )}
        </div>
      </section>
  );
}