import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
import { HomePage } from "./pages/home";
import { EventDetailPage } from "./pages/event-detail";
import { OrganizerPage } from "./pages/organizer";
import { ProfilePage } from "./pages/profile";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { EmailConfirmation } from "./pages/emailConfirmation";
import { NotFoundPage } from "./pages/not-found";
import { AboutPage } from "./pages/about";
import { EventChatPage } from "./pages/event-chat";
import { EventsMapPage } from "./pages/events-map";
import { UserPage } from "./pages/user";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { YMaps } from "@pbe/react-yandex-maps";
import { ResetPasswordPage } from "./pages/reset-password";
import { YMAP_API_KEY } from "./config/YMapConfig";
import {HashRouter} from "react-router-dom";

const PrivateHome = () => {
    const { token } = useAuth();
    return token ? <HomePage /> : <Navigate to="/login" replace />;
};

export default function App() {
    return (
        <YMaps query={{ apikey: YMAP_API_KEY }}>
            <AuthProvider>
                <HashRouter>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/email-confirmation" element={<EmailConfirmation />} />
                        <Route path="/" element={<PrivateHome />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/map" element={<EventsMapPage />} />
                        <Route path="/events/:id" element={<EventDetailPage />} />
                        <Route path="/events/:id/chat" element={<EventChatPage />} />
                        <Route path="/users/:id" element={<UserPage />} />
                        <Route path="/organizers/:id" element={<OrganizerPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </HashRouter>
                <ToastContainer />
            </AuthProvider>
        </YMaps>
    );
}