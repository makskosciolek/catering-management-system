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

Zestaw obejmuje osiem przypadków pytest i dwa scenariusze Playwright.
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
