# 8. Wyniki fazy rozwoju

## 8.1 Działający zakres

Uruchomiono serwisy Zamówień i Zasobów oraz aplikację webową. Klient może
utworzyć konto, wybrać dania, podać termin i dane dostawy oraz złożyć zamówienie.
Serwis nalicza cenę z cennika i zapisuje ją na pozycjach. Zamówienie ze statusem
„Oczekuje na magazyn” jest widoczne po ponownym otwarciu strony. Menedżer
widzi listę zamówień z filtrem daty, wyszukiwaniem oraz liczbą zamówień i porcji.

Po zapisie osobny proces wysyła `order.submitted` do RabbitMQ. Zasoby odbierają
wiadomość, liczą zapotrzebowanie według receptur i odsyłają wynik rezerwacji
do Zamówień. Klient może anulować zamówienie przed godziną graniczną, a Zasoby
zwalniają wtedy składniki.

W etapie 22 uruchomiono serwis Realizacji z własną bazą PostgreSQL i procesem
zdarzeń. Zamówienia tworzą konta demonstracyjne kuchni i kierowcy. Realizacja
sprawdza aktualną rolę przez API Zamówień. W etapie 23 dodano listę kuchni
w API, podsumowanie porcji i zmiany stanu produkcji. Przydział i widoki
pracowników przewidziano w etapach 24 i 25.

Panel Magazyn pokazuje stan fizyczny, zarezerwowany i dostępny oraz progi
minimum. Magazynier i administrator dodają składniki, rejestrują dostawy,
zapisują receptury i ponawiają rezerwacje. Menedżer odczytuje stany, historię
przyjęć, receptury i wyniki rezerwacji.

## 8.2 Mapowanie architektury na strukturę projektu

| Element | Plik lub katalog | Wykonanie |
|---|---|---|
| Konta i uprawnienia | `backend/services/orders/src/cateringhub_orders/accounts/` | Model konta i ról, logowanie, profil, rejestracja, kontrola ciasteczka i CSRF |
| Menu i zamówienia | `backend/services/orders/src/cateringhub_orders/sales/` | Modele `Meal`, `Order`, `OrderItem`, `OutboxEvent`, walidacja i transakcyjny zapis |
| Proces zdarzeń | `cateringhub_core/messaging.py`, `cateringhub_core/worker.py` oraz polecenie `publish_events` w każdym serwisie | Publikacja z potwierdzeniem brokera, odbiór i kontrolowane ponowienie |
| Składniki i rezerwacje | `backend/services/inventory/src/cateringhub_inventory/stock/` | Przyjęcia dostaw, receptury, stan dostępny, rezerwacje i rozliczenie zapasu |
| Realizacja | `backend/services/fulfillment/` | API produkcji, osobna baza, weryfikacja sesji i obsługa zdarzeń |
| Portal i panel pracowników | `frontend/src/` | Menu, koszyk, konto, zamówienia, stany i formularze magazynowe |
| Kontrakty API | [Zamówienia](../api/orders.openapi.yaml), [Zasoby](../api/inventory.openapi.yaml), [Realizacja](../api/fulfillment.openapi.yaml) i `frontend/src/api/` | OpenAPI oraz typy i klienty używane przez widoki |
| Infrastruktura | `compose.yaml`, `infra/postgres/init.sh`, `scripts/` | Kontenery infrastruktury, inicjalizacja baz, instalacja i uruchamianie procesów |

Podział odpowiada [warstwom serwisu](../diagramy/03-warstwy-serwisu.png)
opisanym w [rozdziale 6](rozdzial-06-architektura.md). W bazie `orders`
konto może mieć wiele zamówień, a zamówienie wiele pozycji. Pozycja wskazuje
danie i zachowuje jego nazwę oraz cenę jednostkową z chwili zakupu. Tabela
zdarzeń wychodzących wiąże komunikat z zamówieniem. Te relacje pokazuje
[model danych](../diagramy/04-model-danych.png).

W pakiecie `stock` widoki Django kierują żądania do serializatorów i funkcji
obsługi zapasu. Funkcje zapisują dane w modelach bazy `inventory`. Moduł
`events.py` obsługuje zdarzenia zamówień i zapisuje wynik rezerwacji do outboxa.
Zasoby sprawdzają aktualną rolę przez API Zamówień. [Model danych Zasobów](../diagramy/08-model-danych-zasobow.png)

## 8.3 Punkty API i format zdarzenia

Punkty serwisu mają wspólny prefiks `/api/orders/v1/`. `menu/` zwraca
aktywne dania, `auth/` obsługuje sesję i profil, a `orders/` oraz
`orders/{id}/` służą do składania i odczytu zamówień. `orders/summary/`
zwraca liczniki dla wybranego zbioru zamówień. `health/` sprawdza połączenie
API z własną bazą. `docs/` udostępnia opis interaktywny.

Zasoby udostępniają `/api/inventory/v1/` z punktami `ingredients/`, `receipts/`,
`recipes/{meal_id}/` i `reservations/{order_id}/retry/`. Panel korzysta ze
wspólnego klienta obsługującego sesję, CSRF i błędy. W razie utraty odpowiedzi
na zapis przyjęcia przeglądarka ponawia żądanie z zapisanym UUID i danymi
dostawy. Serwis zwraca istniejący wpis i zapas pozostaje naliczony jednokrotnie.

Realizacja udostępnia `/api/fulfillment/v1/health/`, `session/`, `schema/`
i `docs/`. Konsument kolejki `cateringhub.fulfillment.events` zapisuje
zdarzenie i stan zamówienia w jednej transakcji. Identyfikator zdarzenia
chroni przed podwójnym przetworzeniem, a zapis anulowania blokuje
przywrócenie zamówienia przez opóźnione zdarzenie gotowości.

API `production/` i `production/summary/` wymaga daty dostawy. Lista ma
strony po 20 zamówień, a sumy porcji według dań obejmują cały wybrany dzień.
Anulowania znikają z listy i sum. Magazynier ma odczyt, kuchnia, menedżer
i administrator mogą także zmieniać stan produkcji.

Rozpoczęcie produkcji i anulowanie konkurują o blokadę tego samego
zamówienia. Realizacja przekazuje do wewnętrznego API Zamówień token
zalogowanego pracownika, którego rola jest sprawdzana ponownie. Kod `202`
potwierdza przyjęcie operacji. Nowy stan pojawia się na liście po odebraniu
zdarzenia rozpoczęcia z RabbitMQ.
Przygotowanie i spakowanie zapisują zdarzenia razem z nowym stanem.
Zasoby rozliczają rezerwację po otrzymaniu `order.prepared`.

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
na komputerze deweloperskim. Testy przeglądarkowe można uruchomić w osobnym
projekcie Compose ze świeżą bazą i brokerem.
