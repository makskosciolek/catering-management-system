# 1. Wstęp

Niniejszy raport dokumentuje przebieg projektu realizowanego w ramach przedmiotu
„Inżynieria Oprogramowania”. Celem dydaktycznym projektu jest przećwiczenie tworzenia
oprogramowania systemu informatycznego w warunkach zbliżonych do pracy w firmie IT,
zgodnie z kolejnymi etapami cyklu życia oprogramowania (SDLC): analizą biznesową,
specyfikacją wymagań, projektowaniem architektury, implementacją, testowaniem,
wdrożeniem oraz utrzymaniem.

Raport powstaje w trzech wersjach. Każda kolejna wersja rozszerza poprzednią o wyniki
następnych etapów, a błędy i niedociągnięcia wykryte na późniejszych etapach są
poprawiane i opisywane. Dzięki temu dokument pokazuje nie tylko końcowy produkt,
ale także proces, w którym ten produkt powstawał i był ulepszany.

## 1.1 Charakterystyka branży kateringowej

Firma kateringowa przygotowuje posiłki i dostarcza je klientom indywidualnym, firmom
oraz organizatorom wydarzeń. Na rynku można wyróżnić trzy podstawowe rodzaje usług:
catering dietetyczny (tzw. dieta pudełkowa, dostarczana codziennie w ramach
subskrypcji), catering firmowy (posiłki dostarczane do biur) oraz catering
okolicznościowy (obsługa wesel, konferencji i innych wydarzeń).

Działalność kateringowa ma kilka cech, które sprawiają, że jej organizacja jest
szczególnie wymagająca:

- **produkt jest nietrwały** – posiłki przygotowuje się na konkretny dzień, więc zarówno
  nadprodukcja (marnowanie żywności), jak i niedobór (niezrealizowane zamówienia)
  oznaczają bezpośrednią stratę;
- **czas jest krytyczny** – dostawy diet pudełkowych odbywają się zwykle we wczesnych
  godzinach porannych, w krótkich oknach czasowych;
- **popyt jest zmienny** – liczba zamówień zmienia się w zależności od dnia tygodnia,
  pory roku, świąt czy okresów „noworocznych postanowień”, co utrudnia planowanie
  zakupów i personelu;
- **oferta jest zróżnicowana** – wiele rodzajów diet, wariantów kaloryczności, alergenów
  i indywidualnych wykluczeń składników zwiększa złożoność produkcji;
- **procesy są ze sobą ściśle powiązane** – zamówienie klienta wpływa jednocześnie na
  zakupy, pracę kuchni, pakowanie, logistykę i rozliczenia.

Z tych powodów firmy kateringowe, które opierają swoją pracę na arkuszach kalkulacyjnych,
telefonach i ręcznie sporządzanych listach, szybko osiągają granicę możliwości rozwoju.
Odpowiednio zaprojektowane oprogramowanie pozwala zautomatyzować przepływ informacji
między działami oraz podejmować decyzje na podstawie danych, a nie intuicji.

## 1.2 Struktura raportu

Rozdziały 2–4 opisują cel projektu, problem biznesowy, założenia oraz specyfikację
biznesową. Rozdział 5 zawiera specyfikację wymagań oprogramowania, a rozdział 6
projekt architektury systemu. Rozdział 7 uzasadnia wybór technologii i narzędzi,
rozdział 8 dokumentuje implementację, a rozdziały 9 i 10 opisują błędy wykryte podczas
testowania oraz wprowadzone na ich podstawie poprawki. Kolejne rozdziały, dotyczące
wdrożenia, dokumentacji użytkownika, utrzymania i wniosków, zostaną dodane w następnych
wersjach raportu.
