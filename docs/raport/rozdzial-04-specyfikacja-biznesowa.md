# 4. Specyfikacja techniczna dla biznesu

Rozdział rejestruje wyniki fazy wymagań: opisuje obecny sposób działania firmy
kateringowej, docelowy sposób działania po wdrożeniu systemu oraz wymagania
biznesowe, które system musi spełnić.

## 4.1 Obecny stan procesów (AS-IS)

| Proces | Obecny sposób realizacji | Problem |
|---|---|---|
| Przyjęcie zamówienia | Telefon, e-mail, prosty formularz; ręczne przepisanie do arkusza | Pomyłki w danych, brak potwierdzenia i wglądu w status dla klienta |
| Planowanie produkcji | Kierownik kuchni ręcznie zlicza porcje z arkusza | Czasochłonność, błędy w liczbie porcji, nadprodukcja |
| Zakupy składników | Na podstawie doświadczenia zaopatrzeniowca | Marnowanie żywności lub braki składników |
| Planowanie personelu | Grafik w arkuszu, bez danych o przewidywanym obciążeniu | Nadgodziny w dni szczytowe, niepełne obłożenie w dni spokojne |
| Dostawy | Wydrukowane listy adresów, kolejność ustalana przez kierowców | Spóźnienia, brak informacji o realizacji dostaw |
| Analiza działalności | Brak; dane rozproszone w wielu plikach | Decyzje podejmowane intuicyjnie |

## 4.2 Docelowy stan procesów (TO-BE)

| Proces | Sposób realizacji po wdrożeniu systemu |
|---|---|
| Przyjęcie zamówienia | Klient samodzielnie składa zamówienie w aplikacji internetowej, wybierając dietę, kaloryczność i okres; otrzymuje potwierdzenie i może śledzić status. Dane trafiają bezpośrednio do systemu, bez przepisywania. |
| Planowanie produkcji | System automatycznie generuje listę produkcyjną na dany dzień na podstawie aktywnych zamówień; kuchnia oznacza w systemie postęp przygotowania. |
| Zakupy składników | Zasoby wykorzystują zamówione i prognozowane porcje oraz receptury, aby wyliczyć zapotrzebowanie na składniki na kolejne dni. |
| Planowanie personelu | W docelowym produkcie firma korzysta z prognozy popytu, by dobrać obsadę kuchni i kierowców. |
| Dostawy | Dostawy są przydzielane kierowcom według stref; kierowca oznacza realizację w aplikacji na telefonie, a klient i firma widzą status na bieżąco. |
| Analiza działalności | Panel menedżera prezentuje statystyki sprzedaży z Zamówień, wskaźniki dostaw z Realizacji oraz plan zapotrzebowania z Zasobów. |

## 4.3 Wymagania biznesowe

| ID | Wymaganie biznesowe | Uzasadnienie |
|---|---|---|
| BR-01 | Klienci mogą samodzielnie składać i śledzić zamówienia przez Internet | Eliminacja ręcznego przepisywania zamówień i pomyłek, wygoda klienta |
| BR-02 | System automatycznie przygotowuje listę produkcyjną na każdy dzień | Skrócenie czasu planowania produkcji, mniej błędów |
| BR-03 | System wspiera planowanie i kontrolę realizacji dostaw | Poprawa terminowości, możliwość weryfikacji reklamacji |
| BR-04 | System prognozuje liczbę zamówień i zapotrzebowanie na personel i składniki | Ograniczenie marnowania żywności i kosztów nadgodzin |
| BR-05 | Kadra zarządzająca ma dostęp do statystyk i raportów | Podejmowanie decyzji na podstawie danych |
| BR-06 | Dostęp do danych zależy od roli użytkownika | Ochrona danych osobowych i spójność danych |
| BR-07 | Firma nie musi utrzymywać własnej infrastruktury IT | Brak działu IT w typowej firmie kateringowej |
| BR-08 | System można rozwijać o kolejne moduły (księgowość, dostawcy) bez przebudowy całości | Rozwój firmy i produktu w czasie |

BR-04 obejmuje docelowe planowanie składników i personelu. W prototypie
zakres planowania ogranicza się do zapotrzebowania na składniki.

## 4.4 Oczekiwane efekty wdrożenia

Wartości obecne są założeniami przyjętymi dla firmy SmakBox; wartości docelowe
stanowią mierniki, według których będzie można ocenić skuteczność systemu.

| Miernik | Wartość obecna (założona) | Wartość docelowa |
|---|---|---|
| Czas przygotowania listy produkcyjnej | ok. 2 godziny dziennie | poniżej 5 minut |
| Odsetek zamówień z błędami danych | ok. 4% | poniżej 1% |
| Marnowanie żywności (udział niewykorzystanych składników) | ok. 12% | poniżej 7% |
| Terminowość dostaw | ok. 88% | co najmniej 95% |
| Liczba nadgodzin personelu miesięcznie | ok. 300 godzin | spadek o 30% |
| Odsetek zamówień składanych samodzielnie online | ok. 35% | co najmniej 80% |

## 4.5 Podsumowanie

Wdrożenie systemu w modelu SaaS pozwoli firmie kateringowej zintegrować obsługę
klienta, produkcję, logistykę i analizę danych bez inwestowania we własną
infrastrukturę IT. Dane historyczne o zamówieniach pozwolą oszacować ilość
składników potrzebnych na kolejne dni. Celem jest ograniczenie braków i
marnowania żywności. W pełnym produkcie prognoza może także wspierać
planowanie personelu.
