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

export const CATEGORY_MARKER_COLORS: Record<string, string> = {
    "Музыка": "#7c3aed",
    "Спорт": "#16a34a",
    "Искусство": "#db2777",
    "Бизнес": "#0f766e",
    "Технологии": "#1d4ed8",
    "Образование": "#b45309",
    "Развлечения": "#e11d48",
    "Еда и напитки": "#ea580c",
    "Природа": "#166534",
    "Другое": "#475569",
};

export function categoryMarkerColor(category?: string | null) {
    return CATEGORY_MARKER_COLORS[category || ""] || CATEGORY_MARKER_COLORS["Другое"];
}

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
