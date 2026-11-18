# 10. Edycje kodu na podstawie wyników testowania

W tabeli powiązano usterki z konkretną zmianą i sposobem sprawdzenia.

| Usterka | Zmieniony element | Poprawka | Weryfikacja |
|---|---|---|---|
| U-01 | [infra.ps1](../../scripts/infra.ps1) | Skrypt na czas uruchamiania Compose dodaje katalog wybranego Docker CLI do PATH bieżącego procesu. Na końcu odtwarza poprzednią wartość. | Obrazy pobrano. PostgreSQL i RabbitMQ osiągnęły stan `Healthy`. |
| U-02 | [sales/views.py](../../backend/services/orders/src/cateringhub_orders/sales/views.py) | Parametr `delivery_date` otrzymał jawny typ `OpenApiTypes.DATE`, niezależny od walidacji danych w API. | Ponowna walidacja OpenAPI bez ostrzeżeń. Wygenerowano typy i zbudowano frontend. |
| U-03 | [app.module.css](../../frontend/src/app.module.css) | Przy szerokości do 470 px ilustracja jest ukryta, a tekst ma dostęp do pełnej szerokości nagłówka. | Ponowny test przy 390 px, porównanie układu i sprawdzenie braku przewijania poziomego. |
| U-04 | [setup.ps1](../../scripts/setup.ps1) | Instalator sprawdza port Vite przed zmianą plików. Jeżeli serwer działa, podaje instrukcję zatrzymania go. | Przy zajętym porcie skrypt zakończył się przed instalacją. Po zatrzymaniu serwera instalacja i testy API przeszły. |
| U-05 | [compose.yaml](../../compose.yaml) i [instrukcja uruchomienia](../../README.md#uruchomienie-lokalne) | Konfiguracja projektu Compose pozwala każdemu środowisku używać własnych wolumenów. Port panelu RabbitMQ można ustawić przy uruchomieniu. | Instalacja na świeżych wolumenach, zapis zamówienia przez Chrome i publikacja zdarzenia do RabbitMQ zakończyły się powodzeniem. |

Dalsze poprawki będą rejestrowane razem ze scenariuszem, który ujawnił błąd,
i wynikiem ponownego sprawdzenia. Przy dodaniu odbiorcy magazynowego pierwszą
próbą będzie dwukrotne dostarczenie tego samego zdarzenia i sprawdzenie,
czy stan zmienił się tylko raz.
