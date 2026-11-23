import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, menuKey } from './api/client'
import {
  inventoryApi,
  inventoryKey,
  type Ingredient,
  type Reservation,
} from './api/inventory-client'
import { ApiError } from './api/transport'
import { dateLabel, orderCode, stockQuantity } from './format'
import { isManagement, useSession } from './session'
import { ErrorBox, Icon, Loading, PageControls, StatusPill, type StatusTone } from './ui'
import styles from './app.module.css'
import warehouse from './warehouse.module.css'

const refreshInterval = 5000
const statusLabels: Record<
  Reservation['status'],
  { label: string; tone: StatusTone; quantities?: string }
> = {
  reserved: { label: 'Zarezerwowano', tone: 'ok', quantities: 'Zarezerwowane ilości' },
  shortage: { label: 'Brak zapasu lub receptury', tone: 'warning' },
  cancelled: { label: 'Anulowano', tone: 'neutral', quantities: 'Zwolnione ilości' },
  consumed: { label: 'Zużyto składniki', tone: 'neutral', quantities: 'Zużyte ilości' },
}

export function WarehouseOverview() {
  const user = useSession().data
  const [onlyLow, setOnlyLow] = useState(false)
  const [page, setPage] = useState(1)
  const stock = useQuery({
    queryKey: [...inventoryKey, user?.id, 'ingredients'],
    queryFn: inventoryApi.ingredients,
    refetchInterval: refreshInterval,
  })
  const reservations = useQuery({
    queryKey: [...inventoryKey, user?.id, 'reservations', page],
    queryFn: () => inventoryApi.reservations(page),
    refetchInterval: refreshInterval,
  })
  const denied = [stock.error, reservations.error].find(
    (error) => error instanceof ApiError && error.status === 403,
  )
  const ingredients = stock.isError ? undefined : stock.data
  const pageData = reservations.isError ? undefined : reservations.data
  const menu = useQuery({
    queryKey: menuKey,
    queryFn: api.menu,
    enabled: !denied && Boolean(pageData?.results.some((item) => item.missing_recipes.length)),
  })
  const mealNames = new Map(menu.data?.map((meal) => [meal.id, meal.name]))
  const lowStock = ingredients?.filter((item) => item.below_minimum)
  const visible = onlyLow ? lowStock : ingredients

  if (denied) {
    return (
      <section className={styles.section}>
        <h1>Magazyn</h1>
        <ErrorBox error={denied} />
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h1>Magazyn</h1>
        <a className={styles.smallButton + ' ' + warehouse.jumpLink} href="#warehouse-reservations">
          Przejdź do rezerwacji
        </a>
      </div>
      {ingredients && (
        <div className={styles.metrics}>
          <div>
            <span className={styles.metricIcon}>
              <Icon name="warehouse" />
            </span>
            <span>
              <small>Składniki</small>
              <strong>{ingredients.length}</strong>
            </span>
          </div>
          <div>
            <span className={styles.metricIcon}>
              <Icon name="orders" />
            </span>
            <span>
              <small>Poniżej minimum</small>
              <strong>{lowStock?.length}</strong>
            </span>
          </div>
        </div>
      )}
      <div className={warehouse.panels}>
        <section className={styles.orderPanel} aria-labelledby="stock-heading">
          <div className={warehouse.panelHeader}>
            <div>
              <h2 id="stock-heading">Stany składników</h2>
              <p>Dostępny zapas uwzględnia bieżące rezerwacje.</p>
            </div>
            <label className={warehouse.filter}>
              <input
                type="checkbox"
                checked={onlyLow}
                onChange={(event) => setOnlyLow(event.target.checked)}
              />
              Tylko poniżej minimum
            </label>
          </div>
          {stock.isPending && <Loading>Wczytywanie stanów…</Loading>}
          {stock.isError && <ErrorBox error={stock.error} onRetry={() => void stock.refetch()} />}
          {visible &&
            (visible.length > 0 ? (
              <StockTable items={visible} />
            ) : (
              <p className={styles.empty}>
                {onlyLow ? 'Brak składników poniżej minimum.' : 'Magazyn nie ma składników.'}
              </p>
            ))}
        </section>
        <section
          className={styles.orderPanel + ' ' + warehouse.reservations}
          aria-labelledby="reservations-heading"
          id="warehouse-reservations"
          tabIndex={-1}
        >
          <div className={warehouse.panelHeader}>
            <div>
              <h2 id="reservations-heading">Rezerwacje zamówień</h2>
              <p>Od ostatniej zmiany</p>
            </div>
          </div>
          {reservations.isPending && <Loading>Wczytywanie rezerwacji…</Loading>}
          {reservations.isError && (
            <ErrorBox
              error={reservations.error}
              onRetry={() => {
                if (
                  page > 1 &&
                  reservations.error instanceof ApiError &&
                  reservations.error.status === 404
                )
                  setPage(1)
                else void reservations.refetch()
              }}
            />
          )}
          {pageData &&
            (pageData.results.length > 0 ? (
              <>
                <ul className={warehouse.records} aria-label="Rezerwacje">
                  {pageData.results.map((item) => (
                    <ReservationRecord
                      key={item.order_id}
                      item={item}
                      canOpenOrder={isManagement(user)}
                      mealNames={mealNames}
                    />
                  ))}
                </ul>
                <PageControls page={page} data={pageData} label="rezerwacji" onChange={setPage} />
              </>
            ) : (
              <p className={styles.empty}>Rezerwacje pojawią się po złożeniu zamówień.</p>
            ))}
        </section>
      </div>
    </section>
  )
}

function StockTable({ items }: { items: Ingredient[] }) {
  return (
    <table
      className={`${styles.orderTable} ${warehouse.stockTable}`}
      aria-labelledby="stock-heading"
    >
      <thead>
        <tr>
          <th scope="col">Składnik</th>
          <th scope="col">Stan fizyczny</th>
          <th scope="col">Zarezerwowano</th>
          <th scope="col">Dostępne</th>
          <th scope="col">Minimum</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td data-label="Składnik">
              <strong>{item.name}</strong>
            </td>
            <td data-label="Stan fizyczny">{stockQuantity(item.on_hand, item.unit)}</td>
            <td data-label="Zarezerwowano">{stockQuantity(item.reserved, item.unit)}</td>
            <td data-label="Dostępne">
              <strong>{stockQuantity(item.available, item.unit)}</strong>
              {item.below_minimum && <small className={warehouse.low}>Poniżej minimum</small>}
            </td>
            <td data-label="Minimum">{stockQuantity(item.minimum ?? '0', item.unit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReservationRecord({
  item,
  canOpenOrder,
  mealNames,
}: {
  item: Reservation
  canOpenOrder: boolean
  mealNames: Map<string, string>
}) {
  const state = statusLabels[item.status]
  return (
    <li className={warehouse.record}>
      <div className={warehouse.recordHeading}>
        <div>
          {canOpenOrder ? (
            <Link to={'/orders/' + item.order_id}>{orderCode(item.order_id)}</Link>
          ) : (
            <strong>{orderCode(item.order_id)}</strong>
          )}
          <small>
            Dostawa {dateLabel(item.delivery_date)}
            {item.attempt > 0 && ' · Próba ' + item.attempt}
          </small>
        </div>
        <StatusPill tone={state.tone}>{state.label}</StatusPill>
      </div>
      {item.status === 'shortage' && (
        <ul className={warehouse.shortages}>
          {item.shortages.map((line) => (
            <li key={line.ingredient_id}>
              {line.name} · brakuje <strong>{stockQuantity(line.missing, line.unit)}</strong>
              {' z potrzebnych '}
              {stockQuantity(line.needed, line.unit)}
            </li>
          ))}
          {item.missing_recipes.map((id) => (
            <li key={id}>Brak receptury dla dania {mealNames.get(id) ?? id}</li>
          ))}
          {!item.shortages.length && !item.missing_recipes.length && (
            <li>Brak szczegółów rezerwacji.</li>
          )}
        </ul>
      )}
      {state.quantities && item.lines.length > 0 && (
        <details className={warehouse.allocation}>
          <summary>{state.quantities}</summary>
          <ul>
            {item.lines.map((line) => (
              <li key={line.ingredient_id}>
                <span>{line.name}</span>
                <strong>{stockQuantity(line.quantity, line.unit)}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
