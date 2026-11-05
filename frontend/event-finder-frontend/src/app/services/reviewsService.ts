import {
    getAllReviews,
    getReviewById,
    getUserReviews,
    createReview,
    updateReview,
    deleteReview, getOrganizerReviews, getEventReviews
} from "../api/reviewsApi";

import { ReviewEntity } from "../entities/review.types";


class ReviewsService {
    private currentUserId: string | null = null;

    setCurrentUserId(userId: string) {
        this.currentUserId = userId;
    }

    async getAllReviews(token: string): Promise<ReviewEntity[]> {
        try {
          return await getAllReviews(token);
        } catch (error) {
            console.error("Error fetching all reviews:", error);
            throw error;
        }
    }

    async getReviewById(reviewId: string, token: string): Promise<ReviewEntity> {
        try {
            return await getReviewById(reviewId, token);
        } catch (error) {
            console.error("Error fetching review by id:", error);
            throw error;
        }
    }

    // Метод для получения отзывов определенного автора
    async getUserReviews(userId: string, token: string): Promise<ReviewEntity[]> {
        try {
            return await getUserReviews(userId, token);
        } catch (error) {
            console.error("Error fetching user reviews:", error);
            throw error;
        }
    }

    async getEventReviews(eventId: string, token: string): Promise<ReviewEntity[]> {
        try {
            return await getEventReviews(eventId, token);
        } catch (error) {
            console.error("Error fetching event reviews:", error);
            throw error;
        }
    }

    // Метод для получения отзывов об организаторе
    async getReviewsByOrganizer(organizerId: string, token: string): Promise<ReviewEntity[]> {
        try {
            return await getOrganizerReviews(organizerId, token);
        }  catch (error) {
            console.error("Error fetching reviews by organizer:", error);
            throw error;
        }
    }

    async createReview(reviewData: ReviewEntity, token: string): Promise<ReviewEntity> {
        try {
            return await createReview(reviewData, token);
        } catch (error) {
            console.error("Error creating review:", error);
            throw error;
        }
    }

    async updateReview(reviewId: string, reviewData: ReviewEntity, token: string): Promise<ReviewEntity> {
        try {
            return await updateReview(reviewId, reviewData, token);
        } catch (error) {
            console.error("Error updating review:", error);
            throw error;
        }
    }

    async deleteReview(reviewId: string, token: string): Promise<void> {
        try {
            await deleteReview(reviewId, token);
        } catch (error) {
            console.error("Error deleting review:", error);
            throw error;
        }
    }
}

export const reviewsService = new ReviewsService();