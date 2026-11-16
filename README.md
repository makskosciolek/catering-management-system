# CateringHub – system wspomagający działalność firmy kateringowej

Projekt realizowany w ramach przedmiotu **Inżynieria Oprogramowania 2026/2027**.

Temat: **Tworzenie oprogramowania dla firmy kateringowej**

## Opis

CateringHub to aplikacja webowa wspierająca pracę firmy kateringowej: od przyjęcia
zamówienia od klienta, przez planowanie produkcji w kuchni i organizację dostaw,
aż po analizę statystyk i prognozowanie zapotrzebowania na zasoby.

Produkt jest projektowany jako platforma w modelu **SaaS**, z której mogą korzystać
różne firmy kateringowe bez utrzymywania własnej infrastruktury IT.

### Funkcje główne realizowane w oprogramowaniu

1. **Obsługa klienta i zamówień** – rejestracja i logowanie, przeglądanie menu i diet, składanie zamówień.
2. **Planowanie operacyjne i dostawy** – lista produkcyjna dla kuchni, przydział dostaw do kierowców.
3. **Statystyki i prognozy** – prognoza liczby zamówień oraz wyznaczanie optymalnej i minimalnej liczby personelu i zasobów.

### Role użytkowników

| Rola | Zakres dostępu |
|---|---|
| Klient | Menu, składanie i przegląd własnych zamówień, edycja profilu |
| Magazynier | Składniki, stany magazynowe, rezerwacje pod zamówienia |
| Pracownik kuchni | Lista produkcyjna, zmiana statusu przygotowania zamówień |
| Kierowca | Przydzielone dostawy, zmiana statusu dostawy |
| Menedżer | Zarządzanie menu, zamówieniami, dostawami, personelem, statystyki i prognozy |
| Administrator | Pełny dostęp, zarządzanie kontami i rolami |

## Technologie

- **Backend:** Python, Django, Django REST Framework
- **Frontend:** React, TypeScript, Vite
- **Baza danych:** PostgreSQL
- **Kolejka komunikatów i zdarzenia:** RabbitMQ
- **Konteneryzacja:** Docker, Docker Compose
- **Kontrola wersji:** Git, GitHub

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
| Raport 1 | 17.11.2026 | Rozdziały 1–10: analiza, wymagania, architektura, pierwsza implementacja, testy |
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
- [ ] Dokumentacja implementacji, testy i poprawki (rozdziały 8–10)
- [ ] Serwis magazynu i serwis realizacji
- [ ] Statystyki i prognozy
- [ ] Wdrożenie
