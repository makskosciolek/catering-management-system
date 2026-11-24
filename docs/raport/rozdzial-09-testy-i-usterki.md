# 9. Błędy i usterki wykryte w fazie testowania

## 9.1 Sprawdzone scenariusze

Wyniki potwierdzono 17 listopada 2026 r. w lokalnym środowisku z PostgreSQL
i RabbitMQ uruchomionymi przez Docker Compose. Testy API korzystały z osobnej
bazy testowej. Playwright uruchomił Chrome i połączył się z działającym API,
menu i kontami demonstracyjnymi.

| ID | Co sprawdzono | Wynik |
|---|---|---|
| T-01 | Rejestrację, logowanie, wylogowanie, ciasteczko HttpOnly, CSRF i odrzucenie próby nadania sobie roli | Testy API zakończone powodzeniem |
| T-02 | Cenę naliczaną przez serwer, walidację ilości, daty i aktywności dania oraz brak zapisów po odrzuceniu zamówienia | Testy API zakończone powodzeniem |
| T-03 | Dostęp do własnych zamówień, brak dostępu do zamówień innego klienta i odczyt przez menedżera | Testy API zakończone powodzeniem |
| T-04 | Wpis outbox po złożeniu zamówienia, zachowanie po symulowanym odrzuceniu publikacji i ponowienie | Testy API zakończone powodzeniem |
| T-05 | Rejestrację, zamówienie dwóch porcji, odświeżenie potwierdzenia i odszukanie zamówienia w panelu menedżera | Test Playwright zakończony powodzeniem |
| T-06 | Filtrowanie menu, układ przy różnych szerokościach i fokus klawiatury | Test mobilny przy 390 px przeszedł. Sprawdzono brak przewijania poziomego przy 390, 1280, 1536 i 1920 px oraz widoczny fokus po użyciu klawisza Tab przy 1920 px. |
| T-07 | Publikację zdarzeń do działającego brokera | Wpis zamówienia z testu przeglądarkowego otrzymał znacznik publikacji. W nowej kolejce magazynu były trzy komunikaty, w tym zdarzenia z danych demonstracyjnych. |
| T-08 | Walidację OpenAPI i budowę interfejsu z wygenerowanymi typami | Schemat bez ostrzeżeń, kontrola TypeScript i budowa zakończone powodzeniem |
| T-09 | Dostęp administratora do panelu Django | W Chrome zalogowano się kontem demonstracyjnym i otwarto listę dań. |
| T-10 | Automatyczne sprawdzenie całego repozytorium w GitHub Actions | Uruchomienie z 20 listopada 2026 r.: ruff, kontrola TypeScript, ESLint, Prettier, budowa frontendu, 25 testów API Zamówień, 21 testów API Zasobów i 5 scenariuszy Playwright zakończone powodzeniem. |
| T-11 | Przyjęcie dostawy po utracie odpowiedzi | Pierwszy zapis zwrócił `201`. Po utracie odpowiedzi i odświeżeniu karty przeglądarka wysłała ten sam UUID i te same dane. Serwer zwrócił `200`. W historii był jeden wpis, a zapas wzrósł o 2,5 kg. |
| T-12 | Zapis receptury, uzupełnienie braku i ponowienie rezerwacji | Zamówienie dwóch porcji czekało na brakujący 1 kg. Po przyjęciu 1 kg i ponowieniu magazyn pokazał udaną rezerwację, a RabbitMQ przekazał wynik do zamówienia klienta. |
| T-13 | Odczyt magazynu przez menedżera i utrata sesji | Menedżer odczytał historię i recepturę. Formularze zapisu były dostępne magazynierowi. Po wylogowaniu dane historii zniknęły i pojawił się ekran logowania. |

Od 20 listopada testy uruchamiają się automatycznie przy każdym wysłaniu zmian do
repozytorium (plik `.github/workflows/check.yml`), więc wynik jest widoczny przy
każdym commicie na GitHubie.

24 listopada w izolowanym środowisku z PostgreSQL, RabbitMQ i Chrome przeszło
25 testów Zamówień, 21 testów Zasobów i 11 scenariuszy Playwright. Sprawdzono
formularz przyjęcia przy 390, 1280 i 1920 px oraz w emulacji skali 125% przy
1536 px. Formularz receptury obejrzano również w układzie mobilnym.

Do sprawdzenia pozostają przebieg od rezerwacji do doręczenia, obciążenie,
odtwarzanie bazy i skalowanie systemowe interfejsu.

## 9.2 Rejestr usterek

| ID | Okoliczności | Objaw i skutek |
|---|---|---|
| U-01 | Pierwsze uruchomienie Docker Compose z już otwartego PowerShell | Docker CLI był dostępny po pełnej ścieżce, ale nie znalazł programu `docker-credential-desktop`. Nie można było pobrać obrazów. |
| U-02 | Walidacja OpenAPI dla listy zamówień | Generator nie rozpoznał typu parametru `delivery_date` opisanego klasą pola serializatora. Walidacja zgłosiła ostrzeżenie. |
| U-03 | Oględziny menu przy szerokości 390 px | Rysunek talerza znalazł się częściowo pod nagłówkiem. Pogarszał czytelność nagłówka na wąskim ekranie. |
| U-04 | Ponowne uruchomienie instalacji przy działającym Vite na Windowsie | `npm ci` nie mógł podmienić używanego pliku `esbuild.exe`. Instalator kończył się po częściowym wykonaniu. |
| U-05 | Uruchomienie Zamówień na istniejącym wolumenie z niezgodnym schematem bazy | Zapis zamówienia kończył się błędem 500. Tabela zawierała dodatkową obowiązkową kolumnę, której aplikacja nie wypełniała. |
| U-06 | Przegląd reguł składania zamówienia pod kątem procesu w kuchni | Klient mógł złożyć zamówienie z dostawą na bieżący dzień albo na jutro późnym wieczorem. Kuchnia planuje produkcję dzień wcześniej, więc takie zamówienie nie zostałoby przygotowane na czas. |
| U-07 | Przegląd walidacji formularzy zamówienia i profilu | Pole telefonu przyjmowało dowolny tekst, np. „zadzwonić do recepcji” albo „123”. Kierowca nie mógłby skontaktować się z klientem przy dostawie. |
| U-08 | Przegląd obsługi błędów sieci przy składaniu zamówienia | Gdy serwer zapisał zamówienie, ale odpowiedź nie dotarła do przeglądarki, klient widział błąd i mógł kliknąć ponownie. Drugie żądanie tworzyło drugie zamówienie, nowe zdarzenie i drugą rezerwację składników. |
| U-09 | Wycofanie dania z menu, gdy klient ma je w koszyku | Pozycja znikała z koszyka i z wysyłanego zamówienia, ale licznik porcji w nawigacji nadal ją uwzględniał. Klient mógł złożyć niepełne zamówienie, nie wiedząc o tym. |
| U-10 | Porównanie wymagania FR-06 z działaniem wyszukiwarki | Wymaganie i API przewidują wyszukiwanie po alergenach, ale wyszukiwarka w menu sprawdzała tylko nazwę i opis dania. Wpisanie np. „gluten” nie zwracało dań z tym alergenem. |
| U-11 | Konto pracownika utworzone w panelu Django z wielkimi literami w adresie | Panel zapisywał adres w podanej postaci, a logowanie porównuje adres zapisany małymi literami. Pracownik nie mógł zalogować się w aplikacji. Dodatkowo rejestracja przyjmowała adres dłuższy niż 254 znaki, który baza odrzucała błędem serwera. |
| U-12 | Uruchomienie testów w GitHub Actions po zmianie odświeżania panelu zamówień | Aby zmniejszyć liczbę żądań, lista i szczegóły zamówień odświeżały się co 30 sekund, gdy żadne zamówienie nie czekało na magazyn. Test „po utracie sesji panel ukrywa zapisane dane” wykazał, że po wylogowaniu w innym miejscu dane zamówień pozostawały widoczne do 30 sekund, zamiast zniknąć po kilku sekundach. |
| U-13 | Pierwszy pełny przebieg po dodaniu testów magazynu | Wszystkie przeglądarki testowe logowały się z jednego adresu. Po dziesięciu logowaniach w ciągu minuty serwer zwrócił `429`. Dwa scenariusze zakończyły się na ekranie logowania. |
| U-14 | Oględziny formularza przyjęcia w Chrome przy szerokości 390 px | Pola składnika i ilości dzieliły jeden wiersz. Pole wyboru przycinało nazwę dłuższego składnika. |
