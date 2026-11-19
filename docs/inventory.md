# Zasoby

## 1. Co działa

Zasoby działają jako osobny proces Django na porcie `8002` i używają bazy
`inventory`. Zamówienia wystawiają token JWT przy logowaniu. Zasoby sprawdzają
podpis i rolę z tokenu bez odpytywania bazy Zamówień. Magazynier i administrator
mogą czytać i zapisywać dane. Menedżer ma dostęp do odczytu.

| Metoda i ścieżka pod `/api/inventory/v1/` | Działanie |
|---|---|
| `GET health/` | Sprawdza połączenie z bazą. |
| `GET ingredients/` | Zwraca składniki, stan fizyczny, stan dostępny i informację o zejściu poniżej progu. |
| `POST ingredients/` | Dodaje składnik z jednostką `kg`, `l` lub `pcs` i opcjonalnym progiem minimalnym. |
| `GET receipts/` | Zwraca historię przyjęć z pozycjami, od najnowszego. |
| `POST receipts/` | Zapisuje dostawcę i pozycje przyjęcia oraz zwiększa stan składników w jednej transakcji. |
| `GET recipes/{meal_id}/`, `PUT recipes/{meal_id}/` | Odczytuje lub zastępuje recepturę z ilościami na porcję. Identyfikator dania pochodzi z menu Zamówień. |
| `GET reservations/`, `GET reservations/{order_id}/` | Pokazuje stan rezerwacji, brakujące składniki i brakujące receptury. |
| `POST reservations/{order_id}/retry/` | Ponawia rezerwację po uzupełnieniu składników lub receptur. |

Przy zapisaniu dostawy klient API przekazuje UUID w polu `id`. Pierwszy zapis
zwraca `201`. Powtórzenie tych samych danych przez to samo konto zwraca `200`
bez ponownego zwiększenia stanu. Użycie tego samego UUID z innymi danymi lub
przez inne konto zwraca `409`.

Zasoby odbierają `order.submitted` z RabbitMQ. Dla wszystkich dań z zamówienia
sumują składniki z receptur i rezerwują zapas, gdy można przygotować całość.
Potwierdzenie odbioru następuje po zapisaniu wyniku, identyfikatora zdarzenia
i zdarzenia zwrotnego w jednej transakcji. Ponowne doręczenie nie zmienia
rezerwacji. Zamówienia odbierają `stock.reserved` lub `stock.shortage` i
pokazują klientowi aktualny wynik. Po przyjęciu dostawy lub zapisaniu brakującej
receptury magazynier może ponowić rezerwację przez API.

## 2. Jak sprawdzić

Uruchom `scripts/setup.ps1` i `scripts/dev.ps1` zgodnie z [README](../README.md).
Użyj konta `magazyn@smakbox.example` z hasłem ze
[skryptu demonstracyjnego](../backend/services/orders/src/cateringhub_orders/sales/management/commands/seed_demo.py).
Polecenia niżej korzystają ze wspólnego adresu Vite dla obu API.

```powershell
$base = 'http://127.0.0.1:5173/api'
$auth = "$base/orders/v1/auth"
$stock = "$base/inventory/v1"
$csrf = Invoke-RestMethod "$auth/csrf/" -SessionVariable session
$headers = @{ 'X-CSRFToken' = $csrf.csrfToken }
$credentials = @{ email = 'magazyn@smakbox.example'; password = Read-Host 'Hasło konta demo' } | ConvertTo-Json
Invoke-RestMethod "$auth/login/" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body $credentials
Invoke-RestMethod "$stock/ingredients/" -WebSession $session
```

Pełny opis pól i odpowiedzi jest w [specyfikacji OpenAPI](api/inventory.openapi.yaml)
i [Swagger UI](http://localhost:5173/api/inventory/v1/docs/). Przy żądaniach
`POST` i `PUT` przekaż ciasteczka z logowania i nagłówek `X-CSRFToken`.

## 3. Co zostało

1. Dodać panel magazyniera i testy przeglądarkowe obsługi magazynu.
2. Rozliczać zużycie po przygotowaniu posiłków i wyliczać plan zapotrzebowania.
