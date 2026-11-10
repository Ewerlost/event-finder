export interface EventEntity {
    id?: string;
    title: string;
    description: string;    // описание мероприятия
    date: string;           // дата начала ("2026-03-22")
    time: string;           // время начала ("18:00")
    location: string;       // что это за место (бар "Огурец", Клуб "Пирожочек")
    address: string;        // адрес
    coordinates: [number, number];  // широта долгота
    category: string;       // категория
    image?: string;          // url превьюшки
    images?: string[];       // список всех изображений
    organizerId: string;     // ссылка на профиль организатора (по ней будем запрашивать данные профиля при переходе на него)
    organizerName: string;   // имя организатора
    organizerAvatar?: string; // url аватарки
    availableSpots?: number; // доступное количество мест
    totalSpots?: number;     // всего мест
    amIMember: boolean;      //записан ли я
    status?: string;
    amIWaitlisted?: boolean;
    waitlistPosition?: number | null;
}

