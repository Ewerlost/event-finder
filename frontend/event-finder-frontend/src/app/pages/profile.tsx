import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Calendar,
  MessageSquare,
  Settings,
  AlertTriangle,
  Loader2,
  Edit2,
  X,
  Check,
  Megaphone
} from "lucide-react";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { EventCard } from "../components/event-card";
import { Map, Placemark, SearchControl, useYMaps } from "@pbe/react-yandex-maps";
import { useAuth } from "../context/AuthContext";
import { profileService } from "../services/profileServise";
import { reviewsService } from "../services/reviewsService";
import { eventsService } from "../services/eventsService";
import { ReviewItem } from "../components/review-item";
import { EventEntity } from "../entities/event.types";
import { ProfileEntity } from "../entities/profile.types";
import { ReviewEntity } from "../entities/review.types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { EVENT_CATEGORIES } from '../constants/defaultConstants';
import { showSuccess, showError, showInfo } from "../helpers/toastUtils";
import { SERVER_URL } from "../config/serverConfig";
import {getEventCardImageUrl} from "../helpers/getEventCardImageUrl";

export function ProfilePage() {
  const { token, logout, userId } = useAuth();
  const [activeTab, setActiveTab] = useState("personal");
  const [deletePassword, setDeletePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileEntity | null>(null);
  const [userReviews, setUserReviews] = useState<ReviewEntity[]>([]);
  const [userEvents, setUserEvents] = useState<EventEntity[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Omit<ProfileEntity, 'id' | 'email' | 'avatarUrl'>>({
    userName: "",
    alias: "",
    phone: "",
    biography: "",
    coordinates: null,
    address: null,
  });
  const [eventImages, setEventImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Состояния для вкладки «Организатор»
  const [organizerEvents, setOrganizerEvents] = useState<EventEntity[]>([]);
  const [organizerEventsLoading, setOrganizerEventsLoading] = useState(false);
  const [chats, setChats] = useState<{ eventId: string; title: string; date: string; access: string }[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventEntity | null>(null);
  const [eventFormData, setEventFormData] = useState<Partial<EventEntity>>({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    address: "",
    coordinates: [53.90, 27.58] as [number, number],
    category: "",
    availableSpots: 0,
    totalSpots: 0,
  });
  const [eventFormSaving, setEventFormSaving] = useState(false);

  const ymaps = useYMaps(["geocode"]);

  useEffect(() => {
    if (token && userId) {
      profileService.setUserId(userId);
      reviewsService.setCurrentUserId(userId);
      eventsService.setCurrentUserId(userId);
      loadProfile();

      console.log("Current user id: ", userId);
    }
  }, [token, userId]);

  // Загружаем мероприятия организатора при переходе на вкладку
  useEffect(() => {
    if (activeTab === "organizer" && token && userId) {
      loadOrganizerEvents();
    }
    if (activeTab === "chats" && token) {
      fetch(`${SERVER_URL}/api/v1.0/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
          .then((response) => response.ok ? response.json() : [])
          .then(setChats)
          .catch(() => setChats([]));
    }
  }, [activeTab, token, userId]);

  const handleMapClick = (e: any) => {
    if (!isEditing) return;
    const coords = e.get("coords");
    if (coords) {
      setFormData(prev => ({ ...prev, coordinates: coords }));
    }
    if (ymaps) {
      ymaps
          .geocode(coords, {
            kind: 'house',
            results: 1
          })
          .then((result: any) => {
            const firstGeoObject = result.geoObjects.get(0);
            if (firstGeoObject) {
              const address = firstGeoObject.getAddressLine
                  ? firstGeoObject.getAddressLine()
                  : null;

              if (address) {
                setFormData(prev => ({ ...prev, address }));
                return;
              }

              const country = firstGeoObject.getCountry
                  ? firstGeoObject.getCountry()
                  : "";
              const administrativeAreas = firstGeoObject.getAdministrativeAreas
                  ? firstGeoObject.getAdministrativeAreas()
                  : [];
              const thoroughfare = firstGeoObject.getThoroughfare
                  ? firstGeoObject.getThoroughfare()
                  : "";
              const premiseNumber = firstGeoObject.getPremiseNumber
                  ? firstGeoObject.getPremiseNumber()
                  : "";

              const parts = [
                country,
                ...administrativeAreas,
                thoroughfare,
                premiseNumber
              ].filter(Boolean);

              const fullAddress = parts.join(", ") ||
                  firstGeoObject.properties?.get("text", "") ||
                  null;

              setFormData(prev => ({ ...prev, address: fullAddress }));
            }
          })
          .catch((err: any) => console.error("GEOCODE ERROR: " + err));
    }
  };

  const handleMapClickForEvent = (e: any) => {
    const coords = e.get("coords");
    if (coords) {
      setEventFormData(prev => ({ ...prev, coordinates: coords }));
    }
    if (ymaps) {
      ymaps
          .geocode(coords, {
            kind: 'house',
            results: 1
          })
          .then((result: any) => {
            const firstGeoObject = result.geoObjects.get(0);
            if (firstGeoObject) {
              const address = firstGeoObject.getAddressLine
                  ? firstGeoObject.getAddressLine()
                  : null;

              if (address) {
                setEventFormData(prev => ({ ...prev, address }));
                return;
              }

              const country = firstGeoObject.getCountry
                  ? firstGeoObject.getCountry()
                  : "";
              const administrativeAreas = firstGeoObject.getAdministrativeAreas
                  ? firstGeoObject.getAdministrativeAreas()
                  : [];
              const thoroughfare = firstGeoObject.getThoroughfare
                  ? firstGeoObject.getThoroughfare()
                  : "";
              const premiseNumber = firstGeoObject.getPremiseNumber
                  ? firstGeoObject.getPremiseNumber()
                  : "";

              const parts = [
                country,
                ...administrativeAreas,
                thoroughfare,
                premiseNumber
              ].filter(Boolean);

              const fullAddress = parts.join(", ") ||
                  firstGeoObject.properties?.get("text", "") ||
                  null;

              setEventFormData(prev => ({ ...prev, address: fullAddress }));
            }
          })
          .catch((err: any) => console.error("GEOCODE ERROR:", err));
    }
  };

  const loadProfile = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const userProfile = await profileService.getProfile(token);
      setProfile(userProfile);
      setFormData({
        userName: userProfile.userName,
        alias: userProfile.alias,
        phone: userProfile.phone,
        biography: userProfile.biography,
        coordinates: userProfile.coordinates || null,
        address: userProfile.address || null,
      });
      if (userId) {
        await Promise.all([loadUserReviews(), loadUserEvents()]);
      }
    } catch (err: any) {
      console.error("Failed to load profile:", err);
      setError("Не удалось загрузить данные профиля");
      if (err.status === 401) logout();
    } finally {
      setLoading(false);
    }
  };

  const loadUserReviews = async () => {
    if (!token || !userId) return;
    setReviewsLoading(true);
    try {
      const reviews = await reviewsService.getUserReviews(userId, token);
      setUserReviews(reviews);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadUserEvents = async () => {
    if (!token) return;
    setEventsLoading(true);
    try {
      const events = await eventsService.getUserRegisteredEvents(token);
      setUserEvents(events);
    } catch (err) {
      console.error("Failed to load user events:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  const loadOrganizerEvents = async () => {
    if (!token || !userId) return;
    setOrganizerEventsLoading(true);
    try {
      const events = await eventsService.getEventsByOrganizer(userId, token);
      setOrganizerEvents(events);
    } catch (err) {
      console.error("Failed to load organizer events:", err);
    } finally {
      setOrganizerEventsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleEditProfile = () => setIsEditing(true);

  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        userName: profile.userName,
        alias: profile.alias,
        phone: profile.phone,
        biography: profile.biography,
        coordinates: profile.coordinates || null,
        address: profile.address || null,
      });
    }
    setIsEditing(false);
    setAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/bmp"];
    if (!allowed.includes(file.type)) {
      showError("Можно загрузить JPG, PNG, GIF или BMP");
      e.target.value = "";
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!token || !profile) return;
    setSaving(true);
    setError(null);
    try {
      let currentProfile = profile;
      if (avatarFile) {
        currentProfile = await profileService.uploadAvatar(token, avatarFile);
      }
      const updatedProfile = await profileService.updateProfile(token, {
        id: currentProfile.id,
        userName: formData.userName,
        alias: formData.alias,
        email: currentProfile.email,
        phone: formData.phone,
        biography: formData.biography,
        coordinates: formData.coordinates,
        address: formData.address,
        avatarUrl: currentProfile.avatarUrl,
      });
      setProfile(updatedProfile);
      setFormData({
        userName: updatedProfile.userName,
        alias: updatedProfile.alias,
        phone: updatedProfile.phone,
        biography: updatedProfile.biography,
        coordinates: formData.coordinates || updatedProfile.coordinates || null,
        address: formData.address || updatedProfile.address || null,
      });
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      setIsEditing(false);
      showSuccess("Профиль успешно обновлен!");
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      setError("Не удалось сохранить изменения");
      showError("Не удалось сохранить изменения");
      if (err.status === 401) logout();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!token) return;
    try {
      await profileService.deleteProfile(token, deletePassword);
      showSuccess("Профиль успешно удален");
      logout();
    } catch (err: any) {
      console.error("Failed to delete profile:", err);
      showError(err.status === 401 ? "Неверный пароль" : "Не удалось удалить профиль");
    }
  };

  // Организатор: открыть форму создания
  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setEventImages([]);
    setExistingImages([]);
    setImagePreviewUrls([]);

    const defaultCoords = (profile?.coordinates && profile.coordinates.length === 2)
        ? profile.coordinates as [number, number]
        : [53.90, 27.58] as [number, number];
    const defaultAddress = profile?.address || "";

    setEventFormData({
      title: "",
      description: "",
      date: "",
      time: "",
      location: "",
      address: defaultAddress,
      coordinates: defaultCoords,
      category: "",
      availableSpots: 0,
      totalSpots: 0,
    });
    setIsEventModalOpen(true);
  };

  // Организатор: открыть форму редактирования
  const handleEditEvent = (event: EventEntity) => {
    setEditingEvent(event);
    setEventImages([]);
    setExistingImages(event.images || []);
    setImagePreviewUrls(event.images || []);

    setEventFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      address: event.address,
      coordinates: event.coordinates,
      category: event.category,
      availableSpots: event.availableSpots || 0,
      totalSpots: event.totalSpots || 0,
    });
    setIsEventModalOpen(true);
  };

  const validateEventForm = (): string | null => {
    if (!eventFormData.title?.trim()) {
      return "Введите название мероприятия";
    }
    if (!eventFormData.date) {
      return "Выберите дату мероприятия";
    }
    if (!eventFormData.location?.trim()) {
      return "Укажите место проведения";
    }

    const today = new Date().toISOString().split('T')[0];
    if (eventFormData.date < today) {
      return "Дата мероприятия не может быть раньше сегодняшней";
    }

    if (eventFormData.availableSpots != null && eventFormData.totalSpots != null) {
      if (eventFormData.availableSpots < 0 || eventFormData.totalSpots < 0) {
        return "Количество мест не может быть отрицательным";
      }
      if (eventFormData.availableSpots > eventFormData.totalSpots) {
        return "Количество доступных мест не может превышать общее количество мест";
      }
    }

    return null;
  };

  // Организатор: сохранить (создать / обновить)
  const handleSaveEvent = async () => {
    if (!token || !userId) return;

    const validationError = validateEventForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    setEventFormSaving(true);
    try {
      const eventData = {
        ...eventFormData,
        organizerId: userId,
        organizerName: profile?.userName || profile?.alias || "Организатор",
        organizerAvatar: profile?.avatarUrl,
        id: editingEvent?.id,
        amIMember: false,
        image: existingImages.length > 0 ? existingImages[0] : undefined,
        images: existingImages,
      } as EventEntity;

      let savedEvent: EventEntity;

      if (editingEvent) {
        savedEvent = await eventsService.updateEvent(editingEvent.id!, eventData, token);

        if (eventImages.length > 0 && savedEvent.id) {
          const uploadedUrls = await eventsService.uploadEventImages(savedEvent.id, eventImages, token);
          savedEvent = {
            ...savedEvent,
            // images: [...(savedEvent.images || []), ...uploadedUrls],
            // image: savedEvent.image || getEventCardImageUrl(uploadedUrls[0]),
          };
        }
      } else {
        savedEvent = await eventsService.createEvent(eventData, token);

        if (eventImages.length > 0) {
          const uploadedUrls = await eventsService.uploadEventImages(savedEvent.id!, eventImages, token);
          savedEvent = {
            ...savedEvent,
            images: uploadedUrls,
            image: uploadedUrls[0],
          };
        }
      }

      setOrganizerEvents(prev =>
          editingEvent
              ? prev.map(e => (e.id === savedEvent.id ? savedEvent : e))
              : [savedEvent, ...prev]
      );

      setIsEventModalOpen(false);
      showSuccess(editingEvent ? "Мероприятие обновлено!" : "Мероприятие создано!");
    } catch (err: any) {
      console.error("Failed to save event:", err);
      showError("Не удалось сохранить мероприятие");
    } finally {
      setEventFormSaving(false);
    }
  };

  // Организатор: удалить мероприятие
  const handleDeleteEvent = async (eventId: string) => {
    if (!token) return;
    if (!confirm("Вы уверены, что хотите удалить это мероприятие?")) return;
    try {
      await eventsService.deleteEvent(eventId, token);
      setOrganizerEvents(prev => prev.filter(e => e.id !== eventId));
      showSuccess("Мероприятие удалено");
    } catch (err) {
      console.error("Failed to delete event:", err);
      showError("Не удалось удалить мероприятие");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const validFiles = files.filter(file =>
        file.type === 'image/png' || file.type === 'image/jpeg'
    );

    if (validFiles.length !== files.length) {
      showError("Принимаются только изображения PNG и JPG");
    }

    setEventImages(prev => [...prev, ...validFiles]);

    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImages(prev => prev.filter((_, i) => i !== index));
      setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      const fileIndex = index - existingImages.length;
      setEventImages(prev => prev.filter((_, i) => i !== fileIndex));

      URL.revokeObjectURL(imagePreviewUrls[index]);
      setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  const formatCoordinates = (coords: [number, number] | null | undefined): string =>
      !coords || coords.length < 2
          ? "Координаты не заданы"
          : `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;

  const formatAddress = (address: string | null | undefined): string =>
      address || "Адрес не задан";

  const displayData = isEditing ? formData : profile || formData;
  const mapCoordinates = isEditing ? formData.coordinates : profile?.coordinates;

  if (loading) {
    return (
        <div className="min-h-screen flex flex-col">
          <Header isAuthenticated={true} userName="Загрузка..." />
          <main className="flex-1 bg-muted/30 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
          </main>
          <Footer />
        </div>
    );
  }

  if (error || !profile) {
    return (
        <div className="min-h-screen flex flex-col">
          <Header isAuthenticated={true} userName="Ошибка" />
          <main className="flex-1 bg-muted/30 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error || "Произошла ошибка"}</p>
              <Button onClick={loadProfile} className="cursor-pointer hover:opacity-90">Попробовать снова</Button>
            </div>
          </main>
          <Footer />
        </div>
    );
  }

  return (
      <div className="min-h-screen flex flex-col">
        <Header isAuthenticated={true} userName={profile.userName} />
        <main className="flex-1 bg-muted/30">
          <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
              <h1 className="mb-0">Профиль</h1>
            </div>

            {/* Mobile Tabs – горизонтальная прокрутка */}
            <div className="lg:hidden mb-8">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex w-full overflow-x-auto gap-2">
                  <TabsTrigger value="personal" className="flex-shrink-0 cursor-pointer hover:bg-muted/50">Профиль</TabsTrigger>
                  <TabsTrigger value="organizer" className="flex-shrink-0 cursor-pointer hover:bg-muted/50">Организатор</TabsTrigger>
                  <TabsTrigger value="events" className="flex-shrink-0 cursor-pointer hover:bg-muted/50">Мероприятия</TabsTrigger>
                  <TabsTrigger value="reviews" className="flex-shrink-0 cursor-pointer hover:bg-muted/50">Отзывы</TabsTrigger>
                  <TabsTrigger value="chats" className="flex-shrink-0 cursor-pointer hover:bg-muted/50">Чаты</TabsTrigger>
                  {/*<TabsTrigger value="settings" className="flex-shrink-0 cursor-pointer hover:bg-muted/50">Настройки</TabsTrigger>*/}
                </TabsList>
              </Tabs>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Desktop Sidebar */}
              <div className="lg:col-span-1 hidden lg:block">
                <div className="bg-card border rounded-lg p-4 sticky top-20">
                  <nav className="space-y-2">
                    <Button
                        variant={activeTab === "personal" ? "default" : "ghost"}
                        className="w-full justify-start cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab("personal")}
                        style={activeTab === "personal" ? { backgroundColor: 'var(--primary-color)' } : {}}
                    >
                      <User className="h-4 w-4 mr-2" /> Профиль
                    </Button>
                    <Button
                        variant={activeTab === "organizer" ? "default" : "ghost"}
                        className="w-full justify-start cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab("organizer")}
                        style={activeTab === "organizer" ? { backgroundColor: 'var(--primary-color)' } : {}}
                    >
                      <Megaphone className="h-4 w-4 mr-2" /> Организатор
                    </Button>
                    <Button
                        variant={activeTab === "events" ? "default" : "ghost"}
                        className="w-full justify-start cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab("events")}
                        style={activeTab === "events" ? { backgroundColor: 'var(--primary-color)' } : {}}
                    >
                      <Calendar className="h-4 w-4 mr-2" /> Мои мероприятия
                    </Button>
                    <Button
                        variant={activeTab === "reviews" ? "default" : "ghost"}
                        className="w-full justify-start cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab("reviews")}
                        style={activeTab === "reviews" ? { backgroundColor: 'var(--primary-color)' } : {}}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" /> Мои отзывы
                    </Button>
                    <Button
                        variant={activeTab === "chats" ? "default" : "ghost"}
                        className="w-full justify-start cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab("chats")}
                        style={activeTab === "chats" ? { backgroundColor: 'var(--primary-color)' } : {}}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" /> Чаты
                    </Button>
                    {/*<Button
                        variant={activeTab === "settings" ? "default" : "ghost"}
                        className="w-full justify-start cursor-pointer hover:bg-muted/50"
                        onClick={() => setActiveTab("settings")}
                        style={activeTab === "settings" ? { backgroundColor: 'var(--primary-color)' } : {}}
                    >
                      <Settings className="h-4 w-4 mr-2" /> Настройки
                    </Button>*/}
                    <div className="pt-4 border-t">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive cursor-pointer hover:bg-destructive/10">
                            <AlertTriangle className="h-4 w-4 mr-2" /> Удалить профиль
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Это действие нельзя отменить. Ваш профиль и все связанные данные будут удалены навсегда.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <Label htmlFor="password">Введите пароль для подтверждения</Label>
                            <Input
                                id="password"
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Ваш пароль"
                                className="mt-2"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="cursor-pointer hover:bg-muted/50">Отмена</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                                disabled={!deletePassword}
                                onClick={handleDeleteProfile}
                            >
                              Удалить профиль
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </nav>
                </div>
              </div>

              {/* Content */}
              <div className="lg:col-span-3">
                <div className="bg-card border rounded-lg p-6">
                  {/* ===== Вкладка Профиль ===== */}
                  {activeTab === "personal" && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="mb-4">Профиль</h2>
                        </div>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20">
                            <AvatarImage src={avatarPreview || profile.avatarUrl} alt={profile.userName || "Аватар"} />
                            <AvatarFallback>{(profile.userName || profile.email || "П")[0]}</AvatarFallback>
                          </Avatar>
                          {isEditing && (
                              <div className="flex-1">
                                <Label htmlFor="avatar">Аватар</Label>
                                <Input
                                    id="avatar"
                                    type="file"
                                    accept="image/png,image/jpeg,image/gif,image/bmp"
                                    onChange={handleAvatarChange}
                                    className="mt-2 cursor-pointer"
                                />
                                <p className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF или BMP. Сохранится вместе с профилем.</p>
                              </div>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="userName">Имя пользователя</Label>
                            <Input
                                id="userName"
                                value={formData.userName}
                                onChange={handleInputChange}
                                className="mt-2 disabled:border-gray-300 disabled:bg-gray-50"
                                disabled={!isEditing}
                            />
                          </div>
                          <div>
                            <Label htmlFor="alias">Псевдоним</Label>
                            <Input
                                id="alias"
                                value={formData.alias}
                                onChange={handleInputChange}
                                className="mt-2 disabled:border-gray-300 disabled:bg-gray-50"
                                disabled={!isEditing}
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={profile.email}
                                className="mt-2 disabled:border-gray-300 disabled:bg-gray-50"
                                disabled
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Телефон</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="mt-2 disabled:border-gray-300 disabled:bg-gray-50"
                                disabled={!isEditing}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="biography">О себе</Label>
                          <textarea
                              id="biography"
                              value={formData.biography}
                              onChange={handleInputChange}
                              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[100px] mt-2 disabled:border-gray-300 disabled:bg-gray-50"
                              placeholder="Расскажите о себе..."
                              disabled={!isEditing}
                          />
                        </div>
                        <div>
                          <Label htmlFor="location" className="mb-2 block">Локация</Label>
                          <div id="location">
                            <Map
                                defaultState={{ center: [53.90, 27.58], zoom: 11 }}
                                width="100%"
                                height="400px"
                                onClick={handleMapClick}
                                options={{ draggable: isEditing }}
                            >
                              {mapCoordinates && <Placemark geometry={mapCoordinates} />}
                              <SearchControl options={{ float: "right" }} />
                            </Map>
                            {!isEditing && (
                                <p className="text-sm text-muted-foreground mt-2 text-center">
                                  Нажмите "Редактировать профиль" чтобы изменить локацию
                                </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 bg-muted/30 p-4 rounded-lg">
                          <div>
                            <Label className="text-sm font-semibold">Адрес</Label>
                            <p className="mt-1 text-muted-foreground">{formatAddress(displayData.address)}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-semibold">Координаты</Label>
                            <p className="mt-1 text-muted-foreground">{formatCoordinates(displayData.coordinates)}</p>
                          </div>
                        </div>
                        {!isEditing ? (
                            <Button
                                onClick={handleEditProfile}
                                style={{ backgroundColor: 'var(--primary-color)' }}
                                className="cursor-pointer hover:opacity-90 w-full"
                            >
                              <Edit2 className="h-4 w-4 mr-2" /> Редактировать профиль
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={handleCancelEdit} className="cursor-pointer hover:bg-gray-100 flex-1">
                                <X className="h-4 w-4 mr-2" /> Отмена
                              </Button>
                              <Button
                                  onClick={handleSaveProfile}
                                  disabled={saving}
                                  style={{ backgroundColor: 'var(--primary-color)' }}
                                  className="cursor-pointer hover:opacity-90 flex-1"
                              >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4 mr-2" />
                                )}
                                {saving ? "Сохранение..." : "Сохранить изменения"}
                              </Button>
                            </div>
                        )}
                      </div>
                  )}

                  {/* ===== Вкладка Организатор ===== */}
                  {activeTab === "organizer" && (
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <h2 className="mb-0">Мои мероприятия (организатор)</h2>
                          <Button onClick={handleOpenCreateEvent} style={{ backgroundColor: 'var(--primary-color)' }} className="cursor-pointer hover:opacity-90">
                            <Megaphone className="h-4 w-4 mr-2" /> Организовать мероприятие
                          </Button>
                        </div>
                        {organizerEventsLoading ? (
                            <div className="flex justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                            </div>
                        ) : organizerEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {organizerEvents.map((event) => (
                                  <div key={event.id} className="relative group">
                                    <EventCard event={event} />
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button size="sm" variant="outline" onClick={() => handleEditEvent(event)} className="cursor-pointer hover:bg-gray-100">
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive border-destructive hover:bg-destructive cursor-pointer"
                                          onClick={() => handleDeleteEvent(event.id!)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                              ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              У вас пока нет организованных мероприятий
                            </div>
                        )}
                      </div>
                  )}

                  {/* ===== Вкладка Мои мероприятия ===== */}
                  {activeTab === "events" && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="mb-4">Мои мероприятия</h2>
                          <p className="text-muted-foreground mb-6">Мероприятия, на которые вы записались</p>
                        </div>
                        {eventsLoading ? (
                            <div className="flex justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                            </div>
                        ) : userEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {userEvents.map((event) => (
                                  <EventCard key={event.id} event={event} />
                              ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              Вы еще не записались ни на одно мероприятие
                            </div>
                        )}
                      </div>
                  )}

                  {/* ===== Вкладка Чаты ===== */}
                  {activeTab === "chats" && (
                      <div className="space-y-4">
                        <h2 className="mb-4">Чаты</h2>
                        {chats.length === 0 ? (
                            <p className="text-muted-foreground">Чатов пока нет. Они появляются у организатора и участников мероприятия.</p>
                        ) : chats.map((chat) => (
                            <Link
                                key={chat.eventId}
                                to={`/events/${chat.eventId}/chat`}
                                className="block border rounded-lg p-4 hover:bg-muted/40"
                            >
                              <div className="font-medium">{chat.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {chat.date}{chat.access === "history" ? " · только история до выхода" : ""}
                              </div>
                            </Link>
                        ))}
                      </div>
                  )}

                  {/* ===== Вкладка Мои отзывы ===== */}
                  {activeTab === "reviews" && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="mb-4">Мои отзывы</h2>
                          <p className="text-muted-foreground mb-6">Отзывы, которые вы оставили об организаторах</p>
                        </div>
                        {reviewsLoading ? (
                            <div className="flex justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                            </div>
                        ) : userReviews.length > 0 ? (
                            <div className="space-y-4">
                              {userReviews.map((review) => (
                                  <ReviewItem key={review.id} review={review} />
                              ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">У вас пока нет отзывов</div>
                        )}
                      </div>
                  )}

                  {/* ===== Вкладка Настройки ===== */}
                  {activeTab === "settings" && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="mb-4">Настройки</h2>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h3 className="mb-2">Изменить пароль</h3>
                            <div className="space-y-3 max-w-md">
                              <div>
                                <Label htmlFor="currentPassword">Текущий пароль</Label>
                                <Input id="currentPassword" type="password" className="mt-2" />
                              </div>
                              <div>
                                <Label htmlFor="newPassword">Новый пароль</Label>
                                <Input id="newPassword" type="password" className="mt-2" />
                              </div>
                              <div>
                                <Label htmlFor="confirmPassword">Подтвердите новый пароль</Label>
                                <Input id="confirmPassword" type="password" className="mt-2" />
                              </div>
                              <Button style={{ backgroundColor: 'var(--primary-color)' }} className="cursor-pointer hover:opacity-90">Изменить пароль</Button>
                            </div>
                          </div>
                          <div className="pt-6 border-t">
                            <h3 className="mb-2">Уведомления</h3>
                            <div className="space-y-3 max-w-md">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="emailNotif">Email уведомления</Label>
                                <input type="checkbox" id="emailNotif" defaultChecked className="h-4 w-4 cursor-pointer" />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="newsNotif">Новости и акции</Label>
                                <input type="checkbox" id="newsNotif" className="h-4 w-4 cursor-pointer" />
                              </div>
                            </div>
                          </div>
                          <div className="pt-6 border-t lg:hidden">
                            <h3 className="mb-4">Опасная зона</h3>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full cursor-pointer hover:bg-destructive/90">
                                  <AlertTriangle className="h-4 w-4 mr-2" /> Удалить профиль
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Это действие нельзя отменить. Ваш профиль и все связанные данные будут удалены навсегда.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                  <Label htmlFor="password-mobile">Введите пароль для подтверждения</Label>
                                  <Input
                                      id="password-mobile"
                                      type="password"
                                      value={deletePassword}
                                      onChange={(e) => setDeletePassword(e.target.value)}
                                      placeholder="Ваш пароль"
                                      className="mt-2"
                                  />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="cursor-pointer hover:bg-gray-100">Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                                      disabled={!deletePassword}
                                      onClick={handleDeleteProfile}
                                  >
                                    Удалить профиль
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />

        {/* Модальное окно создания / редактирования мероприятия */}
        <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
          <DialogContent
              className="max-h-[90vh] overflow-y-auto"
              style={{ maxWidth: "90vw", width: "90vw" }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Редактировать мероприятие" : "Организовать мероприятие"}
              </DialogTitle>
              <DialogDescription>
                {editingEvent
                    ? "Измените данные мероприятия"
                    : "Заполните информацию о новом мероприятии"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event-title">Название *</Label>
                  <Input
                      id="event-title"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="event-category">Категория</Label>
                  <Select
                      value={eventFormData.category}
                      onValueChange={(value) => setEventFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger id="event-category" className="mt-2 cursor-pointer">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category} className="cursor-pointer">
                            {category}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="event-date">Дата *</Label>
                  <Input
                      id="event-date"
                      type="date"
                      value={eventFormData.date}
                      onChange={(e) => setEventFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="event-time">Время</Label>
                  <Input
                      id="event-time"
                      type="time"
                      value={eventFormData.time}
                      onChange={(e) => setEventFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="event-location">Место проведения *</Label>
                  <Input
                      id="event-location"
                      value={eventFormData.location}
                      onChange={(e) => setEventFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="event-address">Адрес</Label>
                  <Input
                      id="event-address"
                      value={eventFormData.address || ""}
                      onChange={(e) => setEventFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="event-availableSpots">Доступные места</Label>
                  <Input
                      id="event-availableSpots"
                      type="number"
                      value={eventFormData.availableSpots ?? ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setEventFormData(prev => ({
                          ...prev,
                          availableSpots: Math.max(0, value),
                        }));
                      }}
                      className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="event-totalSpots">Всего мест</Label>
                  <Input
                      id="event-totalSpots"
                      type="number"
                      value={eventFormData.totalSpots ?? ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setEventFormData(prev => ({
                          ...prev,
                          totalSpots: Math.max(0, value),
                        }));
                      }}
                      className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Изображения мероприятия</Label>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                          <img
                              src={url}
                              alt={`Изображение ${index + 1}`}
                              className="w-full h-full object-cover"
                          />
                          <button
                              type="button"
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-1 hover:bg-red-600 cursor-pointer"
                              onClick={() => removeImage(index, index < existingImages.length)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {index === 0 && (
                              <Badge className="absolute bottom-0 left-0 rounded-tl-none rounded-br-none text-xs">
                                Превью
                              </Badge>
                          )}
                        </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                        type="file"
                        accept="image/png,image/jpeg"
                        multiple
                        onChange={handleImageUpload}
                        className="mt-2 cursor-pointer"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Первое изображение будет использоваться как превью. Поддерживаются PNG и JPG.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="event-description">Описание</Label>
                <Textarea
                    id="event-description"
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-2"
                    rows={4}
                />
              </div>
              <div>
                <Label className="mb-2 block">Локация на карте (нажмите для выбора координат)</Label>
                <Map
                    defaultState={{
                      center: eventFormData.coordinates || [53.90, 27.58],
                      zoom: 11,
                    }}
                    width="100%"
                    height="300px"
                    onClick={handleMapClickForEvent}
                >
                  {eventFormData.coordinates && (
                      <Placemark geometry={eventFormData.coordinates} />
                  )}
                  <SearchControl options={{ float: "right" }} />
                </Map>

                <div className="space-y-1 mt-2 bg-muted/30 p-3 rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Адрес:</span>{" "}
                    <span className="text-muted-foreground">
                      {eventFormData.address || "не определён"}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Координаты:</span>{" "}
                    <span className="text-muted-foreground">
                      {eventFormData.coordinates
                          ? `${eventFormData.coordinates[0].toFixed(6)}, ${eventFormData.coordinates[1].toFixed(6)}`
                          : "не выбраны"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEventModalOpen(false)} className="cursor-pointer hover:bg-gray-100">
                  Отмена
                </Button>
                <Button
                    onClick={handleSaveEvent}
                    disabled={
                        eventFormSaving ||
                        !eventFormData.title ||
                        !eventFormData.date
                    }
                    style={{ backgroundColor: 'var(--primary-color)' }}
                    className="cursor-pointer hover:opacity-90"
                >
                  {eventFormSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingEvent ? "Сохранить" : "Создать мероприятие"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}