import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Textarea } from "../components/ui/textarea";
import { EventCard } from "../components/event-card";
import { ReviewItem } from "../components/review-item";
import { StarRating } from "../components/star-rating";
import { useAuth } from "../context/AuthContext";
import { getUserById } from "../api/profileApi";
import { eventsService } from "../services/eventsService";
import { SERVER_URL } from "../config/serverConfig";
import { mediaUrl } from "../helpers/mediaUrl";
import { ProfileEntity } from "../entities/profile.types";
import { EventEntity } from "../entities/event.types";
import { showError, showSuccess } from "../helpers/toastUtils";

interface OrganizerReview {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    rating: number;
    comment: string;
    date: string;
}

export function UserPage() {
    const { id } = useParams();
    const { token, userId, userName } = useAuth();
    const [profile, setProfile] = useState<ProfileEntity | null>(null);
    const [events, setEvents] = useState<EventEntity[]>([]);
    const [reviews, setReviews] = useState<OrganizerReview[]>([]);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        if (!token || !id) return;
        try {
            const [nextProfile, nextEvents, reviewResponse] = await Promise.all([
                getUserById(id, token),
                eventsService.getEventsByOrganizer(id, token),
                fetch(`${SERVER_URL}/api/v1.0/organizer-reviews/organizer/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);
            setProfile(nextProfile);
            setEvents(nextEvents);
            setReviews(reviewResponse.ok ? await reviewResponse.json() : []);
            setError(null);
        } catch {
            setError("Профиль не найден");
        }
    };

    useEffect(() => {
        load();
    }, [token, id]);

    const alreadyReviewed = reviews.some((review) => review.userId === userId);
    const isOrganizer = events.length > 0;
    const isSelf = profile?.id === userId;

    const deleteOrganizerReview = async (reviewId: string) => {
        if (!token) return;
        const response = await fetch(`${SERVER_URL}/api/v1.0/organizer-reviews/${reviewId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            showError("Не удалось удалить отзыв");
            return;
        }
        setReviews((current) => current.filter((review) => review.id !== reviewId));
        showSuccess("Отзыв удалён");
    };

    const submitReview = async () => {
        if (!token || !id || !comment.trim()) return;
        setSaving(true);
        try {
            const response = await fetch(`${SERVER_URL}/api/v1.0/organizer-reviews`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ organizerId: id, rating, comment }),
            });
            if (response.status === 409) {
                showError("Вы уже оставляли отзыв об этом организаторе");
                return;
            }
            if (!response.ok) {
                showError("Не удалось отправить отзыв");
                return;
            }
            setComment("");
            setRating(5);
            showSuccess("Отзыв об организаторе сохранён");
            await load();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header isAuthenticated={!!token} userName={userName} />
            <main className="flex-1">
                <div className="container mx-auto px-4 py-8 max-w-4xl">
                    {error || !profile ? (
                        <div className="text-center py-16">
                            <h2>{error || "Загрузка..."}</h2>
                            <Button asChild className="mt-4">
                                <Link to="/">На главную</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={mediaUrl(profile.avatarUrl)} alt={profile.userName} />
                                    <AvatarFallback>{(profile.userName || profile.email || "П")[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h1>{profile.userName || profile.alias || "Пользователь"}</h1>
                                    {profile.alias && <p className="text-muted-foreground">{profile.alias}</p>}
                                    {profile.biography && <p className="mt-2">{profile.biography}</p>}
                                    {isSelf && (
                                        <Button asChild variant="outline" className="mt-3">
                                            <Link to="/profile">Редактировать профиль</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <section>
                                <h2 className="mb-4">Мероприятия</h2>
                                {events.length === 0 ? (
                                    <p className="text-muted-foreground">Пользователь пока не организовывал мероприятия.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {events.map((event) => (
                                            <EventCard key={event.id} event={event} />
                                        ))}
                                    </div>
                                )}
                            </section>

                            {isOrganizer && (
                                <section>
                                    <h2 className="mb-4">Отзывы об организаторе</h2>
                                    <div className="space-y-4">
                                        {reviews.map((review) => (
                                            <ReviewItem
                                                key={review.id}
                                                review={{
                                                    id: review.id,
                                                    userId: review.userId,
                                                    eventId: "",
                                                    userName: review.userName,
                                                    userAvatar: review.userAvatar,
                                                    rating: review.rating,
                                                    comment: review.comment,
                                                    date: review.date,
                                                }}
                                                onDelete={review.userId === userId ? () => deleteOrganizerReview(review.id) : undefined}
                                            />
                                        ))}
                                        {reviews.length === 0 && (
                                            <p className="text-muted-foreground">Отзывов об организаторе пока нет.</p>
                                        )}
                                    </div>
                                    {!isSelf && !alreadyReviewed && (
                                        <div className="border rounded-lg p-4 mt-6 space-y-4">
                                            <h3>Отзыв об организаторе</h3>
                                            <StarRating rating={rating} interactive onRate={setRating} />
                                            <Textarea
                                                value={comment}
                                                onChange={(event) => setComment(event.target.value)}
                                                placeholder="Общее впечатление об организаторе"
                                            />
                                            <Button
                                                onClick={submitReview}
                                                disabled={saving || !comment.trim()}
                                                style={{ backgroundColor: "var(--primary-color)" }}
                                            >
                                                Отправить
                                            </Button>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
