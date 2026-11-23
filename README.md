# CateringHub – system wspomagający działalność firmy kateringowej

Projekt realizowany w ramach przedmiotu **Inżynieria Oprogramowania 2026/2027**.

Temat: **Tworzenie oprogramowania dla firmy kateringowej**

## Opis

CateringHub to aplikacja webowa wspierająca pracę firmy kateringowej: od przyjęcia
zamówienia od klienta, przez planowanie produkcji w kuchni i organizację dostaw,
aż po analizę statystyk i prognozowanie zapotrzebowania na zasoby.

Produkt jest projektowany jako platforma w modelu **SaaS**, z której mogą korzystać
różne firmy kateringowe bez utrzymywania własnej infrastruktury IT.

### Główne funkcje produktu

| Mikroserwis | Zakres | Stan w tej wersji |
|---|---|---|
| Zamówienia (`orders`) | Konta, menu, koszyk, zamówienia, historia klienta i statystyki sprzedaży | Działają obsługa zamówień, publikacja zdarzeń oraz liczniki zamówień i porcji. Wartość sprzedaży i popularność dań są planowane. |
| Zasoby (`inventory`) | Przyjęcia składników, receptury, rezerwacje i planowanie zapotrzebowania | API obsługuje składniki, przyjęcia, receptury i zapasy. Serwis rezerwuje składniki na podstawie zdarzeń zamówień. |
| Realizacja (`fulfillment`) | Lista produkcyjna kuchni, przydział i obsługa dostaw oraz wskaźniki ich wykonania | Planowana jest obsługa kuchni i kierowców oraz zestawienia dostaw doręczonych, nieudanych i terminowych. |

### Role użytkowników

| Rola | Zakres dostępu |
|---|---|
| Klient | Menu, składanie i przegląd własnych zamówień, edycja profilu |
| Magazynier | Podgląd stanów i rezerwacji w panelu Magazyn. Przyjęcia, receptury i ponawianie rezerwacji przez API. |
| Pracownik kuchni | Lista produkcyjna, zmiana statusu przygotowania zamówień |
| Kierowca | Przydzielone dostawy, zmiana statusu dostawy |
| Menedżer | Przegląda zamówienia, podsumowanie i dane Zasobów. Docelowo także koordynuje dostawy, personel i planowanie. |
| Administrator | Zarządza kontami, rolami i menu w panelu Django. Ma pełny dostęp do API Zasobów. |

Prototyp obsługuje jedną fikcyjną firmę, SmakBox. Obecnie dostępne są widoki
klienta i menedżera oraz panel Django administratora. Tabela uwzględnia również
planowane role operacyjne.

## Technologie

- **Backend:** Python, Django, Django REST Framework
- **Frontend:** React, TypeScript, Vite
- **Baza danych:** PostgreSQL
- **Kolejka komunikatów i zdarzenia:** RabbitMQ
- **Konteneryzacja:** Docker, Docker Compose
- **Kontrola wersji:** Git, GitHub

W środowisku demonstracyjnym Docker Compose uruchamia PostgreSQL i RabbitMQ.
Docelowo w Compose osobne kontenery uruchomią API i proces obsługi zdarzeń
każdego mikroserwisu. Próbę z Kubernetes zaplanowano po uruchomieniu pełnego
przepływu zamówienia w Compose.

## Uruchomienie lokalne

Na Windows potrzebujesz PowerShell 7, uruchomionego Docker Desktop, `uv`
i Node.js 24 z npm. W katalogu repozytorium wykonaj:

```powershell
pwsh -File scripts/setup.ps1
pwsh -File scripts/dev.ps1
```

Pierwsze polecenie przygotowuje lokalny plik `.env`, uruchamia PostgreSQL
i RabbitMQ, instaluje zależności, stosuje migracje i ładuje fikcyjne dane.
Drugie uruchamia API i proces obsługi zdarzeń obu serwisów oraz Vite. Otwórz
[CateringHub](http://localhost:5173/). Na ekranie logowania przyciski
**Dane klienta**, **Dane menedżera** i **Dane magazyniera** uzupełniają lokalne
dane demonstracyjne.

W zakładce **Magazyn** widać zapas fizyczny, ilość zarezerwowaną, dostępny
zapas i próg minimalny. Można wyświetlić tylko składniki poniżej minimum
i przejrzeć wyniki rezerwacji. Menedżer i administrator przechodzą z rezerwacji
do szczegółów zamówienia.

Złóż zamówienie jako klient, a następnie odszukaj je w panelu menedżera po
adresie e-mail. Nowe zamówienie czeka na wynik z Zasobów. Szczegóły zamówienia
pokazują po chwili „Składniki zarezerwowane” albo „Brak składników lub receptury”.
Do godziny granicznej klient może anulować zamówienie w jego szczegółach.
Zasoby zwalniają wtedy zarezerwowane składniki. Jeśli odpowiedź po złożeniu
zamówienia zaginie, koszyk pozwala sprawdzić zapis przed kolejną próbą.

[Opis API Zamówień](http://localhost:5173/api/orders/v1/docs/),
[opis API Zasobów](http://localhost:5173/api/inventory/v1/docs/) i
[panel Django](http://localhost:8001/api/orders/admin/) działają po uruchomieniu
aplikacji. Polecenie `seed_demo` tworzy również lokalne konta administratora
i magazyniera. Zobacz [instrukcję obsługi API Zasobów](docs/inventory.md).

Ctrl+C zatrzymuje procesy aplikacji. Logi znajdziesz w `.artifacts/dev/`.
Jeśli chcesz zatrzymać też PostgreSQL i RabbitMQ, użyj `docker compose stop`.
Przy aktualizacji istniejącego środowiska uruchom ponownie `scripts/setup.ps1`.
Postępowanie ze starszym wolumenem brokera i ponawianie publikacji opisano w
[instrukcji Zasobów](docs/inventory.md#4-odzyskiwanie-zdarzeń).

Jeśli uruchamiasz kilka środowisk demonstracyjnych na jednym komputerze,
użyj dla każdego oddzielnego projektu Compose. W jego `.env` ustaw unikalną nazwę
`COMPOSE_PROJECT_NAME` oraz wolne porty `POSTGRES_PORT`, `RABBITMQ_PORT`
i `RABBITMQ_MANAGEMENT_PORT`. Przykładowe porty drugiego środowiska to odpowiednio
`55433`, `5673` i `15673`. Oba API i Vite używają stałych portów `8001`, `8002`
i `5173`, więc przed uruchomieniem drugiego środowiska zatrzymaj poprzedni `dev.ps1`.
Przy pierwszym uruchomieniu możesz ustawić nazwę i porty w zmiennych
środowiskowych PowerShella przed uruchomieniem obu skryptów w tym samym terminalu.

## Sprawdzenie zmian

Po konfiguracji uruchom z katalogu repozytorium:

```powershell
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.cache/uv'
uv run --project backend --locked ruff check backend
uv run --project backend --locked --env-file .env --package cateringhub-orders python -m pytest --tb=no -c backend/services/orders/pyproject.toml backend/services/orders/tests
uv run --project backend --locked --env-file .env --package cateringhub-inventory python -m pytest --tb=no -c backend/services/inventory/pyproject.toml backend/services/inventory/tests
npm.cmd --prefix frontend run check
npm.cmd --prefix frontend run build
```

Testy przeglądarkowe można uruchomić na osobnych kontenerach i świeżych
danych. Potrzebne są zainstalowane zależności projektu i działający Docker.
Z katalogu repozytorium uruchom:

```powershell
npm.cmd --prefix frontend exec -- playwright install chromium
npm.cmd --prefix frontend run test:e2e:isolated
```

Zamiast instalować Chromium można wskazać zainstalowany Chrome przez
`$env:PW_BROWSER_CHANNEL = 'chrome'`. Polecenie `node scripts/test-e2e.mjs --backend`
dodaje testy backendu w tym samym środowisku. GitHub Actions używa tej wersji.

## Struktura repozytorium

```
cateringhub/
├── backend/
│   ├── packages/core/ # ustawienia bazy i uwierzytelnianie współdzielone przez API
│   └── services/
│       ├── orders/    # konta, menu, zamówienia
│       └── inventory/ # składniki, przyjęcia, receptury i rezerwacje
├── frontend/       # aplikacja kliencka i panel pracowników (React + TypeScript)
├── infra/          # skrypty inicjalizujące bazy danych
├── scripts/        # skrypty uruchamiające środowisko lokalne
├── compose.yaml    # PostgreSQL i RabbitMQ w kontenerach
└── docs/
    ├── api/        # specyfikacja OpenAPI
    ├── raport/     # kolejne rozdziały i wersje raportu z projektu
    └── diagramy/   # diagramy UML, ERD, architektury
```

## Harmonogram

| Etap | Termin | Zakres |
|---|---|---|
| Raport 1 | 01.12.2026 | Rozdziały 1–10: analiza, wymagania, architektura, pierwsza implementacja, testy |
| Raport 2 | 15.12.2026 | Rozdziały 1–14: pełna implementacja, wdrożenie, dokumentacja użytkownika |
| Raport 3 | 12.01.2027 | Rozdziały 1–17: utrzymanie, aktualizacje, planowanie i kontrola, wnioski |
| Obrona | do 25.01.2027 | Prezentacja i obrona decyzji projektowych |

## Postęp prac

- [x] Utworzenie repozytorium i struktury projektu
- [x] Analiza biznesowa: cel, problem, założenia, zakres produktu (rozdziały 1–4)
- [x] Specyfikacja wymagań oprogramowania (rozdział 5)
- [x] Projekt architektury systemu (rozdział 6)
- [x] Wybór technologii i narzędzi (rozdział 7)
- [x] Serwis zamówień: konta, menu, zamówienia, publikacja zdarzeń
- [x] Aplikacja webowa: menu, koszyk, logowanie, historia i panel zamówień
- [x] Dokumentacja implementacji, testy i poprawki (rozdziały 8–10)
- [x] Serwis Zasobów: ewidencja składników, przyjęcia dostaw i odczyt stanów przez API
- [x] Receptury, rezerwacje i wymiana zdarzeń między Zasobami i Zamówieniami
- [x] Podgląd stanów i rezerwacji w panelu Magazyn
- [ ] Formularze magazynowe i serwis Realizacji
- [ ] Wartość sprzedaży i popularność dań w Zamówieniach
- [ ] Wskaźniki dostaw w Realizacji i planowanie zapotrzebowania w Zasobach
- [ ] Wdrożenie

[Spis rozdziałów raportu](docs/raport/README.md) ·
[Architektura produktu i diagramy](docs/raport/rozdzial-06-architektura.md)
