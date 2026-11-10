import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, Users, Loader2, Send, X, MessageCircle } from "lucide-react";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { EventCard } from "../components/event-card";
import { ReviewItem } from "../components/review-item";
import { StarRating } from "../components/star-rating";
import { Map, Placemark, SearchControl, useYMaps } from "@pbe/react-yandex-maps";
import { useAuth } from "../context/AuthContext";
import { eventsService } from "../services/eventsService";
import { reviewsService } from "../services/reviewsService";
import { profileService } from "../services/profileServise";
import { EventEntity } from "../entities/event.types";
import { ReviewEntity } from "../entities/review.types";
import { ProfileEntity } from "../entities/profile.types";
import { DEFAULT_EVENT_IMAGE } from "../constants/defaultConstants";
import { showSuccess, showError, showInfo } from "../helpers/toastUtils";
import {SERVER_URL} from "../config/serverConfig";
import {getEventCardImageUrl} from "../helpers/getEventCardImageUrl";

function isPastEvent(event: { date: string; time?: string }) {
  const stamp = new Date(`${event.date}T${event.time || "23:59"}:00Z`).getTime();
  return !Number.isNaN(stamp) && stamp < Date.now();
}

export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, userId, userName } = useAuth();
  const [event, setEvent] = useState<EventEntity | null>(null);
  const [organizerEvents, setOrganizerEvents] = useState<EventEntity[]>([]);
  const [reviews, setReviews] = useState<ReviewEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [chatAccess, setChatAccess] = useState<"full" | "history" | "none">("none");

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userProfile, setUserProfile] = useState<ProfileEntity | null>(null);

  const ymaps = useYMaps(["geocode"]);

  useEffect(() => {
    if (token && id) {
      profileService.setUserId(userId as string);
      loadEventData();
      loadUserProfile();
    }
  }, [token, id]);

  const loadUserProfile = async () => {
    if (!token) return;
    try {
      console.log("Our current UserId: ", userId);
      profileService.setUserId(userId as string);
      const profile = await profileService.getProfile(token);
      setUserProfile(profile);
      console.log("Our current profile: ", profile);
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  };

  const loadEventData = async () => {
    if (!token || !id) return;

    setLoading(true);
    setError(null);

    try {
      const eventData = await eventsService.getEventById(id, token);
      setEvent(eventData);
      setIsWaitlisted(!!eventData.amIWaitlisted);

      if (userId) {
        const userEvents = await eventsService.getUserRegisteredEvents(token);
        setIsRegistered(userEvents.some(e => e.id === eventData.id));
      }

      const organizerEventsData = await eventsService.getEventsByOrganizer(eventData.organizerId, token);
      setOrganizerEvents(organizerEventsData.filter(e => e.id !== eventData.id).slice(0, 3));

      const eventReviews = await reviewsService.getEventReviews(id, token);
      setReviews(eventReviews);

      const chatResponse = await fetch(`${SERVER_URL}/api/v1.0/events/${id}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (chatResponse.ok) {
        const chatState = await chatResponse.json();
        setChatAccess(chatState.access);
      } else {
        setChatAccess("none");
      }
    } catch (err: any) {
      console.error("Failed to load event:", err);
      if (err.status === 404) {
        setError("Мероприятие не найдено");
      } else {
        setError("Не удалось загрузить мероприятие");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!token || !id) return;

    setRegistering(true);

    // Сохраняем текущее состояние для возможного отката
    const oldEvent = event;
    const oldIsRegistered = isRegistered;
    const oldIsWaitlisted = isWaitlisted;

    if (event && (event.availableSpots || 0) > 0) {
      setIsRegistered(true);
    }

    try {
      // ПОЛУЧАЕМ ОБНОВЛЕННОЕ СОБЫТИЕ ИЗ API
      const updatedEvent = await eventsService.registerForEvent(id, token);

      // ИСПОЛЬЗУЕМ ДАННЫЕ ИЗ ОТВЕТА
      setEvent(updatedEvent);

      // Проверяем статус регистрации из обновленного события
      // Если бэкенд возвращает поле isRegistered или amIMember
      // @ts-ignore - если есть такое поле
      const isUserRegistered = updatedEvent.amIMember === true ||
          updatedEvent.isRegistered === true ||
          updatedEvent.participants?.includes(userId);

      setIsRegistered(isUserRegistered);
      setIsWaitlisted(!!updatedEvent.amIWaitlisted);
      if (updatedEvent.amIWaitlisted) {
        showInfo("Свободных мест нет. Вы в листе ожидания");
      } else {
        showSuccess("Вы успешно записались на мероприятие!");
      }
    } catch (err: any) {
      // Откатываем оптимистичное обновление при ошибке
      if (oldEvent) {
        setEvent(oldEvent);
      }
      setIsRegistered(oldIsRegistered);
      setIsWaitlisted(oldIsWaitlisted);

      console.error("Failed to register for event:", err);
      if (err.status === 400) {
        showError("Нет свободных мест");
      } else if (err.status === 409) {
        showInfo("Вы уже записаны на это мероприятие");
      } else {
        showError("Не удалось записаться на мероприятие");
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!token || !id) return;

    setCancelling(true);

    // Сохраняем текущее состояние для возможного отката
    const oldEvent = event;
    const oldIsRegistered = isRegistered;
    const oldIsWaitlisted = isWaitlisted;

    // Оптимистичное обновление (мгновенно меняем UI)
    if (event) {
      setEvent({
        ...event,
        availableSpots: (event.availableSpots || 0)
      });
      setIsRegistered(false);
    }

    try {
      // ПОЛУЧАЕМ ОБНОВЛЕННОЕ СОБЫТИЕ ИЗ API
      const updatedEvent = await eventsService.cancelEventRegistration(id, token);

      // ИСПОЛЬЗУЕМ ДАННЫЕ ИЗ ОТВЕТА
      setEvent(updatedEvent);

      // Проверяем статус регистрации из обновленного события
      // @ts-ignore
      const isUserRegistered = updatedEvent.amIMember === true ||
          updatedEvent.isRegistered === true;

      setIsRegistered(isUserRegistered);
      setIsWaitlisted(!!updatedEvent.amIWaitlisted);

      showSuccess(oldIsWaitlisted ? "Вы вышли из листа ожидания" : "Вы успешно отменили запись на мероприятие");
    } catch (err: any) {
      // Откатываем оптимистичное обновление при ошибке
      if (oldEvent) {
        setEvent(oldEvent);
      }
      setIsRegistered(oldIsRegistered);
      setIsWaitlisted(oldIsWaitlisted);

      console.error("Failed to cancel registration:", err);
      showError("Не удалось отменить запись");
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!token || !userId || !event || !userProfile) return;

    if (!reviewComment.trim()) {
      showError("Пожалуйста, напишите комментарий");
      return;
    }

    setSubmittingReview(true);
    try {
      const newReview: ReviewEntity = {
        userId: userId,
        eventId: event.id!,
        userName: userProfile.userName || userProfile.alias || "Пользователь",
        userAvatar: userProfile.avatarUrl,
        rating: reviewRating,
        comment: reviewComment,
        date: new Date().toISOString(),
      };

      await reviewsService.createReview(newReview, token);

      setReviewRating(5);
      setReviewComment("");
      setShowReviewForm(false);
      await loadEventData();
      showSuccess("Отзыв успешно добавлен!");
    } catch (err: any) {
      console.error("Failed to submit review:", err);
      showError("Не удалось отправить отзыв");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!token) return;
    try {
      await reviewsService.deleteReview(reviewId, token);
      setReviews((current) => current.filter((review) => review.id !== reviewId));
      showSuccess("Отзыв удалён");
    } catch {
      showError("Не удалось удалить отзыв");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
        <div className="min-h-screen flex flex-col">
          <Header isAuthenticated={true} userName="Загрузка..." />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
          </div>
          <Footer />
        </div>
    );
  }

  if (error || !event) {
    return (
        <div className="min-h-screen flex flex-col">
          <Header isAuthenticated={true} userName="Ошибка" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="mb-4">{error || "Мероприятие не найдено"}</h2>
              <Button asChild className="mt-4 cursor-pointer hover:opacity-90">
                <Link to="/">На главную</Link>
              </Button>
            </div>
          </div>
          <Footer />
        </div>
    );
  }

  const isOrganizer = event.organizerId === userId;
  const isFullyBooked = event.availableSpots === 0;
  const eventHasPassed = isPastEvent(event);
  const canReviewEvent = !isOrganizer && isRegistered && eventHasPassed && event.status !== "cancelled";

  // @ts-ignore
  return (
      <div className="min-h-screen flex flex-col">
        <Header isAuthenticated={true} userName={userName} />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Badge style={{ backgroundColor: 'var(--primary-color)' }}>
                  {event.category}
                </Badge>
              </div>
              <h1 className="mb-4">{event.title}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="rounded-lg overflow-hidden">
                  <img
                      src={getEventCardImageUrl(event.id as string) || DEFAULT_EVENT_IMAGE}
                      alt={event.title}
                      className="w-full h-96 object-cover"
                  />
                </div>

                <div>
                  <h2 className="mb-4">Описание</h2>
                  <p className="text-muted-foreground leading-relaxed">{event.description}</p>
                </div>

                <div>
                  <h2 className="mb-4">Место проведения</h2>
                  <div className="rounded-lg overflow-hidden border">
                    <Map
                        defaultState={{
                          center: event.coordinates || [53.90, 27.58],
                          zoom: 15
                        }}
                        width="100%"
                        height="400px"
                        options={{ draggable: false }}
                    >
                      {event.coordinates && (
                          <Placemark
                              geometry={event.coordinates}
                              options={{
                                preset: 'islands#redDotIcon',
                              }}
                          />
                      )}
                      <SearchControl options={{ float: "right" }} />
                    </Map>
                    <div className="p-4 bg-muted/30">
                      <p className="font-semibold">{event.location}</p>
                      <p className="text-sm text-muted-foreground">{event.address}</p>
                    </div>
                  </div>
                </div>

                {organizerEvents.length > 0 && (
                    <div>
                      <h2 className="mb-4">Другие мероприятия этого организатора</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {organizerEvents.map((evt) => (
                            <EventCard key={evt.id} event={evt} compact />
                        ))}
                      </div>
                    </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2>Отзывы о мероприятии</h2>
                    {canReviewEvent && !showReviewForm && (
                        <Button
                            variant="outline"
                            onClick={() => setShowReviewForm(true)}
                            className="cursor-pointer hover:bg-gray-100"
                        >
                          Написать отзыв
                        </Button>
                    )}
                    {!isOrganizer && isRegistered && !eventHasPassed && event.status !== "cancelled" && (
                        <p className="text-sm text-muted-foreground">Отзыв можно оставить после мероприятия</p>
                    )}
                  </div>

                  {showReviewForm && (
                      <div className="border rounded-lg p-6 mb-6 bg-muted/30">
                        <div className="flex justify-between items-center mb-4">
                          <h3>Ваш отзыв</h3>
                          <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowReviewForm(false)}
                              className="cursor-pointer hover:bg-gray-100"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label>Рейтинг</Label>
                            <div className="mt-2">
                              <StarRating
                                  rating={reviewRating}
                                  maxRating={5}
                                  interactive={true}
                                  onRate={setReviewRating}
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="comment">Комментарий</Label>
                            <Textarea
                                id="comment"
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Поделитесь впечатлениями о мероприятии..."
                                className="mt-2"
                                rows={4}
                            />
                          </div>

                          <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setShowReviewForm(false)}
                                className="cursor-pointer hover:bg-gray-100"
                            >
                              Отмена
                            </Button>
                            <Button
                                onClick={handleSubmitReview}
                                disabled={submittingReview || !reviewComment.trim()}
                                style={{ backgroundColor: 'var(--primary-color)' }}
                                className="cursor-pointer hover:opacity-90"
                            >
                              {submittingReview ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                  <Send className="h-4 w-4 mr-2" />
                              )}
                              Отправить отзыв
                            </Button>
                          </div>
                        </div>
                      </div>
                  )}

                  <div className="space-y-4">
                    {reviews.map((review) => (
                        <ReviewItem
                            key={review.id}
                            review={review}
                            onClick={() => navigate(`/events/${review.eventId}`)}
                            onDelete={review.userId === userId && review.id ? () => handleDeleteReview(review.id!) : undefined}
                        />
                    ))}
                    {reviews.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Пока нет отзывов об этом мероприятии
                        </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-20 space-y-6">
                  <div className="border rounded-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Дата</p>
                        <p>{formatDate(event.date)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Время</p>
                        <p>{event.time}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Место</p>
                        <p>{event.location}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Места</p>
                        <p className="font-semibold">
                          {event.availableSpots} из {event.totalSpots} свободно
                        </p>
                        {event.totalSpots && (
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                              <div
                                  className="bg-[var(--primary-color)] h-2 rounded-full transition-all"
                                  style={{
                                    width: `${((event.totalSpots - (event.availableSpots || 0)) / event.totalSpots) * 100}%`
                                  }}
                              />
                            </div>
                        )}
                      </div>
                    </div>

                    {isWaitlisted ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {event.waitlistPosition === 1
                                ? "Вы следующий: при освобождении места вас запишут автоматически."
                                : `Вы в листе ожидания. Перед вами ${Math.max((event.waitlistPosition || 1) - 1, 0)}.`}
                          </p>
                          <Button
                              className="w-full cursor-pointer"
                              size="lg"
                              variant="outline"
                              onClick={handleCancelRegistration}
                              disabled={cancelling}
                          >
                            {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Покинуть лист ожидания"}
                          </Button>
                        </div>
                    ) : !isRegistered ? (
                        <Button
                            className="w-full cursor-pointer hover:opacity-90"
                            size="lg"
                            style={{ backgroundColor: 'var(--primary-color)' }}
                            onClick={handleRegister}
                            disabled={registering}
                        >
                          {registering ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : isFullyBooked ? (
                              "В лист ожидания"
                          ) : (
                              "Записаться"
                          )}
                        </Button>
                    ) : (
                        <Button
                            className="w-full cursor-pointer hover:bg-destructive/90"
                            size="lg"
                            variant="destructive"
                            onClick={handleCancelRegistration}
                            disabled={cancelling}
                        >
                          {cancelling ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                              "Отменить запись"
                          )}
                        </Button>
                    )}
                    {chatAccess !== "none" && event.id && (
                        <Button asChild variant="outline" className="w-full cursor-pointer">
                          <Link to={`/events/${event.id}/chat`}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Чат мероприятия
                          </Link>
                        </Button>
                    )}
                  </div>

                  {/*<Link
                      to={`/organizers/${event.organizerId}`}
                      className="block border rounded-lg p-6 hover:shadow-lg hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <h3 className="mb-4">Организатор</h3>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={event.organizerAvatar} alt={event.organizerName} />
                        <AvatarFallback>{event.organizerName?.[0] || "О"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4>{event.organizerName}</h4>
                      </div>
                    </div>
                  </Link>*/}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
  );
}