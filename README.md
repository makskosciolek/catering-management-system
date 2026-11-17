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

1. **Obsługa klienta i zamówień.** Działają rejestracja, logowanie, menu, koszyk, historia klienta i panel menedżera. Serwis publikuje zdarzenia zamówień w RabbitMQ.
2. **Planowanie operacyjne i dostawy.** W planie są przyjęcia i rezerwacja składników, lista produkcyjna dla kuchni i przydział dostaw kierowcom.
3. **Statystyki i prognozy.** Panel pokazuje liczbę zamówień i porcji. Prognozy zasobów i obsady są częścią wizji produktu.

### Role użytkowników

| Rola | Zakres dostępu |
|---|---|
| Klient | Menu, składanie i przegląd własnych zamówień, edycja profilu |
| Magazynier | Składniki, stany magazynowe, rezerwacje pod zamówienia |
| Pracownik kuchni | Lista produkcyjna, zmiana statusu przygotowania zamówień |
| Kierowca | Przydzielone dostawy, zmiana statusu dostawy |
| Menedżer | W prototypie przegląda zamówienia i podsumowanie. Docelowo także koordynuje dostawy, personel i planowanie. |
| Administrator | Zarządzanie kontami, rolami i menu w panelu Django |

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

## Uruchomienie lokalne

Na Windows potrzebujesz PowerShell 7, uruchomionego Docker Desktop, `uv`
i Node.js 24 z npm. W katalogu repozytorium wykonaj:

```powershell
pwsh -File scripts/setup.ps1
pwsh -File scripts/dev.ps1
```

Pierwsze polecenie przygotowuje lokalny plik `.env`, uruchamia PostgreSQL
i RabbitMQ, instaluje zależności, stosuje migracje i ładuje fikcyjne dane.
Drugie uruchamia API, wydawcę zdarzeń i Vite. Otwórz
[CateringHub](http://localhost:5173/). Na ekranie logowania przyciski
**Dane klienta** i **Dane menedżera** uzupełniają lokalne dane demonstracyjne.

Złóż zamówienie jako klient, a następnie odszukaj je w panelu menedżera po
adresie e-mail. Status „Oczekuje na magazyn” oznacza, że zamówienie zapisano
w serwisie Zamówień i czeka ono na obsługę przez magazyn.

[Opis API](http://localhost:5173/api/orders/v1/docs/) i
[panel Django](http://localhost:8001/api/orders/admin/) działają po uruchomieniu
aplikacji. Lokalne konto administratora tworzy polecenie `seed_demo`. Dane
tego konta są w [skrypcie demonstracyjnym](backend/services/orders/src/cateringhub_orders/sales/management/commands/seed_demo.py).

Ctrl+C zatrzymuje procesy aplikacji. Logi znajdziesz w `.artifacts/dev/`.
Jeśli chcesz zatrzymać też PostgreSQL i RabbitMQ, użyj `docker compose stop`.

Jeśli używasz kilku kopii repozytorium z innymi migracjami, uruchom dla każdej
oddzielny projekt Compose. W jej `.env` ustaw unikalną nazwę
`COMPOSE_PROJECT_NAME` oraz wolne porty `POSTGRES_PORT`, `RABBITMQ_PORT`
i `RABBITMQ_MANAGEMENT_PORT`. Przykładowe porty drugiej kopii to odpowiednio
`55433`, `5673` i `15673`. API i Vite nadal używają portów `8001` i `5173`,
więc przed zmianą kopii zatrzymaj poprzedni `dev.ps1`. Na świeżej kopii
możesz ustawić nazwę i porty w zmiennych środowiskowych PowerShella przed
uruchomieniem obu skryptów w tym samym terminalu.

## Sprawdzenie zmian

Po konfiguracji uruchom z katalogu repozytorium:

```powershell
$env:UV_CACHE_DIR = Join-Path (Get-Location) '.cache/uv'
uv run --project backend --locked ruff check backend
uv run --project backend --locked --env-file .env --package cateringhub-orders python -m pytest --tb=no -c backend/services/orders/pyproject.toml backend/services/orders/tests
npm.cmd --prefix frontend run check
npm.cmd --prefix frontend run build
```

Testy przeglądarkowe wymagają uruchomionego `scripts/dev.ps1` w osobnym terminalu.
Jeśli masz zainstalowany Chrome, ustaw `PW_BROWSER_CHANNEL` i uruchom testy:

```powershell
$env:PW_BROWSER_CHANNEL = 'chrome'
npm.cmd --prefix frontend run test:e2e
```

Playwright może też użyć własnego Chromium. Zainstaluj je przez
`npm.cmd --prefix frontend exec -- playwright install chromium` i uruchom
testy z nieustawioną zmienną `PW_BROWSER_CHANNEL`.

## Struktura repozytorium

```
cateringhub/
├── backend/
│   └── services/
│       └── orders/ # serwis zamówień: konta, menu, zamówienia (Django + DRF)
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
- [ ] Serwis magazynu i serwis realizacji
- [ ] Statystyki i prognozy
- [ ] Wdrożenie

[Spis rozdziałów raportu](docs/raport/README.md) ·
[Architektura produktu i diagramy](docs/raport/rozdzial-06-architektura.md)
