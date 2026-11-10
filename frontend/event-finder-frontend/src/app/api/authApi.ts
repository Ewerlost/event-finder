import { SERVER_URL } from "../config/serverConfig";

export interface AuthResponse {
    token: string;
    message?: string;
}

// ------------------ VERIFY EMAIL ------------------
export async function verifyEmail(token: string): Promise<AuthResponse> {
    const url = `${SERVER_URL}/api/v1.0/auth/verify?token=${encodeURIComponent(token)}`;

    const response = await fetch(url, {
        method: "GET",
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}

// ------------------ REGISTER ------------------
export async function register(email: string, password: string, isAtLeast16: boolean): Promise<void> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/auth/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, isAtLeast16 }),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
}

// ------------------ LOGIN ------------------
export async function login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }

    return await response.json();
}


// ------------------ FORGOT PASSWORD ------------------
export async function forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/auth/forgot-password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
}

// ------------------ RESET PASSWORD ------------------
export async function resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${SERVER_URL}/api/v1.0/auth/reset-password`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
        const error = new Error(`${response.status}`);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
}
