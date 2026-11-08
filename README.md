# CateringHub – system wspomagający działalność firmy kateringowej

Projekt realizowany w ramach przedmiotu **Inżynieria Oprogramowania 2026/2027**.

Temat: **Tworzenie oprogramowania dla firmy kateringowej**

## Opis

CateringHub to aplikacja webowa wspierająca pracę firmy kateringowej: od przyjęcia
zamówienia od klienta, przez planowanie produkcji w kuchni i organizację dostaw,
aż po analizę statystyk i prognozowanie zapotrzebowania na zasoby.

### Funkcje główne realizowane w oprogramowaniu

1. **Obsługa klienta i zamówień** – rejestracja i logowanie, przeglądanie menu i diet, składanie zamówień.
2. **Planowanie operacyjne i dostawy** – lista produkcyjna dla kuchni, przydział dostaw do kierowców.
3. **Statystyki i prognozy** – prognoza liczby zamówień oraz wyznaczanie optymalnej i minimalnej liczby personelu i zasobów.

### Role użytkowników

| Rola | Zakres dostępu |
|---|---|
| Klient | Menu, składanie i przegląd własnych zamówień, edycja profilu |
| Pracownik kuchni | Lista produkcyjna, zmiana statusu przygotowania zamówień |
| Kierowca | Przydzielone dostawy, zmiana statusu dostawy |
| Menedżer | Zarządzanie menu, zamówieniami, dostawami, personelem, statystyki i prognozy |
| Administrator | Pełny dostęp, zarządzanie kontami i rolami |

## Technologie

- **Backend:** Python, Django, Django REST Framework
- **Frontend:** React (JavaScript)
- **Baza danych:** PostgreSQL
- **Konteneryzacja:** Docker, Docker Compose
- **Kontrola wersji:** Git, GitHub

## Struktura repozytorium

```
cateringhub/
├── backend/        # API (Django + DRF)
├── frontend/       # aplikacja kliencka i panel pracowników (React)
└── docs/
    ├── raport/     # kolejne wersje raportu z projektu
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
- [ ] Analiza biznesowa i specyfikacja wymagań
- [ ] Projekt architektury systemu
- [ ] Implementacja backendu
- [ ] Implementacja frontendu
- [ ] Testy
- [ ] Wdrożenie

## Uruchomienie

Instrukcja uruchomienia zostanie dodana wraz z pierwszą wersją backendu.
