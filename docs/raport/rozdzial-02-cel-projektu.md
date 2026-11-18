# 2. Cel projektu

Celem projektu jest zaprojektowanie i zrealizowanie oprogramowania wspierającego
działalność firmy kateringowej, które obejmie cały przepływ pracy: od przyjęcia
zamówienia od klienta, przez planowanie produkcji i dostaw, aż po analizę danych
i prognozowanie zapotrzebowania na zasoby. Oprogramowanie ma umożliwić klientom
wygodne składanie zamówień przez Internet, pracownikom firmy sprawne wykonywanie
codziennych zadań, a kadrze zarządzającej podejmowanie decyzji na podstawie
rzetelnych danych.

Produkt jest projektowany jako platforma udostępniana w modelu SaaS (Software as
a Service), dzięki czemu z systemu mogą korzystać również małe i średnie firmy
kateringowe, które nie posiadają własnego działu IT ani infrastruktury serwerowej.

## 2.1 Cele szczegółowe

1. Przeprowadzenie analizy działalności firmy kateringowej, jej procesów biznesowych,
   struktury organizacyjnej i interesariuszy.
2. Sporządzenie specyfikacji wymagań funkcjonalnych i niefunkcjonalnych, z podziałem
   na role użytkowników o różnym poziomie dostępu.
3. Zaprojektowanie architektury systemu na trzech poziomach (biznesowym,
   aplikacyjnym i technologicznym) wraz z porównaniem alternatywnych rozwiązań.
4. Implementacja prototypu, który obsługuje zamówienia, magazyn i realizację
   zamówienia od kuchni do dostawy. Zamówienia podają statystyki sprzedaży,
   a Realizacja odpowiada za wskaźniki dostaw.
5. Opracowanie modułu planowania w Zasobach. Moduł wykorzysta zamówienia,
   prognozę popytu i receptury do wyliczenia zapotrzebowania na składniki.
   Ustalanie grafików i wyliczanie obsady pozostają w wizji pełnego produktu.
6. Przetestowanie systemu, udokumentowanie wykrytych błędów i wprowadzonych poprawek
   oraz przygotowanie systemu do wdrożenia w kontenerach.

## 2.2 Oczekiwane rezultaty

Rezultatem projektu będą: działająca aplikacja webowa (część kliencka i panel
pracowników), interfejs API, baza danych, kod źródłowy opublikowany w repozytorium
GitHub oraz komplet dokumentacji obejmującej analizę, architekturę, implementację,
testy i instrukcję użytkownika.
