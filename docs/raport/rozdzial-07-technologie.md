# 7. Uzasadnienie wyboru technologii i narzędzi programistycznych

Technologie dobrano do architektury z rozdziału 6 oraz do ograniczeń projektu:
dwuosobowego zespołu, krótkich terminów i braku budżetu na licencje (C-01, C-02,
C-03). Dla każdego kluczowego elementu podano rozważone alternatywy i powód
wyboru. Wszystkie wybrane narzędzia są dostępne na licencjach open source.

## 7.1 Zestawienie

| Obszar | Wybrana technologia | Wersja |
|---|---|---|
| Język backendu | Python | 3.13 |
| Framework backendu | Django, Django REST Framework | 5.2, 3.16 |
| Baza danych | PostgreSQL | 17 |
| Broker komunikatów | RabbitMQ (klient `pika`) | 4 |
| Język frontendu | TypeScript | 5.9 |
| Biblioteka interfejsu | React, React Router, TanStack Query | 19, 7, 5 |
| Narzędzie budowania frontendu | Vite | 7 |
| Uwierzytelnianie | Token JWT w ciasteczku `HttpOnly`, ochrona CSRF, skróty haseł Argon2 | – |
| Dokumentacja API | OpenAPI 3 (`drf-spectacular`), typy generowane przez `openapi-typescript` | – |
| Testy | pytest, pytest-django | 8 |
| Jakość kodu | ruff (Python), ESLint i Prettier (TypeScript) | – |
| Zarządzanie zależnościami | uv (Python), npm (JavaScript) | – |
| Konteneryzacja | Docker, Docker Compose | – |
| Kontrola wersji | Git, GitHub | – |

## 7.2 Backend: Python i Django

| Kryterium | Python + Django | Java + Spring Boot | C# + ASP.NET Core | Python + FastAPI |
|---|---|---|---|---|
| Szybkość wytwarzania | Bardzo wysoka | Średnia | Średnia | Wysoka |
| Gotowe elementy (ORM, migracje, konta, panel administracyjny) | Tak, w standardzie | Wymaga konfiguracji wielu modułów | Częściowo | Nie, trzeba dobrać osobno |
| Wydajność | Wystarczająca | Wysoka | Wysoka | Wysoka |
| Analiza danych i prognozy | Bogaty ekosystem Pythona | Ograniczony | Ograniczony | Bogaty ekosystem Pythona |
| Znajomość w zespole | Dobra | Podstawowa | Podstawowa | Podstawowa |

Wybrano **Python z Django**, ponieważ:

- wbudowany ORM, system migracji, model użytkownika i mechanizmy bezpieczeństwa
  pozwalają dwuosobowemu zespołowi skupić się na logice biznesowej;
- gotowy panel administracyjny od razu daje obsługę menu i kont pracowników,
  bez pisania osobnego interfejsu;
- podział projektu Django na aplikacje (`accounts`, `sales`) odpowiada modułom
  z rozdziału 6.4;
- Django ORM pozwala liczyć statystyki sprzedaży w Zamówieniach i wskaźniki
  dostaw w Realizacji. Zasoby mogą wykorzystać biblioteki Pythona do prognozy
  popytu i przeliczenia jej na zapotrzebowanie na składniki.

Niższa wydajność Pythona w porównaniu z Javą lub C# nie jest w tym systemie
istotna: obciążenie firmy kateringowej jest umiarkowane, a serwisy można
skalować w poziomie.

**Django REST Framework** dostarcza serializatory z walidacją, klasy uprawnień,
stronicowanie i ograniczanie liczby żądań, czyli elementy wymagane przez
NFR-01, NFR-02 i NFR-07.

## 7.3 Baza danych: PostgreSQL

| Kryterium | PostgreSQL | MySQL | MongoDB |
|---|---|---|---|
| Model danych | Relacyjny | Relacyjny | Dokumentowy |
| Transakcje i spójność | Pełne ACID | Pełne ACID | Ograniczone w porównaniu z bazami relacyjnymi |
| Ograniczenia i typy (UUID, JSON, warunki CHECK) | Bardzo dobre | Dobre | Nie dotyczy |
| Blokowanie wierszy z pominięciem zablokowanych (`SKIP LOCKED`) | Tak | Tak | Nie |
| Wsparcie w Django | Najpełniejsze | Dobre | Brak oficjalnego |

Wybrano **PostgreSQL**. Dane systemu (klienci, zamówienia, pozycje) są silnie
powiązane i wymagają transakcji, więc baza relacyjna jest naturalnym wyborem.
PostgreSQL obsługuje wszystkie mechanizmy użyte w projekcie: klucze UUID, pola
JSON na treść zdarzeń, warunki CHECK oraz blokady wierszy używane przy
składaniu zamówienia i publikacji zdarzeń. Jedna instancja PostgreSQL może
utrzymywać osobne bazy i konta dla każdego serwisu, co w prototypie zapewnia
separację danych bez uruchamiania kilku serwerów.

## 7.4 Komunikacja między serwisami: RabbitMQ

| Kryterium | RabbitMQ | Apache Kafka | Redis (kolejki) |
|---|---|---|---|
| Model | Broker komunikatów z kolejkami i routingiem | Rozproszony dziennik zdarzeń | Magazyn w pamięci z funkcją kolejek |
| Gwarancja dostarczenia | Trwałe kolejki, potwierdzenia | Bardzo wysoka | Słabsza, zależna od konfiguracji |
| Routing po typie zdarzenia | Wbudowany (wymiany `topic`) | Przez tematy | Ograniczony |
| Obsługa nieudanych wiadomości | Wbudowane kolejki dead letter | Wymaga własnej implementacji | Wymaga własnej implementacji |
| Złożoność uruchomienia | Niska, jeden kontener z panelem | Wysoka | Bardzo niska |
| Przeznaczenie | Integracja serwisów | Strumienie danych w dużej skali | Pamięć podręczna, proste zadania |

Wybrano **RabbitMQ**. Zdarzeń w firmie kateringowej jest stosunkowo niewiele
(rzędu tysięcy dziennie), ale każde musi dotrzeć do odbiorcy. RabbitMQ zapewnia
trwałe kolejki, potwierdzenia, routing według typu zdarzenia i kolejki dead
letter, a przy tym uruchamia się jako jeden kontener z panelem do podglądu
kolejek. Kafka oferuje większą przepustowość i odtwarzanie historii zdarzeń.
W prototypie RabbitMQ wystarcza do przekazywania danych potrzebnych magazynowi
i obliczania zapotrzebowania na podstawie historii zamówień zapisanej w Zasobach.

Do publikowania zdarzeń użyto biblioteki `pika` i własnej, niewielkiej
skrzynki nadawczej zamiast frameworka zadań w tle (np. Celery). Skrzynka
nadawcza daje gwarancję, że zdarzenie zostanie zapisane razem z zamówieniem,
czego samo zlecenie zadania do kolejki nie zapewnia.

## 7.5 Frontend: React i TypeScript

| Kryterium | React | Angular | Vue |
|---|---|---|---|
| Charakter | Biblioteka interfejsu | Kompletny framework | Framework progresywny |
| Próg wejścia | Średni | Wysoki | Niski |
| Ekosystem i dostępność materiałów | Największy | Duży | Duży |
| Elastyczność doboru narzędzi | Wysoka | Niska | Średnia |

Wybrano **React**, ponieważ budowa interfejsu z komponentów dobrze pasuje do
aplikacji z kilkoma panelami zależnymi od roli, a duży ekosystem skraca czas
pracy. Zastosowano **TypeScript** zamiast JavaScriptu: statyczne typy wykrywają
błędy przed uruchomieniem, a typy odpowiedzi serwera są generowane
automatycznie ze specyfikacji OpenAPI, więc niezgodność między frontendem
a API jest zgłaszana już na etapie kompilacji.

Narzędzia uzupełniające:

- **Vite** – szybkie uruchamianie i budowanie aplikacji; w środowisku
  deweloperskim przekierowuje żądania `/api/orders` do serwisu zamówień;
- **React Router** – nawigacja między widokami aplikacji jednostronicowej;
- **TanStack Query** – pobieranie danych z API, pamięć podręczna, obsługa
  stanów ładowania i błędów.

## 7.6 Uwierzytelnianie i bezpieczeństwo

| Rozwiązanie | Zalety | Wady |
|---|---|---|
| Sesja po stronie serwera | Proste, łatwe unieważnianie | Wspólny magazyn sesji dla wszystkich serwisów |
| Token JWT w pamięci przeglądarki (`localStorage`) | Proste po stronie klienta | Token dostępny dla skryptów, podatność na kradzież przy ataku XSS |
| **Token JWT w ciasteczku `HttpOnly` + ochrona CSRF** | Serwisy weryfikują token samodzielnie; token niedostępny dla skryptów | Wymaga ochrony CSRF |

Wybrano trzecie rozwiązanie. Token zawiera rolę użytkownika i jest ważny przez
godzinę, a każdy serwis może go zweryfikować bez odpytywania wspólnej bazy, co
pasuje do architektury z rozdziału 6. Hasła są zapisywane jako skróty
**Argon2**, czyli algorytmem obecnie zalecanym do przechowywania haseł.

## 7.7 Kontrakt API: OpenAPI

Specyfikacja interfejsu jest generowana z kodu przez `drf-spectacular`
i zapisywana w repozytorium (`docs/api/orders.openapi.yaml`). Służy jako
dokumentacja (interfejs Swagger UI), jako źródło typów dla frontendu oraz jako
kontrakt, którego zmiany są widoczne w historii repozytorium. Spełnia to
wymaganie NFR-12.

## 7.8 Narzędzia programistyczne

| Narzędzie | Zastosowanie | Uzasadnienie |
|---|---|---|
| Git, GitHub | Kontrola wersji, wspólne repozytorium | Standard branżowy; historia commitów dokumentuje przebieg prac |
| Docker, Docker Compose | Uruchamianie PostgreSQL i RabbitMQ | Identyczne środowisko u obu członków zespołu, brak ręcznej instalacji |
| uv | Zależności i środowisko Pythona | Jeden plik blokady wersji, obsługa wielu serwisów w jednym repozytorium |
| pytest, pytest-django | Testy automatyczne backendu | Zwięzły zapis testów, testy na prawdziwej bazie PostgreSQL |
| ruff | Formatowanie i statyczna analiza Pythona | Jedno szybkie narzędzie zamiast kilku |
| ESLint, Prettier | Analiza i formatowanie kodu TypeScript | Jednolity styl kodu frontendu |
| Swagger UI | Ręczne testowanie i przegląd API | Dostępny bezpośrednio w serwisie pod adresem `/api/orders/v1/docs/` |
| Panel RabbitMQ | Podgląd kolejek i wiadomości | Ułatwia diagnozowanie przepływu zdarzeń |
| Visual Studio Code | Edytor kodu | Bezpłatny, wsparcie dla Pythona i TypeScriptu |

## 7.9 Podsumowanie

Wybrany zestaw pozwala małemu zespołowi szybko dostarczać działające funkcje
(Django, React), a jednocześnie spełnia wymagania architektury sterowanej
zdarzeniami: PostgreSQL zapewnia transakcje i separację danych serwisów,
RabbitMQ niezawodne przekazywanie zdarzeń, a OpenAPI i TypeScript spójność
między backendem a frontendem.
