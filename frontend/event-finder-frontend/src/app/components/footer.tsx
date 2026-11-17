import { Mail, Facebook, Instagram, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="mb-4">EventFinder</h3>
            <p className="text-sm text-muted-foreground">
              Платформа для поиска интересных мероприятий и организации незабываемых событий.
            </p>
          </div>

          {/* Contact Section */}
          <div>
            <h4 className="mb-4">Контакты</h4>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href="mailto:info@eventhub.com" className="hover:text-foreground transition-colors">
                info@eventhub.com
              </a>
            </div>
          </div>

          {/* Social Section */}
          <div>
            <h4 className="mb-4">Социальные сети</h4>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {currentYear} EventFinder. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
