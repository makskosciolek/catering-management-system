# 6. Architektura produktu

Rozdział rejestruje wyniki fazy projektowania. Przedstawia rozważone warianty
infrastruktury i style architektoniczne, uzasadnia wybór, a następnie opisuje
wybraną architekturę na trzech poziomach (biznesowym, aplikacyjnym
i technologicznym) oraz za pomocą trzech wzorców: modułowego,
komponentowo-łącznikowego i alokacyjnego.

Oceny punktowe w tym rozdziale są szacunkami zespołu projektowego, opartymi na
wymaganiach z rozdziału 5 i literaturze przedmiotu.

## 6.1 Warianty infrastruktury IT

Rozważono trzy sposoby udostępnienia oprogramowania firmom kateringowym.

| Kryterium | A. Każda firma dzierżawi infrastrukturę (IaaS) i sama wdraża system | B. Każda firma buduje własną infrastrukturę | C. Dostawca świadczy usługę SaaS dla wielu firm |
|---|---|---|---|
| Koszt początkowy dla firmy kateringowej | Niski | Bardzo wysoki (serwery, pomieszczenie, sieć) | Brak, opłata abonamentowa |
| Koszt stały dla firmy | Opłata za chmurę i administratora | Energia, serwis, administrator | Abonament |
| Wymagane kompetencje IT w firmie | Wysokie | Bardzo wysokie | Brak |
| Odpowiedzialność za kopie zapasowe i bezpieczeństwo | Firma | Firma | Dostawca |
| Aktualizacje oprogramowania | Każda firma osobno | Każda firma osobno | Jednocześnie dla wszystkich |
| Skalowanie przy wzroście liczby zamówień | Łatwe | Trudne, wymaga zakupu sprzętu | Łatwe, po stronie dostawcy |
| Kontrola firmy nad danymi | Wysoka | Pełna | Ograniczona umową |
| Ryzyko dla firmy | Błędy konfiguracji, brak administratora | Awaria sprzętu, wysoki koszt | Uzależnienie od dostawcy |

**Wybrano wariant C.** W docelowym modelu producent oprogramowania świadczy
usługę SaaS na infrastrukturze dzierżawionej w modelu IaaS. Decydujące jest ograniczenie C-07
(firma kateringowa nie ma działu IT) oraz cel BG-08 (uruchomienie nowej firmy
w ciągu jednego dnia). Planowana konteneryzacja aplikacji i konfiguracja przez
zmienne środowiskowe ułatwią też wdrożenie w wariancie A lub B. Prototyp jest
rozwijany lokalnie z PostgreSQL i RabbitMQ uruchamianymi przez Docker Compose.

## 6.2 Wybór stylu architektonicznego

### 6.2.1 Rozważone style

**A. Monolit warstwowy.** Jedna aplikacja i jedna baza danych. Najprostszy
w budowie i wdrożeniu, ale wszystkie funkcje są skalowane i wdrażane razem,
a awaria jednej części zatrzymuje całość.

**B. Monolit modułowy.** Jedna aplikacja podzielona na wyraźne moduły, wspólna
baza danych. Zachowuje prostotę wdrożenia i porządkuje kod, ale moduły nadal
dzielą proces i bazę, więc nie da się ich skalować ani wdrażać niezależnie.

**C. Serwisy funkcji biznesowych sterowane zdarzeniami.** Kilka niezależnych
serwisów odpowiadających funkcjom głównym (zamówienia, magazyn, realizacja,
analityka). Każdy ma własną bazę danych, a serwisy komunikują się asynchronicznie
przez broker komunikatów. Styl łączy cechy architektury mikroserwisowej
i architektury opartej na zdarzeniach.

### 6.2.2 Porównanie według atrybutów jakości

Skala ocen 1–5 (5 – najlepiej). Wagi wynikają z wymagań niefunkcjonalnych.

| Atrybut jakości | Waga | A. Monolit warstwowy | B. Monolit modułowy | C. Serwisy sterowane zdarzeniami |
|---|---|---|---|---|
| Niezawodność (izolacja awarii) | 5 | 2 | 2 | 5 |
| Skalowalność | 4 | 2 | 2 | 5 |
| Modyfikowalność i rozbudowa o nowe funkcje | 5 | 2 | 4 | 5 |
| Wydajność pojedynczego żądania | 3 | 5 | 5 | 4 |
| Bezpieczeństwo (separacja danych) | 4 | 3 | 3 | 5 |
| Testowalność | 3 | 4 | 4 | 3 |
| Prostota wdrożenia i utrzymania | 3 | 5 | 5 | 2 |
| Czas i koszt wytworzenia | 4 | 5 | 4 | 2 |
| **Suma ważona** | | **102** | **108** | **125** |

### 6.2.3 Ryzyka związane z wyborem

| Styl | Główne ryzyko | Prawdopodobieństwo | Możliwa strata |
|---|---|---|---|
| A | Awaria jednej funkcji (np. raportów) zatrzymuje przyjmowanie zamówień | Średnie | Wysoka: utracone zamówienia w godzinach szczytu |
| A, B | Wzrost powiązań między modułami utrudnia dodawanie funkcji | Wysokie | Średnia: rosnący koszt każdej zmiany |
| B | Wspólna baza pozwala modułom czytać cudze dane, co utrudnia późniejszy podział | Średnie | Średnia |
| C | Wyższa złożoność: spójność danych między serwisami, obsługa błędów komunikacji | Wysokie | Średnia: dłuższy czas wytworzenia |
| C | Utrata lub zdublowanie zdarzenia | Niskie przy zastosowanych zabezpieczeniach | Wysoka: zamówienie bez rezerwacji składników |

### 6.2.4 Decyzja

**Wybrano styl C**, ograniczony do niewielkiej liczby serwisów. Uzasadnienie:

- przyjmowanie zamówień jest krytyczne dla firmy i nie może zależeć od
  dostępności magazynu, kuchni czy raportów; w stylu C zamówienie zostaje
  przyjęte, nawet gdy pozostałe serwisy chwilowo nie działają;
- Zamówienia, Zasoby i Realizacja mają różne obciążenie w ciągu dnia, więc
  można je skalować niezależnie. Każda usługa dostarcza wskaźniki ze swojego obszaru;
- każdy serwis ma dostęp tylko do własnych danych, co ułatwia spełnienie
  wymagań ochrony danych osobowych;
- kolejne funkcje (księgowość, dostawcy) można dodać jako nowe serwisy
  odbierające istniejące zdarzenia, bez zmian w działającym kodzie.

Ryzyko złożoności ograniczono przez: tylko trzy serwisy w prototypie, jeden
mechanizm komunikacji między nimi, wspólny zestaw narzędzi oraz wzorzec skrzynki
nadawczej (outbox) chroniący przed utratą zdarzeń.

Zamówienia odpowiadają za statystyki sprzedaży, Realizacja za wskaźniki
dostaw, a Zasoby za planowanie zapotrzebowania na składniki. Panel menedżera
może zestawić wyniki pobrane z API tych usług.

## 6.3 Architektura trójpoziomowa

Opis jest zgodny z podziałem stosowanym w języku ArchiMate: poziom biznesowy
udostępnia usługi klientom, poziom aplikacji wspiera go funkcjami oprogramowania,
a poziom technologiczny dostarcza infrastrukturę, na której działają aplikacje.

```mermaid
flowchart TB
    subgraph biznes ["Poziom biznesowy"]
        direction LR
        a1(["Klient"])
        a2(["Magazynier"])
        a3(["Pracownik kuchni"])
        a4(["Kierowca"])
        a5(["Menedżer"])
        p1["Przyjęcie zamówienia"]
        p2["Rezerwacja składników"]
        p3["Produkcja posiłków"]
        p4["Dostawa"]
        p5["Analiza i planowanie"]
        p1 --> p2 --> p3 --> p4 --> p5
    end

    subgraph aplikacje ["Poziom aplikacji"]
        direction LR
        web["Aplikacja webowa (SPA)"]
        orders["Zamówienia i statystyki sprzedaży"]
        inventory["Zasoby i planowanie zapotrzebowania"]
        fulfillment["Realizacja i wskaźniki dostaw"]
        bus["RabbitMQ"]
    end

    subgraph technologia ["Poziom technologiczny"]
        direction LR
        browser["Przeglądarka"]
        runtime["Kontenery Docker: Python, Django"]
        db[("PostgreSQL: osobna baza na serwis")]
        mq["RabbitMQ"]
        iaas["Infrastruktura IaaS"]
        browser ~~~ runtime
        db ~~~ iaas
    end

    a1 -.-> p1
    a2 -.-> p2
    a3 -.-> p3
    a4 -.-> p4
    a5 -.-> p5

    web --> orders
    web --> inventory
    web --> fulfillment
    orders <--> bus
    inventory <--> bus
    fulfillment <--> bus

    runtime --> db
    runtime --> mq

    biznes == "usługi aplikacji przez interfejsy użytkownika i API" ==> aplikacje
    aplikacje == "usługi infrastrukturalne" ==> technologia
```

[Diagram architektury trójpoziomowej w PNG](../diagramy/02-architektura-trojpoziomowa.png)

### 6.3.1 Poziom biznesowy

| Proces biznesowy | Aktor | Usługa biznesowa | Interfejs |
|---|---|---|---|
| Przyjęcie zamówienia | Klient | Zamawianie posiłków przez Internet | Aplikacja webowa: menu, koszyk, zamówienia |
| Rezerwacja składników | Magazynier | Zapewnienie składników na zamówione posiłki | Panel magazynu |
| Produkcja posiłków | Pracownik kuchni | Przygotowanie posiłków na dany dzień | Lista produkcyjna |
| Dostawa | Kierowca | Doręczenie posiłków pod wskazany adres | Lista dostaw na telefonie |
| Analiza i planowanie | Menedżer | Planowanie składników i ocena sprzedaży oraz dostaw | Panel menedżera z widokami sprzedaży, dostaw i zapotrzebowania |

### 6.3.2 Poziom aplikacji

| Komponent aplikacyjny | Funkcje aplikacji | Obsługiwane funkcje główne | Interfejs |
|---|---|---|---|
| Aplikacja webowa (SPA) | Prezentacja menu, koszyk, formularze, panele ról | wszystkie, jako warstwa prezentacji | HTTP, przeglądarka |
| Zamówienia (`orders`) | Konta i role, menu, zamówienia, statystyki sprzedaży i publikacja zdarzeń | F-01, F-02, F-07 (konta i role), F-09 (sprzedaż) | REST API `/api/orders/v1`, zdarzenia |
| Zasoby (`inventory`) | Składniki, przyjęcia, receptury, rezerwacje i moduł planowania zapotrzebowania | F-03, F-04, F-10 | REST API, zdarzenia |
| Realizacja (`fulfillment`) | Lista produkcyjna, przydział i statusy dostaw oraz wskaźniki dostaw | F-05, F-06, F-09 (dostawy) | REST API, zdarzenia |
| Szyna zdarzeń | Przekazywanie zdarzeń biznesowych między serwisami | integracja | AMQP |

W prototypie działają aplikacja webowa, Zamówienia i API Zasobów. Zamówienia
prowadzą konta, zamówienia i liczniki. Zasoby obsługują przyjęcia, receptury
i rezerwacje, a wynik rezerwacji wraca do Zamówień przez RabbitMQ.
Obsługa kuchni, dostaw i ich wskaźników oraz planowanie zapotrzebowania
są planowane. Zamówienia mają zostać rozszerzone o wartość sprzedaży
i popularność dań.

### 6.3.3 Poziom technologiczny

| Usługa infrastrukturalna | Realizacja | Obsługiwane komponenty |
|---|---|---|
| Wykonywanie aplikacji | Python 3.13 i Django 5.2. W planowanym wdrożeniu osobne kontenery API i procesów zdarzeń. | Serwisy |
| Przechowywanie danych | PostgreSQL 17, osobna baza i konto dla każdego serwisu | Serwisy |
| Przesyłanie komunikatów | RabbitMQ 4 (protokół AMQP) | Szyna zdarzeń |
| Dostarczanie aplikacji webowej | Serwer plików statycznych i reverse proxy | Aplikacja webowa |
| Sieć i moc obliczeniowa | Środowisko demonstracyjne na jednym komputerze z Docker Compose. Planowany model SaaS zakłada infrastrukturę IaaS. | wszystkie |

## 6.4 Wzorzec modułowy

Wzorce modułowe opisują statyczny podział kodu. Zastosowano trzy widoki:
dekompozycję na moduły, wzorzec warstwowy wewnątrz serwisu oraz model danych.

### 6.4.1 Dekompozycja na moduły

| Moduł | Odpowiedzialność | Zależności |
|---|---|---|
| `frontend` | Interfejs użytkownika, komunikacja z API | kontrakt OpenAPI serwisów |
| `orders.accounts` | Użytkownicy, role, rejestracja, logowanie, profil | – |
| `orders.sales` | Menu, zamówienia, statystyki sprzedaży i skrzynka nadawcza zdarzeń | `orders.accounts` |
| `inventory` | Przyjęcia składników, receptury, rezerwacje i planowanie zapotrzebowania | Zdarzenia o zamówieniach, dane magazynowe |
| `fulfillment` | Produkcja, dostawy i wskaźniki ich wykonania | Zdarzenia o rezerwacjach, dane o realizacji dostaw |

Każdy mikroserwis ma własną bazę i korzysta z danych, które zapisuje sam albo
otrzymuje przez publiczne kontrakty. Zasoby będą zapisywać dane ze zdarzeń
o zamówieniach, w tym identyfikatory dań, liczbę porcji i termin dostawy.
Moduł planowania wykorzysta tę historię i receptury do wyliczenia potrzebnych
ilości składników. Przeliczanie prognozy i składanie zamówień są odrębnymi operacjami.

### 6.4.2 Wzorzec warstwowy wewnątrz serwisu

Każdy serwis ma tę samą budowę. Warstwa wyższa korzysta tylko z warstwy
bezpośrednio pod nią.

```mermaid
flowchart TB
    l1["Warstwa interfejsu: adresy URL, widoki, uwierzytelnianie, uprawnienia"]
    l2["Warstwa kontraktu: serializatory, walidacja danych wejściowych"]
    l3["Warstwa logiki biznesowej: usługi, np. create_order"]
    l4["Warstwa dostępu do danych: modele, ORM"]
    l5[("Baza danych serwisu")]
    l1 --> l2 --> l3 --> l4 --> l5
```

| Warstwa | Elementy w serwisie zamówień |
|---|---|
| Interfejs | `urls.py`, `accounts/views.py`, `sales/views.py`, `accounts/authentication.py` |
| Kontrakt | `accounts/serializers.py`, `sales/serializers.py` |
| Logika biznesowa i proces zdarzeń | `sales/services.py`, `sales/events.py`, wspólne `cateringhub_core/messaging.py` i `cateringhub_core/worker.py` |
| Dostęp do danych | `accounts/models.py`, `sales/models.py`, migracje |

Zaletą jest czytelny podział odpowiedzialności i łatwe testowanie reguł
biznesowych; wadą niewielki narzut na przejście przez warstwy.

### 6.4.3 Model danych serwisu zamówień

```mermaid
erDiagram
    USER ||--o{ ORDER : "składa"
    ORDER ||--|{ ORDER_ITEM : "zawiera"
    MEAL ||--o{ ORDER_ITEM : "występuje w"
    ORDER ||--o{ OUTBOX_EVENT : "generuje"

    USER {
        uuid id PK
        string email UK
        string password
        string first_name
        string last_name
        string phone
        string role
    }
    MEAL {
        uuid id PK
        string name
        text description
        decimal price
        string category
        string allergens
        boolean is_vegetarian
        boolean is_active
    }
    ORDER {
        uuid id PK
        uuid customer_id FK
        date delivery_date
        string delivery_address
        string contact_phone
        string note
        string status
        decimal total
        datetime created_at
    }
    ORDER_ITEM {
        bigint id PK
        uuid order_id FK
        uuid meal_id FK
        string meal_name
        decimal unit_price
        int quantity
    }
    OUTBOX_EVENT {
        uuid id PK
        uuid order_id FK
        string event_type
        json payload
        datetime created_at
        datetime published_at
    }
```

Pozycja zamówienia przechowuje kopię nazwy i ceny dania z chwili zakupu.
Ograniczenia w bazie danych dodatkowo pilnują, by cena i liczba porcji były
dodatnie, a danie nie powtarzało się w jednym zamówieniu.

## 6.5 Wzorzec komponentowo-łącznikowy

Wzorce komponentowo-łącznikowe opisują system w czasie działania: komponenty
i połączenia między nimi.

### 6.5.1 Komponenty i łączniki

Tabela i diagram przedstawiają planowaną współpracę trzech mikroserwisów.

| Komponent | Rola |
|---|---|
| Aplikacja webowa | Klient interfejsu REST, działa w przeglądarce |
| Zamówienia (API) | Zapisuje zamówienia i dane w skrzynce nadawczej. Udostępnia statystyki sprzedaży. |
| Zasoby (API) | Udostępnia stany, rezerwacje i plan zapotrzebowania. |
| Realizacja (API) | Udostępnia listę produkcyjną, dostawy i wskaźniki dostaw. |
| Procesy zdarzeń | Publikują wpisy ze skrzynki nadawczej i obsługują zdarzenia z kolejek przypisanych usługom. |
| Broker komunikatów | Rozdziela zdarzenia do kolejek subskrybentów |
| Bazy danych | Trwałe przechowywanie danych każdego serwisu |

| Łącznik | Między | Styl | Charakter |
|---|---|---|---|
| HTTP/REST, JSON | Aplikacja webowa i serwis | klient-serwer | synchroniczny |
| SQL | Serwis i jego baza | dostęp do danych | synchroniczny |
| AMQP, wymiana typu `topic` | Publikator, broker, subskrybenci | publikuj-subskrybuj | asynchroniczny |

```mermaid
flowchart LR
    spa["Aplikacja webowa"]
    orders["Zamówienia"]
    inv["Zasoby"]
    ful["Realizacja (plan)"]
    ex{{"Wymiana cateringhub.events"}}
    q1["Kolejka Zasobów"]
    q2["Kolejka Zamówień"]
    q3["Kolejka Realizacji (plan)"]
    dlq["Kolejki dead letter"]

    spa -- "REST" --> orders
    spa -- "REST" --> inv
    spa -. "REST" .-> ful
    orders -- "order.submitted" --> ex
    ex -- "zamówienia" --> q1 --> inv
    inv -- "wynik rezerwacji" --> ex
    ex -- "wynik rezerwacji" --> q2 --> orders
    ex -. "stock.reserved" .-> q3
    q3 -.-> ful
    ful -. "zdarzenia kuchni i dostaw" .-> ex
    q1 -. "odrzucone wiadomości" .-> dlq
    q2 -.-> dlq
    q3 -.-> dlq
```

[Diagram komponentów i łączników w PNG](../diagramy/05-komponenty-laczniki.png)

### 6.5.2 Scenariusz: złożenie zamówienia

```mermaid
sequenceDiagram
    actor K as Klient
    participant W as Aplikacja webowa
    participant O as Serwis zamówień
    participant D as Baza orders
    participant P as Publikator zdarzeń
    participant R as RabbitMQ
    participant M as Serwis magazynu

    K->>W: Zatwierdza koszyk
    W->>O: POST /api/orders/v1/orders/
    O->>O: Uwierzytelnienie, rola, CSRF, walidacja
    O->>D: Transakcja: zamówienie, pozycje, zdarzenie
    D-->>O: Zatwierdzono
    O-->>W: 201 Created
    W-->>K: Potwierdzenie zamówienia
    loop cyklicznie
        P->>D: Pobierz nieopublikowane zdarzenie
        P->>R: Publikuj order.submitted
        R-->>P: Potwierdzenie przyjęcia
        P->>D: Oznacz jako opublikowane
    end
    R->>M: Dostarcz zdarzenie
    M->>M: Rezerwacja składników
```

Zastosowano wzorzec skrzynki nadawczej (transactional outbox). Zdarzenie jest
zapisywane w tej samej transakcji co zamówienie, a do brokera trafia dopiero
w drugim kroku. Dzięki temu nie może powstać zamówienie bez zdarzenia ani
zdarzenie bez zamówienia, a awaria brokera opóźnia jedynie publikację. Skutkiem
ubocznym jest możliwość dwukrotnego dostarczenia zdarzenia, dlatego każde
zdarzenie ma unikalny identyfikator, po którym odbiorca rozpoznaje duplikaty.

### 6.5.3 Zdarzenia domenowe

| Zdarzenie | Publikuje | Odbiera | Status |
|---|---|---|---|
| `order.submitted` | Zamówienia | Zasoby | Działa publikacja i odbiór |
| `stock.reserved` | Zasoby | Zamówienia i Realizacja | Działa odbiór w Zamówieniach. Odbiór w Realizacji jest planowany. |
| `stock.shortage` | Zasoby | Zamówienia | Działa publikacja i odbiór |
| `order.cancelled` | Zamówienia | Zasoby | Działa publikacja i zwolnienie składników |
| `order.prepared` | Realizacja | Zamówienia, Zasoby | Zasoby potrafią rozliczyć zużycie. Nadawca i odbiór w Zamówieniach są planowane. |
| `delivery.assigned` | Realizacja | Zamówienia | Planowane |
| `delivery.completed` | Realizacja | Zamówienia | Planowane |

## 6.6 Wzorzec alokacyjny

Diagram pokazuje planowane wdrożenie w Docker Compose. Każdy mikroserwis
uruchamia API i proces obsługi zdarzeń w oddzielnych kontenerach. Jeden
serwer PostgreSQL przechowuje trzy bazy, każdą z osobnym kontem usługi.

```mermaid
flowchart TB
    b["Przeglądarka"]
    px["Reverse proxy i pliki statyczne"]
    subgraph orders ["Zamówienia"]
        oapi["Kontener API"]
        oworker["Proces zdarzeń"]
    end
    subgraph inventory ["Zasoby"]
        iapi["Kontener API"]
        iworker["Proces zdarzeń"]
    end
    subgraph fulfillment ["Realizacja"]
        fapi["Kontener API"]
        fworker["Proces zdarzeń"]
    end
    odb[("Baza orders")]
    idb[("Baza inventory")]
    fdb[("Baza fulfillment")]
    rmq["RabbitMQ"]
    b -- "HTTPS" --> px
    px -- "HTTP" --> oapi
    px -- "HTTP" --> iapi
    px -- "HTTP" --> fapi
    oapi --> odb
    oworker --> odb
    iapi --> idb
    iworker --> idb
    fapi --> fdb
    fworker --> fdb
    oworker <-->|AMQP| rmq
    iworker <-->|AMQP| rmq
    fworker <-->|AMQP| rmq
```

[Diagram wdrożenia w PNG](../diagramy/07-widok-wdrozenia.png)

| Element oprogramowania | Środowisko deweloperskie (stan obecny) | Środowisko docelowe (SaaS) |
|---|---|---|
| Aplikacja webowa | Serwer deweloperski Vite, port 5173 | Pliki statyczne za reverse proxy |
| Zamówienia | Proces Django, port 8001 | Kontener API |
| Zasoby | Planowane | Kontener API |
| Realizacja | Planowana | Kontener API |
| Procesy zdarzeń | Polecenie uruchamiane lokalnie dla Zamówień | Oddzielny kontener dla każdej usługi |
| PostgreSQL | Kontener Docker Compose, port 55432 | Usługa bazy danych z kopiami zapasowymi |
| RabbitMQ | Kontener Docker Compose, porty 5672 i 15672 | Kontener lub usługa zarządzana |
| Kierowanie ruchu `/api/orders` | Proxy serwera Vite | Reverse proxy |

Środowisko demonstracyjne opiera się na Docker Compose. Próbę uruchomienia
na Kubernetes zaplanowano po sprawdzeniu pełnego procesu w Compose. W docelowym
wdrożeniu każda usługa łączy się z własną bazą i może być uruchamiana niezależnie.

## 6.7 Wpływ architektury na atrybuty jakości

| Atrybut | Taktyka architektoniczna |
|---|---|
| Niezawodność | Skrzynka nadawcza, trwałe kolejki, potwierdzenia dostarczenia, kolejka dead letter, punkt kontroli stanu |
| Skalowalność | Bezstanowe serwisy, kolejka wyrównująca obciążenie, osobne skalowanie poziomów |
| Bezpieczeństwo | Token w ciasteczku `HttpOnly`, ochrona CSRF, kontrola ról na serwerze, osobne konta bazodanowe, ograniczenie liczby żądań |
| Modyfikowalność | Serwisy według funkcji biznesowych, komunikacja przez zdarzenia, kontrakt OpenAPI |
| Spójność danych | Transakcje, blokady wierszy, ograniczenia w bazie danych |
| Testowalność | Logika biznesowa w osobnej warstwie, testy automatyczne interfejsu API |
