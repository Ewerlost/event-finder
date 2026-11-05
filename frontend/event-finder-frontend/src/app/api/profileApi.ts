import { SERVER_URL } from "../config/serverConfig";
import {UpdateUserData, User} from "../dtos/profile";
import {ProfileEntity} from "../entities/profile.types";

// Мок-данные для профиля
const mockUser: ProfileEntity = {
    id: "1",
    userName: "Александр",
    alias: "Иванов",
    email: "alexander@example.com",
    phone: "+375296559789",
    biography: "Люблю путешествия, фотографию и активный отдых. Организую мероприятия для единомышленников.",
    avatarUrl: "https://static.vecteezy.com/system/resources/previews/019/879/198/non_2x/user-icon-on-transparent-background-free-png.png",
};

function delay(ms: number = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}



// GET /api/users/{id} - Получить пользователя по ID
export async function getUserById(userId: string, token: string): Promise<ProfileEntity> {
       const response = await fetch(`${SERVER_URL}/api/v1.0/users/${userId}`, {
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

// GET /api/users - Получить список всех пользователей
export async function getUsers(token: string): Promise<ProfileEntity[]> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/users`, {
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

// PUT /api/users/{id} - Обновить данные пользователя
export async function updateUser(userId: string, userData: ProfileEntity, token: string): Promise<ProfileEntity> {


    const response = await fetch(`${SERVER_URL}/api/v1.0/users/${userId}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

export async function uploadAvatar(userId: string, file: File, token: string): Promise<ProfileEntity> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${SERVER_URL}/api/v1.0/users/${userId}/avatar`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// DELETE /api/users/{id} - Удалить пользователя
export async function deleteUser(userId: string, token: string, password: string): Promise<void> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/users/${userId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
}