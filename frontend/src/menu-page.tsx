import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type Meal } from './api/client'
import { money } from './format'
import { ErrorBox, Icon, Loading } from './ui'
import styles from './app.module.css'

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

export function MenuPage() {
  const menu = useQuery({ queryKey: ['menu'], queryFn: api.menu })
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
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroLabel}>
            <span />
            KUCHNIA SMAKBOX
          </span>
          <h1>Menu SmakBox</h1>
          <p>Sprawdź dostępne dania, ceny i alergeny.</p>
        </div>
        <PlateArt />
      </section>
      <div className={styles.section}>
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
                  <MealCard key={meal.id} meal={meal} />
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
      </div>
    </>
  )
}

function MealCard({ meal }: { meal: Meal }) {
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
        </div>
      </div>
    </article>
  )
}
