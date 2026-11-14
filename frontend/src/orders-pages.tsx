import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { api } from './api/client'
import { dateLabel, money, orderCode } from './format'
import { ErrorBox, Icon, Loading, StatusBadge } from './ui'
import styles from './app.module.css'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const order = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => api.order(id),
    refetchInterval: 2000,
  })
  if (order.isPending) return <Loading>Wczytywanie zamówienia…</Loading>
  if (order.isError)
    return (
      <>
        <Link className={styles.backLink} to="/menu">
          <Icon name="back" size={17} />
          Menu
        </Link>
        <ErrorBox error={order.error} />
      </>
    )
  const data = order.data
  return (
    <section className={styles.section}>
      <Link className={styles.backLink} to="/menu">
        <Icon name="back" size={17} />
        Menu
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
