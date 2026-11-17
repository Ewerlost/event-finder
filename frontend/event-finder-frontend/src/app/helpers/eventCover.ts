import { useEffect, useState } from "react";
import { getEventCardImageUrl } from "./getEventCardImageUrl";

const COVER_FILES: Record<string, string> = {
    "Музыка": "music.svg",
    "Спорт": "sport.svg",
    "Искусство": "art.svg",
    "Бизнес": "business.svg",
    "Технологии": "tech.svg",
    "Образование": "education.svg",
    "Развлечения": "fun.svg",
    "Еда и напитки": "food.svg",
    "Природа": "nature.svg",
    "Другое": "other.svg",
};

export function categoryCoverUrl(category?: string | null) {
    const file = COVER_FILES[category || ""] || COVER_FILES["Другое"];
    return `${import.meta.env.BASE_URL}covers/${file}`;
}

export function useEventCover(event: { id?: string; image?: string | null; category?: string | null }) {
    const fallback = categoryCoverUrl(event.category);
    const uploaded = event.image && event.id ? getEventCardImageUrl(event.id) : fallback;
    const [src, setSrc] = useState(uploaded);

    useEffect(() => {
        setSrc(uploaded);
    }, [uploaded]);

    return {
        src,
        onError: () => {
            if (src !== fallback) setSrc(fallback);
        },
    };
}
