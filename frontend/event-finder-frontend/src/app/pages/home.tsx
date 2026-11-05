import { Header } from "../components/header";
import { HeroBanner } from "../components/hero-banner";
import { ForYou } from "../components/for-you";
import { EventFeed } from "../components/event-feed";
import { Footer } from "../components/footer";
import {useAuth} from "../context/AuthContext";

export function HomePage() {

    const {userName} = useAuth();

    return (
    <div className="min-h-screen flex flex-col">
      <Header isAuthenticated={true} userName={userName} />
      <main className="flex-1">
        <HeroBanner />
        <ForYou />
        <EventFeed />
      </main>
      <Footer />
    </div>
  );
}
