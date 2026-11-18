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

Przy zapisaniu dostawy klient API przekazuje UUID w polu `id`. Pierwszy zapis
zwraca `201`. Powtórzenie tych samych danych przez to samo konto zwraca `200`
bez ponownego zwiększenia stanu. Użycie tego samego UUID z innymi danymi lub
przez inne konto zwraca `409`.

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

Pełny opis pól i odpowiedzi publikuje [OpenAPI Zasobów](http://localhost:5173/api/inventory/v1/docs/).
Przy żądaniach `POST` przekaż ciasteczka z logowania i nagłówek `X-CSRFToken`.

## 3. Co zostało

1. Dodać receptury, rezerwacje i ponawianie po uzupełnieniu braków.
2. Podłączyć odbiór zdarzeń Zamówień z RabbitMQ i przekazywanie wyniku rezerwacji.
3. Dodać panel magazyniera i testy przeglądarkowe przepływu zamówienia.
4. Rozliczać zużycie po przygotowaniu posiłków i wyliczać plan zapotrzebowania.
