# 3. Opis problemu, założenia projektowe, zakres produktu

## 3.1 Opis problemu

Na potrzeby projektu przyjęto model firmy kateringowej **SmakBox** (firma fikcyjna,
reprezentatywna dla średniej wielkości przedsiębiorstwa z branży). Firma zatrudnia
około 40 osób, obsługuje około 400 aktywnych klientów i przygotowuje średnio około
1200 posiłków dziennie. Prowadzi trzy linie usług: catering dietetyczny, catering
firmowy oraz catering okolicznościowy.

Firma rozwija się, ale jej sposób pracy nie nadąża za skalą działalności:

- **Zamówienia** przyjmowane są telefonicznie, e-mailem i przez prosty formularz na
  stronie internetowej, a następnie ręcznie przepisywane do arkusza kalkulacyjnego.
  Powoduje to pomyłki (błędna dieta, kaloryczność, adres), a klient nie ma wglądu
  w status swojego zamówienia.
- **Planowanie produkcji** odbywa się wieczorem: kierownik kuchni ręcznie zlicza
  z arkusza, ile porcji poszczególnych posiłków należy przygotować następnego dnia.
  Proces jest czasochłonny i podatny na błędy.
- **Zakupy składników** planowane są na podstawie doświadczenia, a nie danych.
  Skutkiem są zarówno nadwyżki i marnowanie żywności, jak i braki wymagające
  pilnych, droższych zakupów.
- **Grafik personelu** układany jest bez informacji o przewidywanym obciążeniu.
  W dni o dużej liczbie zamówień brakuje pracowników i rośnie liczba nadgodzin,
  a w dni spokojniejsze część personelu nie ma pełnego obłożenia.
- **Dostawy** organizowane są na podstawie wydrukowanych list adresów, a kierowcy
  sami ustalają kolejność. Firma nie wie na bieżąco, które dostawy zostały
  zrealizowane, a reklamacje dotyczące spóźnień trudno zweryfikować.
- **Dane są rozproszone** w wielu plikach, więc zarząd nie ma rzetelnej wiedzy
  o sprzedaży, rentowności poszczególnych diet ani o trendach popytu.
- **Firma nie posiada działu IT**, więc wdrożenie i utrzymanie własnego systemu
  na własnych serwerach byłoby dla niej trudne i kosztowne.

Problemem biznesowym jest więc brak zintegrowanego systemu informatycznego, który
łączyłby obsługę klienta, produkcję, logistykę i analizę danych, przy jednoczesnym
braku zasobów do samodzielnego utrzymywania infrastruktury IT. Opisana sytuacja
jest typowa dla wielu firm kateringowych, dlatego rozwiązanie ma zostać
zaprojektowane w sposób umożliwiający obsługę wielu takich firm.

## 3.2 Założenia projektowe

### 3.2.1 Technologie

- **Backend:** Python oraz framework Django z Django REST Framework – logika biznesowa,
  interfejs REST API, uwierzytelnianie i autoryzacja użytkowników, obsługa bazy danych.
- **Frontend:** React (JavaScript, HTML, CSS) – aplikacja kliencka oraz panel
  pracowników komunikujące się z backendem przez REST API; interfejs responsywny,
  dostosowany również do urządzeń mobilnych (np. dla kierowców).
- **Baza danych:** PostgreSQL – relacyjna baza danych systemu.
- **Kolejka komunikatów:** RabbitMQ wraz z Celery – obsługa zdarzeń biznesowych
  (np. złożenie zamówienia, realizacja dostawy) oraz zadań wykonywanych w tle
  (powiadomienia, cykliczne przeliczanie prognoz).
- **Konteneryzacja:** Docker i Docker Compose – uruchamianie wszystkich składników
  systemu w jednolitym środowisku.
- **Kontrola wersji:** Git i GitHub.

Szczegółowe uzasadnienie wyboru technologii zawiera rozdział 7.

### 3.2.2 Terminy i harmonogram projektu

| Etap | Termin |
|---|---|
| Analiza biznesowa, specyfikacja wymagań, projekt architektury | do 13.11.2026 |
| Implementacja pierwszej funkcji głównej i testy (raport 1) | do 17.11.2026 |
| Implementacja pozostałych funkcji, wdrożenie, dokumentacja użytkownika (raport 2) | do 15.12.2026 |
| Utrzymanie, aktualizacje, planowanie i kontrola, wnioski (raport 3) | do 12.01.2027 |
| Obrona projektu | do 25.01.2027 |

### 3.2.3 Usługi firmy kateringowej

| Usługa | Opis | Charakterystyka zamówień |
|---|---|---|
| Catering dietetyczny | Codzienne dostawy zestawów posiłków w ramach wybranej diety (np. standard, wegetariańska, wegańska, keto, sportowa, bezglutenowa) i kaloryczności | Subskrypcje na określoną liczbę dni, dostawy poranne, możliwość wstrzymania dostaw |
| Catering firmowy | Posiłki dostarczane do biur dla pracowników firm | Zamówienia cykliczne lub jednorazowe, dostawy w porze lunchu |
| Catering okolicznościowy | Obsługa wydarzeń: konferencji, wesel, przyjęć | Zamówienia jednorazowe, duże ilości, indywidualnie ustalane menu |

W prototypie systemu szczegółowo realizowana jest obsługa cateringu dietetycznego
i firmowego, ponieważ generują one największą liczbę codziennych operacji.

### 3.2.4 Organizacja firmy

| Jednostka | Zakres odpowiedzialności | Stanowiska |
|---|---|---|
| Zarząd | Strategia, decyzje biznesowe, nadzór nad firmą | Właściciel, dyrektor operacyjny |
| Dział obsługi klienta i sprzedaży | Przyjmowanie zamówień, kontakt z klientami, reklamacje | Konsultanci, opiekun klientów firmowych |
| Dział dietetyki | Układanie jadłospisów, kaloryczność, alergeny | Dietetycy |
| Dział produkcji (kuchnia) | Przygotowanie i porcjowanie posiłków | Szef kuchni, kucharze, pomoc kuchenna |
| Dział pakowania | Pakowanie i etykietowanie posiłków | Pracownicy pakowni |
| Dział zaopatrzenia i magazynu | Zakupy składników, relacje z dostawcami, stany magazynowe | Zaopatrzeniowiec, magazynier |
| Dział logistyki | Planowanie i realizacja dostaw | Koordynator dostaw, kierowcy |
| Dział finansowo-księgowy | Rozliczenia, fakturowanie, płatności | Księgowa (często usługa zewnętrzna) |
| Kadry (HR) | Zatrudnienie, grafik pracy, wynagrodzenia | Specjalista ds. kadr |
| Marketing | Promocje, komunikacja z klientami | Specjalista ds. marketingu |

Firma nie posiada działu IT – jest to jeden z kluczowych argumentów za wyborem
modelu SaaS (punkt 3.3).

### 3.2.5 Wymagania do zespołu

Poniżej przedstawiono skład zespołu niezbędnego do wytworzenia pełnej, komercyjnej
wersji produktu. W ramach przedmiotu prototyp realizowany jest przez dwuosobowy
zespół projektowy, który pełni wszystkie wymienione role w ograniczonym zakresie.

| Rola | Liczba osób | Zadania |
|---|---|---|
| Kierownik projektu | 1 | Planowanie, kontrola postępu, kontakt z klientem |
| Analityk biznesowy | 1 | Analiza procesów firmy kateringowej, specyfikacja wymagań |
| Architekt oprogramowania | 1 | Projekt architektury, dobór technologii |
| Projektant UI/UX | 1 | Projekt interfejsu aplikacji klienckiej i panelu pracowników |
| Programista backend | 3 | Logika biznesowa, API, integracje, kolejka zdarzeń |
| Programista frontend | 2 | Aplikacja kliencka i panel pracowników |
| Specjalista ds. analizy danych | 1 | Moduł statystyk i prognozowania |
| Inżynier DevOps | 1 | Infrastruktura, konteneryzacja, CI/CD, monitorowanie |
| Tester | 2 | Testy funkcjonalne, wydajnościowe i bezpieczeństwa |

### 3.2.6 Koszt projektu

Szacunek dotyczy wytworzenia pierwszej komercyjnej wersji produktu w ciągu
6 miesięcy.

| Pozycja | Liczba osób | Miesiące | Stawka miesięczna [zł] | Koszt [zł] |
|---|---|---|---|---|
| Kierownik projektu | 1 | 6 | 18 000 | 108 000 |
| Analityk biznesowy | 1 | 2 | 15 000 | 30 000 |
| Architekt oprogramowania | 1 | 2 | 22 000 | 44 000 |
| Projektant UI/UX | 1 | 2 | 14 000 | 28 000 |
| Programiści backend | 3 | 5 | 17 000 | 255 000 |
| Programiści frontend | 2 | 4 | 15 000 | 120 000 |
| Specjalista ds. analizy danych | 1 | 3 | 18 000 | 54 000 |
| Inżynier DevOps | 1 | 3 | 18 000 | 54 000 |
| Testerzy | 2 | 4 | 12 000 | 96 000 |
| **Razem wynagrodzenia** | | | | **789 000** |
| Infrastruktura chmurowa na czas wytwarzania i testów | | 6 | 3 000 | 18 000 |
| Licencje i narzędzia | | | | 12 000 |
| **Suma częściowa** | | | | **819 000** |
| Rezerwa na nieprzewidziane wydatki (15%) | | | | 122 850 |
| **Całkowity koszt** | | | | **941 850** |

Większość wykorzystywanych technologii (Python, Django, React, PostgreSQL, RabbitMQ,
Docker) jest dostępna na licencjach open source, co ogranicza koszty licencji.

## 3.3 Rodzaj produktu

Rozważono cztery rodzaje produktu, w jakich może być dostarczone oprogramowanie dla
firm kateringowych:

| Kryterium | Oprogramowanie na zamówienie | Produkt do zakupu i samodzielnego wdrożenia | Platforma SaaS | Usługa projektowania, wdrożenia i utrzymania (wynajem) |
|---|---|---|---|---|
| Odbiorca | Jedna konkretna firma | Wiele firm, każda wdraża samodzielnie | Wiele firm korzystających ze wspólnej platformy | Firmy wynajmujące kompleksową usługę |
| Koszt początkowy dla firmy kateringowej | Bardzo wysoki | Średni (licencja) + koszt wdrożenia | Niski (abonament) | Średni |
| Infrastruktura IT | Po stronie klienta | Po stronie klienta | Po stronie dostawcy SaaS | Po stronie usługodawcy |
| Utrzymanie i aktualizacje | Klient lub osobna umowa | Klient | Dostawca, automatycznie dla wszystkich | Usługodawca |
| Dopasowanie do firmy | Pełne | Ograniczone do konfiguracji | Ograniczone do konfiguracji | Wysokie |
| Wymagane kompetencje IT w firmie | Wysokie | Wysokie | Brak | Niskie |
| Model przychodu producenta | Jednorazowy | Sprzedaż licencji | Stały abonament | Umowa serwisowa |

**Wybrany rodzaj produktu: platforma w modelu SaaS**, świadczona przez producenta
oprogramowania na dzierżawionej infrastrukturze chmurowej (IaaS). Uzasadnienie:

- typowa firma kateringowa, tak jak SmakBox, nie posiada działu IT ani serwerów,
  więc model SaaS zdejmuje z niej odpowiedzialność za infrastrukturę, kopie
  zapasowe, bezpieczeństwo i aktualizacje;
- niski koszt wejścia (abonament zamiast jednorazowej inwestycji) czyni produkt
  dostępnym dla małych i średnich firm, które stanowią większość rynku;
- jedna wersja oprogramowania dla wszystkich klientów upraszcza rozwój i pozwala
  szybko dostarczać poprawki;
- dane wielu firm (z zachowaniem ich separacji i anonimizacji) mogą w przyszłości
  poprawić jakość prognoz popytu.

Architektura systemu zostanie zaprojektowana tak, aby ten sam produkt mógł zostać
także zainstalowany na infrastrukturze pojedynczej, dużej firmy kateringowej
(wariant wdrożenia lokalnego). Warianty infrastruktury opisano w rozdziale 6.
Wdrożeniem pilotażowym prototypu jest jedna firma – SmakBox; obsługa wielu firm
(wielodostępność, ang. multi-tenancy) jest przewidziana w dalszym rozwoju produktu.

## 3.4 Zakres produktu

### 3.4.1 Moduły systemu

Pełny system obejmuje moduły odpowiadające funkcjom głównym działalności firmy
kateringowej. W tabeli zaznaczono, które z nich są realizowane w prototypie.

| Moduł | Opis | Realizacja w prototypie |
|---|---|---|
| Obsługa klienta | Portal klienta: rejestracja, logowanie, menu i diety, składanie i przegląd zamówień | Tak |
| Zarządzanie relacjami z klientami (CRM) | Profil klienta, historia zamówień, preferencje, alergeny, reklamacje | Częściowo (profil, historia, alergeny) |
| Planowanie operacyjne | Lista produkcyjna dla kuchni na wybrany dzień, statusy przygotowania | Tak |
| Dostawy | Przydział dostaw kierowcom, statusy dostaw | Tak |
| Analiza statystyk i prognozy | Statystyki sprzedaży, prognoza liczby zamówień | Tak |
| Planowanie zasobów | Zapotrzebowanie na składniki wynikające z zamówień i prognoz | Częściowo (wyliczenie zapotrzebowania) |
| Zarządzanie personelem | Konta pracowników, role, wyznaczanie optymalnej i minimalnej liczby pracowników | Częściowo (konta, role, wyliczenia) |
| Zarządzanie relacjami z dostawcami | Katalog dostawców, zamówienia składników | Nie (opis w architekturze) |
| Księgowość | Faktury, płatności, rozliczenia | Nie (integracja z systemem zewnętrznym opisana w architekturze) |

### 3.4.2 Elementy projektu

- **Aplikacja kliencka (frontend)** – strona internetowa, na której klient przegląda
  ofertę, zakłada konto, składa i śledzi zamówienia.
- **Panel pracowników (frontend)** – interfejs dla pracowników kuchni, kierowców,
  menedżerów i administratorów, z dostępem zależnym od roli.
- **Backend (REST API)** – logika biznesowa systemu, uwierzytelnianie i autoryzacja,
  publikowanie i obsługa zdarzeń, moduł prognoz.
- **Baza danych** – dane o klientach, pracownikach, menu, dietach, zamówieniach,
  dostawach i statystykach.
- **Kolejka komunikatów** – przekazywanie zdarzeń między modułami i wykonywanie
  zadań w tle.

### 3.4.3 Poza zakresem prototypu

- rzeczywiste płatności online (w prototypie symulowane, docelowo integracja
  z zewnętrznym operatorem płatności);
- optymalizacja tras dostaw z wykorzystaniem map (w prototypie uproszczony
  przydział dostaw do kierowców według stref);
- natywna aplikacja mobilna (zastąpiona responsywnym interfejsem webowym);
- obsługa wielu firm kateringowych w jednej instancji systemu.

### 3.4.4 Wymagania ogólne wobec systemu

System powinien zapewniać bezpieczeństwo danych osobowych klientów, wysoką
dostępność w godzinach przyjmowania zamówień i realizacji dostaw, intuicyjną
obsługę dla użytkowników o różnych kompetencjach technicznych, możliwość
jednoczesnej pracy wielu użytkowników oraz modułową budowę ułatwiającą dalszy
rozwój. Szczegółowe wymagania przedstawiono w rozdziale 5.
