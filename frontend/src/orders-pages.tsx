import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api, deliveryWindowKey } from './api/client'
import { dateLabel, money, orderCode } from './format'
import { isManagement, orderDetailKey, ordersKey, useSession } from './session'
import { ErrorBox, Icon, Loading, PageControls, StatusBadge } from './ui'
import styles from './app.module.css'

export function OrdersPage() {
  const { data: user } = useSession()
  const staff = isManagement(user)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const query = useDeferredValue(search.trim())
  const filters = new URLSearchParams()
  if (query) filters.set('search', query)
  if (date) filters.set('delivery_date', date)
  const orders = useQuery({
    queryKey: [...ordersKey, 'list', user?.id, query, date, page],
    queryFn: () => api.orders(new URLSearchParams([...filters, ['page', String(page)]])),
    refetchInterval: 2000,
  })
  const summary = useQuery({
    queryKey: [...ordersKey, 'summary', user?.id, query, date],
    queryFn: () => api.summary(filters),
    refetchInterval: 2000,
    enabled: staff,
  })
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>{staff ? 'STREFA ZESPOŁU' : 'STREFA KLIENTA'}</p>
          <h1>{staff ? 'Panel zamówień' : 'Moje zamówienia'}</h1>
          <p className={styles.muted}>
            {staff
              ? 'Sprawdź zamówienia klientów oraz terminy ich dostaw.'
              : 'Przeglądaj swoje zamówienia i sprawdzaj ich status.'}
          </p>
        </div>
        {!staff && (
          <Link className={styles.primaryButton} to="/menu">
            <Icon name="plus" size={18} />
            Nowe zamówienie
          </Link>
        )}
      </div>
      {staff && summary.isError && (
        <div className={styles.summaryError}>
          <ErrorBox error={summary.error} onRetry={() => void summary.refetch()} />
        </div>
      )}
      {!summary.isError && summary.data && (
        <div className={styles.metrics}>
          <div>
            <span className={styles.metricIcon}>
              <Icon name="orders" />
            </span>
            <div>
              <small>Zamówienia</small>
              <strong>{summary.data.orders}</strong>
            </div>
          </div>
          <div>
            <span className={styles.metricIcon}>
              <Icon name="main" />
            </span>
            <div>
              <small>Porcje</small>
              <strong>{summary.data.portions}</strong>
            </div>
          </div>
        </div>
      )}
      <div className={styles.orderPanel}>
        <div className={styles.orderFilters}>
          <label>
            Szukaj zamówienia
            <span className={styles.searchField}>
              <Icon name="search" size={17} />
              <input
                type="search"
                value={search}
                placeholder={staff ? 'Klient, e-mail lub adres' : 'Adres dostawy'}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
              />
            </span>
          </label>
          <label>
            Termin dostawy
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setPage(1)
              }}
            />
          </label>
          {(search || date) && (
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => {
                setSearch('')
                setDate('')
                setPage(1)
              }}
            >
              Wyczyść filtry
            </button>
          )}
        </div>
        {orders.isPending && <Loading>Wczytywanie zamówień…</Loading>}
        {orders.isError && <ErrorBox error={orders.error} onRetry={() => void orders.refetch()} />}
        {!orders.isError &&
          orders.data &&
          (orders.data.results.length ? (
            <>
              <table className={styles.orderTable}>
                <thead>
                  <tr>
                    <th scope="col">Zamówienie</th>
                    {staff && <th scope="col">Klient</th>}
                    <th scope="col">Dostawa</th>
                    <th scope="col">Status</th>
                    <th scope="col">Kwota</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.results.map((order) => (
                    <tr key={order.id}>
                      <td data-label="Zamówienie">
                        <Link to={'/orders/' + order.id}>{orderCode(order.id)}</Link>
                        <small>Złożone {dateLabel(order.created_at)}</small>
                      </td>
                      {staff && (
                        <td data-label="Klient">
                          <strong>{order.customer_name || order.customer_email}</strong>
                          <small>{order.customer_email}</small>
                        </td>
                      )}
                      <td data-label="Dostawa">
                        <strong>{dateLabel(order.delivery_date)}</strong>
                        <small>{order.delivery_address}</small>
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={order.status} />
                      </td>
                      <td data-label="Kwota">
                        <strong>{money(order.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PageControls page={page} data={orders.data} label="zamówień" onChange={setPage} />
            </>
          ) : (
            <div className={styles.empty}>
              <Icon name="orders" size={26} />
              <h3>Brak zamówień</h3>
              <p>
                {search || date
                  ? 'Zmień filtry, żeby zobaczyć inne zamówienia.'
                  : 'Tutaj pojawią się złożone zamówienia.'}
              </p>
            </div>
          ))}
      </div>
    </section>
  )
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { data: user } = useSession()
  const queryClient = useQueryClient()
  const location = useLocation()
  const detailKey = orderDetailKey(user?.id, id)
  const order = useQuery({
    queryKey: detailKey,
    queryFn: () => api.order(id),
    refetchInterval: 2000,
  })
  const delivery = useQuery({
    queryKey: deliveryWindowKey,
    queryFn: api.deliveryWindow,
    enabled: user?.role === 'customer',
    refetchInterval: 60_000,
  })
  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
      void queryClient.invalidateQueries({ queryKey: ordersKey })
    },
  })
  if (order.isPending) return <Loading>Wczytywanie zamówienia…</Loading>
  if (order.isError)
    return (
      <>
        <Link className={styles.backLink} to="/orders">
          <Icon name="back" size={17} />
          Zamówienia
        </Link>
        <ErrorBox error={order.error} />
      </>
    )
  const data = order.data
  return (
    <section className={styles.section}>
      <Link className={styles.backLink} to="/orders">
        <Icon name="back" size={17} />
        Zamówienia
      </Link>
      {location.state?.placed && (
        <p className={styles.success} role="status">
          <Icon name="check" size={18} />
          Zamówienie zostało zapisane.
        </p>
      )}
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>SZCZEGÓŁY ZAMÓWIENIA</p>
          <h1>{orderCode(data.id)}</h1>
          <p className={styles.muted}>Złożone {dateLabel(data.created_at)}</p>
        </div>
        <StatusBadge status={data.status} />
      </div>
      {user?.role === 'customer' &&
        data.status !== 'cancelled' &&
        delivery.data &&
        data.delivery_date >= delivery.data.earliest_delivery_date && (
          <button
            className={styles.secondaryButton}
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Czy anulować to zamówienie?')) cancel.mutate()
            }}
          >
            Anuluj zamówienie
          </button>
        )}
      {cancel.error && <ErrorBox error={cancel.error} />}
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h2>Pozycje zamówienia</h2>
          <ul className={styles.detailItems}>
            {data.items.map((item) => (
              <li key={item.meal_id}>
                <div>
                  <strong>{item.meal_name}</strong>
                  <small>
                    {item.quantity} × {money(item.unit_price)}
                  </small>
                </div>
                <strong>{money(Number(item.unit_price) * item.quantity)}</strong>
              </li>
            ))}
          </ul>
          <div className={styles.cartTotal}>
            <span>Razem</span>
            <strong>{money(data.total)}</strong>
          </div>
        </div>
        <div className={styles.detailCard}>
          <h2>Dostawa</h2>
          <dl className={styles.detailList}>
            <div>
              <dt>
                <Icon name="calendar" size={16} />
                Termin
              </dt>
              <dd>{dateLabel(data.delivery_date)}</dd>
            </div>
            <div>
              <dt>
                <Icon name="location" size={16} />
                Adres
              </dt>
              <dd>{data.delivery_address}</dd>
            </div>
            <div>
              <dt>
                <Icon name="user" size={16} />
                Kontakt
              </dt>
              <dd>
                {data.customer_name || data.customer_email}
                <br />
                {data.contact_phone}
              </dd>
            </div>
            {data.note && (
              <div>
                <dt>Uwagi</dt>
                <dd>{data.note}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  )
}
