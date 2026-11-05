import { SERVER_URL } from "../config/serverConfig";

export function mediaUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${SERVER_URL}${url}`;
}
