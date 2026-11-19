# 10. Edycje kodu na podstawie wyników testowania

W tabeli powiązano usterki z konkretną zmianą i sposobem sprawdzenia.

| Usterka | Zmieniony element | Poprawka | Weryfikacja |
|---|---|---|---|
| U-01 | [infra.ps1](../../scripts/infra.ps1) | Skrypt na czas uruchamiania Compose dodaje katalog wybranego Docker CLI do PATH bieżącego procesu. Na końcu odtwarza poprzednią wartość. | Obrazy pobrano. PostgreSQL i RabbitMQ osiągnęły stan `Healthy`. |
| U-02 | [sales/views.py](../../backend/services/orders/src/cateringhub_orders/sales/views.py) | Parametr `delivery_date` otrzymał jawny typ `OpenApiTypes.DATE`, niezależny od walidacji danych w API. | Ponowna walidacja OpenAPI bez ostrzeżeń. Wygenerowano typy i zbudowano frontend. |
| U-03 | [app.module.css](../../frontend/src/app.module.css) | Przy szerokości do 470 px ilustracja jest ukryta, a tekst ma dostęp do pełnej szerokości nagłówka. | Ponowny test przy 390 px, porównanie układu i sprawdzenie braku przewijania poziomego. |
| U-04 | [setup.ps1](../../scripts/setup.ps1) | Instalator sprawdza port Vite przed zmianą plików. Jeżeli serwer działa, podaje instrukcję zatrzymania go. | Przy zajętym porcie skrypt zakończył się przed instalacją. Po zatrzymaniu serwera instalacja i testy API przeszły. |
| U-05 | [compose.yaml](../../compose.yaml) i [instrukcja uruchomienia](../../README.md#uruchomienie-lokalne) | Konfiguracja projektu Compose pozwala każdemu środowisku używać własnych wolumenów. Port panelu RabbitMQ można ustawić przy uruchomieniu. | Instalacja na świeżych wolumenach, zapis zamówienia przez Chrome i publikacja zdarzenia do RabbitMQ zakończyły się powodzeniem. |
| U-06 | [sales/rules.py](../../backend/services/orders/src/cateringhub_orders/sales/rules.py), [sales/serializers.py](../../backend/services/orders/src/cateringhub_orders/sales/serializers.py), [format.ts](../../frontend/src/format.ts), [menu-page.tsx](../../frontend/src/menu-page.tsx) | Dodano godzinę graniczną `ORDER_CUTOFF_HOUR` (domyślnie 18:00). Do tej godziny najwcześniejszy termin to jutro, później pojutrze. Serwer odrzuca wcześniejszą datę z komunikatem podającym najbliższy możliwy termin. Formularz ustawia minimalną datę według tej samej reguły i informuje o godzinie granicznej. Test Playwright zamawia na pojutrze, aby nie zależał od godziny uruchomienia. | Testy jednostkowe reguły dla godzin 0, 17, 18 i 23 oraz testy API: odrzucenie dostawy na dziś, odrzucenie dostawy na jutro po godzinie granicznej i przyjęcie dostawy na pojutrze bez zapisu zamówienia przy błędzie. |
| U-07 | [accounts/validators.py](../../backend/services/orders/src/cateringhub_orders/accounts/validators.py), serializatory kont i zamówień | Pole `PhoneField` sprawdza numer w zamówieniu, rejestracji i profilu: od 9 do 15 cyfr, dopuszczalne spacje, myślniki i znak + na początku. Wielokrotne spacje są ujednolicane. W profilu pole może pozostać puste. | Testy API: odrzucenie numeru z tekstem w zamówieniu bez zapisu danych, odrzucenie zbyt krótkiego i zbyt długiego numeru w profilu, zapis numeru międzynarodowego po ujednoliceniu odstępów oraz wyczyszczenie pola. |

Dalsze poprawki będą rejestrowane razem ze scenariuszem, który ujawnił błąd,
i wynikiem ponownego sprawdzenia. Przy dodaniu odbiorcy magazynowego pierwszą
próbą będzie dwukrotne dostarczenie tego samego zdarzenia i sprawdzenie,
czy stan zmienił się tylko raz.
