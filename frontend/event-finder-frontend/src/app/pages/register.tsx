import { useState } from "react";
import {Link, useNavigate } from "react-router-dom";
import isEmailValid from "../helpers/isEmailValid";
import { register } from "../api/authApi";
import { showSuccess, showError } from "../helpers/toastUtils";

export const RegisterPage = () => {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");

    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [repeatPasswordError, setRepeatPasswordError] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [acceptedRules, setAcceptedRules] = useState(false);
    const [isAtLeast16, setIsAtLeast16] = useState(false);
    const [ageError, setAgeError] = useState("");

    // password checks
    const hasLength = password.length >= 8 && password.length <= 40;
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecial = /[!@#$%^&*()\-+=\[\]{};:'",.<>/?\\|]/.test(password);
    const hasNoSpaces = !/\s/.test(password);

    const passwordValid = hasLength && hasUppercase && hasSpecial && hasNoSpaces;
    const emailValid = isEmailValid(email);
    const passwordsMatch = password !== "" && repeatPassword !== "" && password === repeatPassword;

    const formValid = emailValid && passwordValid && passwordsMatch && acceptedRules && isAtLeast16;

    const onSubmitClick = async () => {
        let hasError = false;

        if (!email) {
            setEmailError("Введите email");
            hasError = true;
        } else if (!emailValid) {
            setEmailError("Некорректный формат email");
            hasError = true;
        } else setEmailError("");

        if (!passwordValid) {
            setPasswordError("Пароль не соответствует требованиям");
            hasError = true;
        } else setPasswordError("");

        if (!passwordsMatch) {
            setRepeatPasswordError("Пароли не совпадают");
            hasError = true;
        } else setRepeatPasswordError("");

        if (!isAtLeast16) {
            setAgeError("Подтвердите, что вам есть 16 лет");
            hasError = true;
        } else setAgeError("");

        if (!acceptedRules) hasError = true;

        if (hasError) return;

        try {
            await register(email, password, true);
            showSuccess("Регистрация прошла успешно! Пожалуйста, проверьте электронную почту для подтверждения!");
            navigate("/login");
        } catch (err: any) {
            switch (err.status) {
                case 409:
                    showError("Email уже занят");
                    break;
                case 500:
                    showError("Ошибка сервера, попробуйте позже");
                    break;
                default:
                    showError("Произошла ошибка при регистрации");
            }
        }
    };

    const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEmail(value);
        if (!value) setEmailError("");
        else if (!isEmailValid(value)) setEmailError("Некорректный формат email");
        else setEmailError("");
    };

    const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPassword(value);
        setPasswordError("");
        if (repeatPassword && value !== repeatPassword) setRepeatPasswordError("Пароли не совпадают");
        else setRepeatPasswordError("");
    };

    const onRepeatPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setRepeatPassword(value);
        if (password && value !== password) setRepeatPasswordError("Пароли не совпадают");
        else setRepeatPasswordError("");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-[420px] bg-white rounded-xl shadow-md p-6">
                <h2 className="text-xl font-medium text-center mb-4 text-[var(--primary-text-color)]">
                    Регистрация
                </h2>

                <div className="space-y-4">
                    {/* EMAIL */}
                    <div>
                        <label className="block mb-1 text-[var(--primary-text-color)]">Email</label>
                        <input
                            type="email"
                            value={email}
                            maxLength={100}
                            onChange={onEmailChange}
                            placeholder="Введите email..."
                            className={`w-full px-3 py-2 border rounded-md outline-none transition ${
                                emailError
                                    ? "border-red-500 focus:ring-1 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-1 focus:ring-indigo-500 hover:border-indigo-400"
                            }`}
                        />
                        {emailError && <p className="text-sm text-red-500 mt-1">{emailError}</p>}
                    </div>

                    {/* PASSWORD */}
                    <div>
                        <label className="block mb-1 text-[var(--primary-text-color)]">Пароль</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                maxLength={40}
                                onChange={onPasswordChange}
                                placeholder="Введите пароль..."
                                className={`w-full px-3 py-2 border rounded-md outline-none transition pr-10 ${
                                    passwordError
                                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-1 focus:ring-indigo-500 hover:border-indigo-400"
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-black"
                            >
                                {showPassword ? "🙈" : "👁"}
                            </button>
                        </div>
                        {passwordError && <p className="text-sm text-red-500 mt-1">{passwordError}</p>}
                    </div>

                    {/* PASSWORD CHECKLIST */}
                    <div className="text-sm space-y-1">
                        <p className={hasLength ? "text-green-600" : "text-gray-400"}>• 8-40 символов</p>
                        <p className={hasUppercase ? "text-green-600" : "text-gray-400"}>• минимум 1 заглавная буква</p>
                        <p className={hasSpecial ? "text-green-600" : "text-gray-400"}>• минимум 1 спецсимвол</p>
                        <p className={hasNoSpaces ? "text-green-600" : "text-gray-400"}>• без пробелов</p>
                    </div>

                    {/* REPEAT PASSWORD */}
                    <div>
                        <label className="block mb-1 text-[var(--primary-text-color)]">Повторите пароль</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={repeatPassword}
                                maxLength={40}
                                onChange={onRepeatPasswordChange}
                                placeholder="Повторите пароль..."
                                className={`w-full px-3 py-2 border rounded-md outline-none transition pr-10 ${
                                    repeatPasswordError
                                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-1 focus:ring-indigo-500 hover:border-indigo-400"
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute cursor-pointer right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-black"
                            >
                                {showPassword ? "🙈" : "👁"}
                            </button>
                        </div>
                        {repeatPasswordError && <p className="text-sm text-red-500 mt-1">{repeatPasswordError}</p>}
                    </div>

                    <label className="flex items-start gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={isAtLeast16}
                            onChange={(e) => {
                                setIsAtLeast16(e.target.checked);
                                if (e.target.checked) setAgeError("");
                            }}
                            className="mt-1 accent-indigo-500 cursor-pointer"
                        />
                        <span>Мне есть 16 лет</span>
                    </label>
                    {ageError && <p className="text-sm text-red-500 -mt-2">{ageError}</p>}

                    {/* CHECKBOX */}
                    <label className="flex items-start gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={acceptedRules}
                            onChange={(e) => setAcceptedRules(e.target.checked)}
                            className="mt-1 accent-indigo-500 cursor-pointer"
                        />
                        <span>
              Я согласен с{" "}
                            <a href="#" className="text-[var(--primary-color)] hover:underline">
                условиями использования
              </a>{" "}
                            и{" "}
                            <a href="#" className="text-[var(--primary-color)] hover:underline">
                политикой конфиденциальности
              </a>
            </span>
                    </label>

                    {/* SUBMIT */}
                    <button
                        disabled={!formValid}
                        onClick={onSubmitClick}
                        className={`w-full py-2 rounded-md text-white transition ${
                            formValid
                                ? "bg-[var(--primary-color)] cursor-pointer hover:bg-[var(--primary-hover-color)]"
                                : "bg-gray-400 cursor-not-allowed"
                        }`}
                    >
                        Зарегистрироваться
                    </button>

                    {/* LOGIN LINK */}
                    <p className="text-center text-sm text-[var(--primary-text-color)] pt-2">
                        Уже есть аккаунт?{" "}
                        <Link to="/login" className="text-[var(--primary-color)] hover:underline font-medium">
                            Войти
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};