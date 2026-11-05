import { SERVER_URL } from "../config/serverConfig";
import {CreateReviewData, Review, UpdateReviewData} from "../dtos/review";
import {mockReviews} from "../data/mock-data";
import {ReviewEntity} from "../entities/review.types";

// GET /api/reviews - Получить список всех отзывов
export async function getAllReviews(token: string): Promise<ReviewEntity[]> {


    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// GET /api/reviews/{id} - Получить отзыв по ID
export async function getReviewById(reviewId: string, token: string): Promise<ReviewEntity> {

    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews/${reviewId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    
    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
    
    return await response.json();
}

// GET /api/reviews/user/{userId} - Получить отзывы пользователя (автора)
export async function getUserReviews(userId: string, token: string): Promise<ReviewEntity[]> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews/user/${userId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// GET /api/reviews/organizer/{organizerId} - Получить отзывы пользователя (автора)
export async function getOrganizerReviews(organizerId: string, token: string): Promise<ReviewEntity[]> {

    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews/organizer/${organizerId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

export async function getEventReviews(eventId: string, token: string): Promise<ReviewEntity[]> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews/event/${eventId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// POST /api/reviews - Создать отзыв
export async function createReview(reviewData: ReviewEntity, token: string): Promise<ReviewEntity> {

    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// PUT /api/reviews/{id} - Обновить отзыв
export async function updateReview(reviewId: string, reviewData: ReviewEntity, token: string): Promise<ReviewEntity> {

    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// DELETE /api/reviews/{id} - Удалить отзыв
export async function deleteReview(reviewId: string, token: string): Promise<void> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/reviews/${reviewId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
}