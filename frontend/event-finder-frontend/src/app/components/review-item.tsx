import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ReviewEntity } from "../entities/review.types";
import { mediaUrl } from "../helpers/mediaUrl";

interface ReviewItemProps {
  review: ReviewEntity;
  onClick?: () => void;
}

export function ReviewItem({ review, onClick }: ReviewItemProps) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
        <Star
            key={i}
            className={`h-4 w-4 ${
                i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
        />
    ));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
      <div
          className={`border rounded-lg p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
          onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <Link
              to={review.userId ? `/users/${review.userId}` : "#"}
              onClick={(event) => event.stopPropagation()}
              className="shrink-0"
          >
            <Avatar>
              <AvatarImage src={mediaUrl(review.userAvatar)} alt={review.userName} />
              <AvatarFallback>{review.userName?.[0] || "U"}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4>{review.userName}</h4>
              <span className="text-sm text-muted-foreground">
              {formatDate(review.date)}
            </span>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {renderStars(review.rating)}
            </div>
            <p className="text-sm text-muted-foreground">{review.comment}</p>
          </div>
        </div>
      </div>
  );
}