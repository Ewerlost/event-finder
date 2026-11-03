import { useState } from "react";
import { Link } from "react-router-dom";
import { User, LogOut, Calendar, MessageSquare, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {useAuth} from "../context/AuthContext";

interface HeaderProps {
  isAuthenticated?: boolean;
  userName?: string;
}

export function Header({ isAuthenticated = false, userName = "Пользователь" }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {logout} = useAuth();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
              EventHub
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="transition-colors"
              style={{ transition: 'var(--hover-button-transition)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-hover-text-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
            >
              Мероприятия
            </Link>
{/*            <Link
              to="/organizers/org1"
              className="transition-colors"
              style={{ transition: 'var(--hover-button-transition)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-hover-text-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
            >
              Организаторы
            </Link>*/}
            <Link
              to="/about"
              className="transition-colors"
              style={{ transition: 'var(--hover-button-transition)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-hover-text-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
            >
              О нас
            </Link>
          </nav>

          {/* User Section */}
          <div className="flex items-center space-x-4 cursor-pointer">
            {!isAuthenticated ? (
              <Button
                asChild
                className="hidden md:inline-flex"
                style={{
                  backgroundColor: 'var(--primary-color)',
                  transition: 'var(--hover-button-transition)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-hover-color)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-color)')}
              >
                <Link to="/profile">Войти</Link>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="hidden md:flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Профиль
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center cursor-pointer">
                      <Calendar className="mr-2 h-4 w-4" />
                      Мои мероприятия
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center cursor-pointer">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Мои отзывы
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Выход
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

/*                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden md:flex items-center space-x-2 p-2 border">
                      <User className="h-5 w-5" />
                      <span>{userName}</span>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent>
                    <DropdownMenuItem>Test Item 1</DropdownMenuItem>
                    <DropdownMenuItem>Test Item 2</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>*/
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 space-y-3">
            <Link to="/" className="block py-2" onClick={() => setMobileMenuOpen(false)}>
              Мероприятия
            </Link>
{/*            <Link to="/organizers/org1" className="block py-2" onClick={() => setMobileMenuOpen(false)}>
              Организаторы
            </Link>*/}
            <Link to="/about" className="block py-2" onClick={() => setMobileMenuOpen(false)}>
              О нас
            </Link>
            {!isAuthenticated ? (
              <Button
                asChild
                className="w-full"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                <Link to="/profile">Войти</Link>
              </Button>
            ) : (
              <div className="space-y-2 pt-2 border-t">
                <Link to="/profile" className="flex items-center py-2" onClick={() => setMobileMenuOpen(false)}>
                  <User className="mr-2 h-4 w-4" />
                  Профиль
                </Link>
                <Link to="/profile" className="flex items-center py-2" onClick={() => setMobileMenuOpen(false)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Мои мероприятия
                </Link>
                <button className="flex items-center py-2 w-full text-left">
                  <LogOut className="mr-2 h-4 w-4" />
                  Выход
                </button>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
