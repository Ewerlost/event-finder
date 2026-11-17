import { useState } from "react";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { EVENT_CATEGORIES } from "../constants/defaultConstants";
import { SERVER_URL } from "../config/serverConfig";

const DISMISS_KEY = "event-finder-interest-survey-dismissed";

export function interestSurveyDismissed() {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissInterestSurvey() {
    sessionStorage.setItem(DISMISS_KEY, "1");
}

type InterestSurveyProps = {
    open: boolean;
    token: string;
    onOpenChange: (open: boolean) => void;
    onSaved: (interests: string[]) => void;
};

export function InterestSurvey({ open, token, onOpenChange, onSaved }: InterestSurveyProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const close = () => {
        dismissInterestSurvey();
        onOpenChange(false);
    };

    const save = async () => {
        setSaving(true);
        setError("");
        try {
            const response = await fetch(`${SERVER_URL}/api/v1.0/recommendations/interests`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ interests: selected }),
            });
            if (!response.ok) {
                setError("Не удалось сохранить интересы");
                return;
            }
            const data = await response.json();
            onSaved(data.interests || selected);
            onOpenChange(false);
        } catch {
            setError("Не удалось сохранить интересы");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) dismissInterestSurvey();
                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Что вам интересно?</DialogTitle>
                    <DialogDescription>
                        Пока нет записей на встречи, блок «Для вас» собирается по этой анкете.
                        Дальше к ней добавляются категории, на которые вы уже ходили.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap gap-2">
                    {EVENT_CATEGORIES.map((item) => {
                        const active = selected.includes(item);
                        return (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setSelected((current) => active
                                    ? current.filter((value) => value !== item)
                                    : [...current, item])}
                                className="rounded-full border px-3 py-1 text-sm cursor-pointer"
                                style={active
                                    ? { backgroundColor: "var(--primary-color)", borderColor: "var(--primary-color)", color: "white" }
                                    : undefined}
                            >
                                {item}
                            </button>
                        );
                    })}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={close} disabled={saving}>
                        Позже
                    </Button>
                    <Button
                        type="button"
                        onClick={save}
                        disabled={saving || selected.length === 0}
                        style={{ backgroundColor: "var(--primary-color)" }}
                    >
                        {saving ? "Сохранение..." : "Сохранить"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
