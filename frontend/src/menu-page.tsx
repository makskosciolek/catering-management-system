import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { api, type Meal } from './api/client'
import { money, today } from './format'
import { useSession } from './session'
import { ErrorBox, Icon, Loading } from './ui'
import styles from './app.module.css'

export type Basket = Record<string, number>
type CartProps = {
  basket: Basket
  changeQuantity: (id: string, delta: number) => void
  clearBasket: () => void
}
const categories: Record<Meal['category'], string> = {
  main: 'Dania główne',
  soup: 'Zupy',
  salad: 'Sałatki',
}

function PlateArt() {
  return (
    <svg className={styles.plateArt} viewBox="0 0 380 218" aria-hidden="true" fill="none">
      <circle cx="202" cy="109" r="88" stroke="#a5c3a6" strokeOpacity=".26" />
      <circle cx="202" cy="109" r="69" stroke="#c5dbb9" strokeWidth="1.5" />
      <circle cx="202" cy="109" r="53" stroke="#c5dbb9" strokeOpacity=".5" />
      <path
        d="M171 137c14-4 22-13 24-31 3-19 12-28 30-34-3 14-5 24-12 32-7 9-16 12-24 14m11 2c12-4 22-1 29 7-14 10-25 8-35 4"
        stroke="#c5dbb9"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M106 62v27c0 7 4 11 10 11s10-4 10-11V62m-10 0v92m180-92c-10 12-13 23-13 38v6h13m0-44v92"
        stroke="#c5dbb9"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M53 146h19m-9-9v19m256-105h17m-9-9v18"
        stroke="#d9ae76"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="77" cy="62" r="3" fill="#d9ae76" />
      <circle cx="315" cy="167" r="4" fill="#d9ae76" />
    </svg>
  )
}

export function MenuPage(props: CartProps) {
  const location = useLocation()
  useEffect(() => {
    if (location.hash === '#basket') document.getElementById('basket')?.scrollIntoView()
  }, [location.hash, location.key])
  const menu = useQuery({ queryKey: ['menu'], queryFn: api.menu })
  const session = useSession()
  const [category, setCategory] = useState<Meal['category'] | 'all'>('all')
  const [search, setSearch] = useState('')
  const meals = menu.data ?? []
  const shown = meals.filter(
    (meal) =>
      (category === 'all' || meal.category === category) &&
      (meal.name + ' ' + meal.description)
        .toLocaleLowerCase('pl')
        .includes(search.trim().toLocaleLowerCase('pl')),
  )
  const canAdd = !session.data || session.data.role === 'customer'
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroLabel}>
            <span />
            KUCHNIA SMAKBOX
          </span>
          <h1>Menu SmakBox</h1>
          <p>Wybierz dania i liczbę porcji. Termin oraz adres podasz przy składaniu zamówienia.</p>
        </div>
        <PlateArt />
      </section>
      <div className={styles.menuLayout}>
        <section aria-labelledby="meal-list-heading">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>OFERTA KUCHNI</p>
              <h2 id="meal-list-heading">Dania do zamówienia</h2>
            </div>
            {menu.isSuccess && (
              <span className={styles.resultCount}>
                {shown.length} z {meals.length}
              </span>
            )}
          </div>
          <div className={styles.filters}>
            <div className={styles.chips} aria-label="Kategorie dań">
              <button
                aria-pressed={category === 'all'}
                type="button"
                onClick={() => setCategory('all')}
              >
                Wszystkie
              </button>
              {(Object.entries(categories) as [Meal['category'], string][]).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={category === value}
                    onClick={() => setCategory(value)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            <div className={styles.searchField}>
              <Icon name="search" size={17} />
              <input
                aria-label="Szukaj dania"
                type="search"
                placeholder="Szukaj dania"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          {menu.isPending && <Loading>Wczytywanie menu…</Loading>}
          {menu.isError && <ErrorBox error={menu.error} onRetry={() => void menu.refetch()} />}
          {menu.isSuccess &&
            (shown.length > 0 ? (
              <div className={styles.mealGrid}>
                {shown.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    quantity={props.basket[meal.id] ?? 0}
                    onAdd={canAdd ? () => props.changeQuantity(meal.id, 1) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <Icon name="search" />
                <h3>Brak pasujących dań</h3>
                <p>Zmień kategorię lub wpisz inną nazwę.</p>
              </div>
            ))}
        </section>
        <Cart meals={meals} {...props} />
      </div>
    </>
  )
}

function MealCard({ meal, quantity, onAdd }: { meal: Meal; quantity: number; onAdd?: () => void }) {
  return (
    <article className={styles.mealCard}>
      <div className={styles.mealAccent} data-category={meal.category}>
        <span className={styles.mealIcon}>
          <Icon name={meal.category} size={27} />
        </span>
        {meal.is_vegetarian && <span className={styles.vegetarian}>Wegetariańskie</span>}
      </div>
      <div className={styles.mealBody}>
        <p className={styles.mealCategory}>{categories[meal.category]}</p>
        <h3>{meal.name}</h3>
        <p>{meal.description}</p>
        {meal.allergens && <small>Alergeny: {meal.allergens}</small>}
        <div className={styles.mealBottom}>
          <strong>{money(meal.price)}</strong>
          {onAdd && (
            <button
              type="button"
              className={styles.addButton}
              aria-label={'Dodaj ' + meal.name}
              onClick={onAdd}
              disabled={quantity >= 1000}
            >
              <Icon name="plus" size={16} />
              {quantity ? 'Dodaj (' + quantity + ')' : 'Dodaj'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function Cart({ basket, changeQuantity, meals, clearBasket }: CartProps & { meals: Meal[] }) {
  const session = useSession()
  const user = session.data
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const selected = meals.filter((meal) => basket[meal.id] > 0)
  const quantity = selected.reduce((total, meal) => total + basket[meal.id], 0)
  const estimate =
    selected.reduce(
      (total, meal) => total + Math.round(Number(meal.price) * 100) * basket[meal.id],
      0,
    ) / 100
  const mutation = useMutation({
    mutationFn: api.submitOrder,
    onSuccess: (order) => {
      clearBasket()
      queryClient.setQueryData(['orders', 'detail', order.id], order)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void navigate('/orders/' + order.id, { state: { placed: true } })
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    mutation.mutate({
      delivery_date: String(data.get('date')),
      delivery_address: String(data.get('address')),
      contact_phone: String(data.get('phone')),
      note: String(data.get('note')),
      items: selected.map((meal) => ({ meal_id: meal.id, quantity: basket[meal.id] })),
    })
  }
  return (
    <aside id="basket" aria-labelledby="basket-heading" className={styles.cart}>
      <div className={styles.cartHeader}>
        <span className={styles.cartIcon}>
          <Icon name="bag" />
        </span>
        <div>
          <h2 id="basket-heading">Twój koszyk</h2>
          <p>Liczba porcji: {quantity}</p>
        </div>
      </div>
      {selected.length === 0 ? (
        <div className={styles.cartEmpty}>
          <Icon name="bag" size={26} />
          <strong>Koszyk jest pusty</strong>
          <p>Dodaj danie z menu, żeby rozpocząć zamówienie.</p>
        </div>
      ) : (
        <>
          <ul className={styles.cartList}>
            {selected.map((meal) => (
              <li key={meal.id}>
                <div>
                  <strong>{meal.name}</strong>
                  <small>{money(meal.price)} / porcja</small>
                </div>
                <div className={styles.stepper}>
                  <button
                    type="button"
                    onClick={() => changeQuantity(meal.id, -1)}
                    aria-label={'Odejmij porcję: ' + meal.name}
                  >
                    <Icon name="minus" size={14} />
                  </button>
                  <span>{basket[meal.id]}</span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(meal.id, 1)}
                    aria-label={'Dodaj porcję: ' + meal.name}
                    disabled={basket[meal.id] >= 1000}
                  >
                    <Icon name="plus" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.cartTotal}>
            <span>Razem</span>
            <strong>{money(estimate)}</strong>
          </div>
          {user?.role === 'customer' ? (
            <form className={styles.cartForm} onSubmit={submit}>
              <h3>Dane dostawy</h3>
              <label>
                Termin dostawy
                <input name="date" type="date" min={today()} required />
              </label>
              <label>
                Adres dostawy
                <input
                  name="address"
                  placeholder="Ulica, numer, miasto"
                  maxLength={300}
                  autoComplete="street-address"
                  required
                />
              </label>
              <label>
                Telefon kontaktowy
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={user.phone}
                  maxLength={30}
                  required
                />
              </label>
              <label>
                Uwagi <span className={styles.optional}>(opcjonalnie)</span>
                <textarea name="note" rows={2} maxLength={500} />
              </label>
              {mutation.error && <ErrorBox error={mutation.error} />}
              <button className={styles.primaryButton} disabled={mutation.isPending}>
                {mutation.isPending ? 'Zapisywanie…' : 'Złóż zamówienie'}{' '}
                <Icon name="arrow" size={17} />
              </button>
            </form>
          ) : (
            <div className={styles.cartForm}>
              {user ? (
                <p className={styles.muted}>Zamówienia są składane z konta klienta.</p>
              ) : (
                <Link className={styles.primaryButton} to="/login">
                  Zaloguj się, by zamówić
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
