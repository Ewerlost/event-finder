import { Link } from "react-router-dom";
import { CalendarPlus, MapPin, Search, UserCheck } from "lucide-react";
import { Header } from "../components/header";
import { Footer } from "../components/footer";
import { Button } from "../components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { useAuth } from "../context/AuthContext";

const steps = [
  {
    title: "Создайте аккаунт",
    text: "Зарегистрируйтесь по почте и перейдите по ссылке из письма. Без подтверждения войти не получится.",
  },
  {
    title: "Найдите или создайте мероприятие",
    text: "В ленте можно искать по названию, городу и категории. Своё событие собирается в профиле: дата, место на карте, число мест и фото.",
  },
  {
    title: "Запишитесь или примите гостей",
    text: "На карточке события видно, сколько мест осталось. Организатор видит свои мероприятия и отзывы о них.",
  },
];

const faqs = [
  {
    question: "Нужна ли регистрация?",
    answer:
      "Да. Лента, запись на событие и создание мероприятия доступны после входа. Почту нужно подтвердить по ссылке из письма.",
  },
  {
    question: "Сколько действует ссылка из письма?",
    answer: "Ссылка для подтверждения почты и для сброса пароля действует 24 часа. Если она протухла, запросите новую.",
  },
  {
    question: "Кто может изменить мероприятие?",
    answer: "Только организатор, который его создал. Чужое событие можно посмотреть, на него записаться и оставить отзыв.",
  },
  {
    question: "Как отменить запись?",
    answer: "Откройте страницу мероприятия и отмените участие. Свободное место вернётся в счётчик.",
  },
  {
    question: "Где оставить отзыв?",
    answer: "На странице мероприятия, когда вы вошли в аккаунт. Отзыв виден на карточке организатора.",
  },
];

export function AboutPage() {
  const { token, userName } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Header isAuthenticated={!!token} userName={userName} />
      <main className="flex-1">
        <section className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h1 className="text-4xl md:text-5xl mb-4">EventHub</h1>
            <p className="text-lg md:text-xl opacity-90">
              Сервис, где можно найти мероприятие в своём городе или собрать своё: от камерного вечера до открытой встречи.
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl mb-6">Для кого</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="rounded-xl border bg-card p-6">
              <Search className="h-6 w-6 mb-4 text-indigo-500" />
              <h3 className="text-xl mb-3">Гостю</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex gap-2"><MapPin className="h-4 w-4 mt-1 shrink-0" /> Лента с фильтром по городу и категории</li>
                <li className="flex gap-2"><UserCheck className="h-4 w-4 mt-1 shrink-0" /> Запись на событие и отмена, если планы изменились</li>
                <li>Карточка организатора, его события и отзывы других людей</li>
              </ul>
            </article>
            <article className="rounded-xl border bg-card p-6">
              <CalendarPlus className="h-6 w-6 mb-4 text-indigo-500" />
              <h3 className="text-xl mb-3">Организатору</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Событие с датой, адресом и точкой на карте</li>
                <li>Число мест, обложка и описание</li>
                <li>Свои мероприятия и отзывы собраны в профиле</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="bg-muted/40">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <h2 className="text-2xl mb-6">Как это работает</h2>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-xl border bg-background p-6">
                  <p className="text-sm text-indigo-500 mb-2">Шаг {index + 1}</p>
                  <h3 className="text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild style={{ backgroundColor: "var(--primary-color)" }}>
                <Link to="/">К мероприятиям</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/profile">Стать организатором</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
          <h2 className="text-2xl mb-6">Вопросы</h2>
          <Accordion type="single" collapsible>
            {faqs.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
      <Footer />
    </div>
  );
}
