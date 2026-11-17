import { Link } from "react-router-dom";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { EventEntity } from '../entities/event.types'
import { useEventCover } from "../helpers/eventCover";

interface EventCardProps {
  event: EventEntity;
  compact?: boolean;
}

export function EventCard({ event, compact = false }: EventCardProps) {
  const cover = useEventCover(event);
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  return (
      <Link
          to={`/events/${event.id}`}
          className="group block bg-card rounded-lg overflow-hidden border hover:shadow-lg hover:bg-gray-50 transition-all duration-300 cursor-pointer"
      >
        <div className="relative overflow-hidden aspect-[16/9]">
          <img
              src={cover.src}
              onError={cover.onError}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Badge
              className="absolute top-3 right-3"
              style={{ backgroundColor: 'var(--primary-color)' }}
          >
            {event.category}
          </Badge>
        </div>

        <div className={compact ? "p-3 space-y-3" : "p-4 space-y-3"}>
          <h3 className={compact ? "text-base" : ""}>{event.title}</h3>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(event.date)}</span>
              <Clock className="h-4 w-4 ml-2" />
              <span>{event.time}</span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Avatar className="h-6 w-6">
              <AvatarImage src={event.organizerAvatar} alt={event.organizerName} />
              <AvatarFallback>{event.organizerName?.[0] || "О"}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{event.organizerName}</span>
          </div>
        </div>
      </Link>
  );
}