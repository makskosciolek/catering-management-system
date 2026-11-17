# 8. Wyniki fazy rozwoju

## 8.1 Działający zakres

Uruchomiono serwis Zamówień i aplikację webową. Klient może utworzyć konto, wybrać dania,
wprowadzić termin i dane dostawy oraz złożyć zamówienie. Serwis nalicza
cenę z cennika i zapisuje ją na pozycjach. Zamówienie ze statusem
„Oczekuje na magazyn” jest widoczne po ponownym otwarciu strony. Menedżer
widzi listę zamówień z filtrem daty, wyszukiwaniem oraz liczbą zamówień i porcji.

Po zapisie osobny proces wysyła `order.submitted` do RabbitMQ. Sprawdzono,
że broker przyjął zdarzenia i umieścił je w kolejce dla serwisu Zasobów.
Rezerwacja składników, praca kuchni i obsługa dostawy nie są jeszcze
wykonywane. Wcześniej przygotowano dla nich osobne bazy, konto do każdej
bazy oraz kontrakt pierwszego zdarzenia.

## 8.2 Mapowanie architektury na strukturę projektu

| Element | Plik lub katalog | Wykonanie |
|---|---|---|
| Konta i uprawnienia | `backend/services/orders/src/cateringhub_orders/accounts/` | Model konta i ról, logowanie, profil, rejestracja, kontrola ciasteczka i CSRF |
| Menu i zamówienia | `backend/services/orders/src/cateringhub_orders/sales/` | Modele `Meal`, `Order`, `OrderItem`, `OutboxEvent`, walidacja i transakcyjny zapis |
| Proces publikacji | `sales/publisher.py` i polecenie `publish_events` w pakiecie Zamówień | Odczyt oczekujących wpisów, publikacja z potwierdzeniem brokera i zapis czasu wysłania |
| Portal i panel pracowników | `frontend/src/` | Wspólna nawigacja, menu, koszyk, konto, lista i szczegóły zamówień |
| Kontrakt API | [orders.openapi.yaml](../api/orders.openapi.yaml) i `frontend/src/api/schema.d.ts` | Schemat OpenAPI oraz wygenerowane typy aplikacji webowej |
| Infrastruktura | `compose.yaml`, `infra/postgres/init.sh`, `scripts/` | Kontenery infrastruktury, inicjalizacja baz, instalacja i uruchamianie procesów |

Podział odpowiada [warstwom serwisu](../diagramy/03-warstwy-serwisu.png)
opisanym w [rozdziale 6](rozdzial-06-architektura.md). W bazie `orders`
konto może mieć wiele zamówień, a zamówienie wiele pozycji. Pozycja wskazuje
danie i zachowuje jego nazwę oraz cenę jednostkową z chwili zakupu. Tabela
zdarzeń wychodzących wiąże komunikat z zamówieniem. Te relacje pokazuje
[model danych](../diagramy/04-model-danych.png).

## 8.3 Punkty API i format zdarzenia

Punkty serwisu mają wspólny prefiks `/api/orders/v1/`. `menu/` zwraca
aktywne dania, `auth/` obsługuje sesję i profil, a `orders/` oraz
`orders/{id}/` służą do składania i odczytu zamówień. `orders/summary/`
zwraca liczniki dla wybranego zbioru zamówień. `health/` sprawdza połączenie
API z własną bazą. `docs/` udostępnia opis interaktywny.

Wiadomość `order.submitted` ma pola `event_id`, `event_type`, `version`,
`occurred_at` i `order_id`. Dane dla odbiorcy (`payload`) zawierają datę
dostawy oraz listę identyfikatorów dań z liczbą porcji. Wiadomość
nie zawiera nazwiska, adresu ani telefonu. Proces publikacji używa wymiany
`cateringhub.events` i kolejki `cateringhub.inventory.events`.
Zapis zamówienia, pozycji i zdarzenia odbywa się w jednej transakcji.
Po błędzie publikacji rekord pozostaje w outboxie do następnej próby.
[Diagram sekwencji](../diagramy/06-sekwencja-zamowienia.png) pokazuje ten przepływ.

## 8.4 Uruchomienie i stan prototypu

[Instrukcja w repozytorium](../../README.md#uruchomienie-lokalne) prowadzi
od instalacji zależności i migracji do uruchomienia przeglądarki. Menu
i konta demonstracyjne mają dane fikcyjne. PostgreSQL i RabbitMQ działają
w Dockerze, natomiast API, proces publikacji i Vite uruchamiają się
na komputerze deweloperskim. W następnej iteracji serwis Zasobów ma
odebrać oczekującą wiadomość i przeliczyć ją na rezerwację.
