import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router'
import { api, menuKey, type User } from './api/client'
import {
  ingredientListQuery,
  inventoryApi,
  inventoryKeys,
  inventoryRefreshInterval,
  type Ingredient,
  type QuantityLine,
  type QuantityLineInput,
  type ReceiptInput,
  type Recipe,
  type Unit,
} from './api/inventory-client'
import { ApiError } from './api/transport'
import { dateLabel, stockQuantity, unitLabel } from './format'
import { canEditWarehouse } from './session'
import { ErrorBox, Icon, Loading, PageControls } from './ui'
import styles from './app.module.css'
import warehouse from './warehouse.module.css'

type DraftLine = QuantityLineInput & { key: string }

const blankLine = (): DraftLine => ({ key: crypto.randomUUID(), ingredient_id: '', quantity: '' })
const draftLines = (lines: QuantityLineInput[] = []): DraftLine[] =>
  lines.length ? lines.map((line) => ({ ...line, key: line.ingredient_id })) : [blankLine()]
const quantities = (lines: DraftLine[]): QuantityLineInput[] =>
  lines.map(({ ingredient_id, quantity }) => ({ ingredient_id, quantity }))

export function IngredientForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (form: FormData) =>
      inventoryApi.createIngredient({
        name: String(form.get('name')).trim(),
        unit: String(form.get('unit')) as Unit,
        minimum: String(form.get('minimum')),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.ingredients(userId) }),
  })

  return (
    <details className={warehouse.disclosure}>
      <summary>Dodaj składnik</summary>
      <form
        className={warehouse.form}
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          save.mutate(new FormData(form), { onSuccess: () => form.reset() })
        }}
      >
        <fieldset
          className={`${styles.form} ${warehouse.ingredientFields}`}
          disabled={save.isPending}
        >
          <label>
            Nazwa składnika
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Jednostka
            <select name="unit">
              {Object.entries(unitLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minimum
            <input
              name="minimum"
              type="number"
              min="0"
              max="999999999.999"
              step="0.001"
              defaultValue="0"
              required
            />
          </label>
        </fieldset>
        <button type="submit" className={styles.secondaryButton} disabled={save.isPending}>
          {save.isPending ? 'Zapisywanie…' : 'Zapisz składnik'}
        </button>
        {save.isError && <ErrorBox error={save.error} />}
        {save.isSuccess && (
          <p className={styles.success} role="status">
            Składnik zapisany.
          </p>
        )}
      </form>
    </details>
  )
}

export function QuantityList({ lines }: { lines: QuantityLine[] }) {
  return (
    <ul className={warehouse.quantityList}>
      {lines.map((line) => (
        <li key={line.ingredient_id}>
          <span>{line.name}</span>
          <strong>{stockQuantity(line.quantity, line.unit)}</strong>
        </li>
      ))}
    </ul>
  )
}

function LineFields({
  ingredients,
  lines,
  onChange,
  label,
}: {
  ingredients: Ingredient[]
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
  label: string
}) {
  const update = (key: string, patch: Partial<QuantityLineInput>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  return (
    <fieldset className={warehouse.lineFields}>
      <legend>{label}</legend>
      {lines.map((line, index) => {
        const ingredient = ingredients.find((item) => item.id === line.ingredient_id)
        return (
          <div key={line.key} className={warehouse.lineRow}>
            <label>
              Składnik {index + 1}
              <select
                value={line.ingredient_id}
                title={ingredient?.name}
                onChange={(event) => update(line.key, { ingredient_id: event.target.value })}
                required
              >
                <option value="">Wybierz składnik</option>
                {ingredients.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    disabled={lines.some(
                      (other) => other.key !== line.key && other.ingredient_id === item.id,
                    )}
                  >
                    {item.name} ({unitLabel[item.unit]})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ilość {index + 1}
              {ingredient && ' (' + unitLabel[ingredient.unit] + ')'}
              <input
                type="number"
                min="0.001"
                max="999999999.999"
                step="0.001"
                value={line.quantity}
                onChange={(event) => update(line.key, { quantity: event.target.value })}
                required
              />
            </label>
            {lines.length > 1 && (
              <button
                type="button"
                className={styles.iconButton}
                aria-label={'Usuń pozycję ' + (index + 1)}
                onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
              >
                <Icon name="minus" size={16} />
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        className={styles.smallButton}
        onClick={() => onChange([...lines, blankLine()])}
        disabled={lines.length >= Math.min(ingredients.length, 50)}
      >
        <Icon name="plus" size={15} /> Dodaj pozycję
      </button>
    </fieldset>
  )
}

function loadPendingReceipt(storageKey: string): ReceiptInput | null {
  try {
    const saved: ReceiptInput | null = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    return saved?.id && Array.isArray(saved.lines) ? saved : null
  } catch {
    return null
  }
}

function ReceiptForm({ userId, onSaved }: { userId: string; onSaved: () => Promise<void> }) {
  const storageKey = 'cateringhub:receipt:' + userId
  const [pending, setPending] = useState(() => loadPendingReceipt(storageKey))
  const [receiptId, setReceiptId] = useState(() => pending?.id ?? crypto.randomUUID())
  const [supplier, setSupplier] = useState(() => pending?.supplier ?? '')
  const [lines, setLines] = useState(() => draftLines(pending?.lines))
  const ingredients = useQuery(ingredientListQuery(userId))
  function clearPending() {
    sessionStorage.removeItem(storageKey)
    setPending(null)
    setReceiptId(crypto.randomUUID())
  }
  const save = useMutation({
    mutationFn: inventoryApi.createReceipt,
    onSuccess: async () => {
      clearPending()
      setSupplier('')
      setLines([blankLine()])
      await onSaved()
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 400 || error.status === 409))
        clearPending()
    },
  })

  return (
    <section className={styles.orderPanel} aria-labelledby="receipt-form-heading">
      <div className={warehouse.panelHeader}>
        <h2 id="receipt-form-heading">Nowe przyjęcie</h2>
      </div>
      {ingredients.isPending && <Loading>Wczytywanie składników…</Loading>}
      {ingredients.isError && (
        <ErrorBox error={ingredients.error} onRetry={() => void ingredients.refetch()} />
      )}
      {ingredients.isSuccess &&
        (ingredients.data.length ? (
          <form
            className={`${warehouse.panelBody} ${warehouse.form}`}
            onSubmit={(event) => {
              event.preventDefault()
              const receipt = pending ?? {
                id: receiptId,
                supplier: supplier.trim(),
                lines: quantities(lines),
              }
              sessionStorage.setItem(storageKey, JSON.stringify(receipt))
              setPending(receipt)
              save.mutate(receipt)
            }}
          >
            <fieldset
              className={`${styles.form} ${warehouse.fields}`}
              disabled={Boolean(pending) || save.isPending}
            >
              <label>
                Dostawca
                <input
                  value={supplier}
                  onChange={(event) => setSupplier(event.target.value)}
                  maxLength={150}
                  required
                />
              </label>
              <LineFields
                ingredients={ingredients.data}
                lines={lines}
                onChange={setLines}
                label="Składniki w dostawie"
              />
            </fieldset>
            {pending && !save.isPending && (
              <p className={styles.muted}>
                Ponów zapis z tymi samymi danymi, aby potwierdzić przyjęcie.
              </p>
            )}
            <button type="submit" className={styles.primaryButton} disabled={save.isPending}>
              {save.isPending
                ? 'Zapisywanie…'
                : pending
                  ? 'Ponów zapis przyjęcia'
                  : 'Zapisz przyjęcie'}
            </button>
            {save.isError && <ErrorBox error={save.error} />}
            {save.isSuccess && (
              <p className={styles.success} role="status">
                Przyjęcie zapisane.
              </p>
            )}
          </form>
        ) : (
          <div className={warehouse.panelBody}>
            <Link to="/warehouse">Dodaj składniki w widoku stanów.</Link>
          </div>
        ))}
    </section>
  )
}

export function WarehouseReceipts() {
  const user = useOutletContext<User>()
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const historyKey = inventoryKeys.receipts(user.id)
  const receipts = useQuery({
    queryKey: [...historyKey, page],
    queryFn: () => inventoryApi.receipts(page),
    refetchInterval: inventoryRefreshInterval,
  })
  if (receipts.error instanceof ApiError && receipts.error.status === 403) {
    return <ErrorBox error={receipts.error} />
  }

  return (
    <div className={canEditWarehouse(user) ? warehouse.workGrid : undefined}>
      {canEditWarehouse(user) && (
        <ReceiptForm
          userId={user.id}
          onSaved={async () => {
            setPage(1)
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: historyKey }),
              queryClient.invalidateQueries({ queryKey: inventoryKeys.ingredients(user.id) }),
            ])
          }}
        />
      )}
      <section className={styles.orderPanel} aria-labelledby="receipt-history-heading">
        <div className={warehouse.panelHeader}>
          <h2 id="receipt-history-heading">Historia przyjęć</h2>
        </div>
        {receipts.isPending && <Loading>Wczytywanie przyjęć…</Loading>}
        {receipts.isError && (
          <ErrorBox error={receipts.error} onRetry={() => void receipts.refetch()} />
        )}
        {receipts.isSuccess &&
          (receipts.data.results.length ? (
            <>
              <ul className={warehouse.records} aria-label="Przyjęcia">
                {receipts.data.results.map((receipt) => (
                  <li key={receipt.id} className={warehouse.record}>
                    <div className={warehouse.recordHeading}>
                      <strong>{receipt.supplier}</strong>
                      <small>{dateLabel(receipt.received_at)}</small>
                    </div>
                    <QuantityList lines={receipt.lines} />
                  </li>
                ))}
              </ul>
              <PageControls
                page={page}
                data={receipts.data}
                label="w historii"
                onChange={setPage}
              />
            </>
          ) : (
            <p className={styles.empty}>Nie zarejestrowano żadnego przyjęcia.</p>
          ))}
      </section>
    </div>
  )
}

export function WarehouseRecipes() {
  const user = useOutletContext<User>()
  const location = useLocation()
  const [mealId, setMealId] = useState<string>(() =>
    typeof location.state?.mealId === 'string' ? location.state.mealId : '',
  )
  const menu = useQuery({ queryKey: menuKey, queryFn: api.menu })
  const meals = menu.data ?? []

  return (
    <section
      className={`${styles.orderPanel} ${warehouse.recipePanel}`}
      aria-labelledby="recipe-heading"
    >
      <div className={warehouse.panelHeader}>
        <div>
          <h2 id="recipe-heading">Receptury dań</h2>
          <p>Ilości dotyczą jednej porcji.</p>
        </div>
      </div>
      <div className={warehouse.panelBody}>
        {menu.isPending && <Loading>Wczytywanie menu…</Loading>}
        {menu.isError && <ErrorBox error={menu.error} onRetry={() => void menu.refetch()} />}
        {menu.isSuccess && !meals.length && !mealId && (
          <p className={styles.muted}>W menu nie ma aktywnych dań.</p>
        )}
        {(meals.length > 0 || mealId) && (
          <div className={`${styles.form} ${warehouse.fields}`}>
            <label>
              Danie
              <select value={mealId} onChange={(event) => setMealId(event.target.value)}>
                <option value="">Wybierz danie z menu</option>
                {mealId && !meals.some((meal) => meal.id === mealId) && (
                  <option value={mealId}>Danie spoza menu ({mealId})</option>
                )}
                {meals.map((meal) => (
                  <option key={meal.id} value={meal.id}>
                    {meal.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {mealId && <RecipeDetails key={mealId} mealId={mealId} user={user} />}
      </div>
    </section>
  )
}

function RecipeDetails({ mealId, user }: { mealId: string; user: User }) {
  const recipe = useQuery({
    queryKey: inventoryKeys.recipe(user.id, mealId),
    queryFn: () => inventoryApi.recipe(mealId),
    refetchInterval: inventoryRefreshInterval,
  })
  if (recipe.isPending) return <Loading>Wczytywanie receptury…</Loading>
  if (recipe.isError) return <ErrorBox error={recipe.error} onRetry={() => void recipe.refetch()} />
  if (canEditWarehouse(user))
    return <RecipeForm mealId={mealId} recipe={recipe.data} userId={user.id} />
  return recipe.data ? (
    <QuantityList lines={recipe.data.lines} />
  ) : (
    <p className={styles.muted}>To danie nie ma jeszcze receptury.</p>
  )
}

function RecipeForm({
  mealId,
  recipe,
  userId,
}: {
  mealId: string
  recipe: Recipe | null
  userId: string
}) {
  const [lines, setLines] = useState(() => draftLines(recipe?.lines))
  const queryClient = useQueryClient()
  const ingredients = useQuery(ingredientListQuery(userId))
  const save = useMutation({
    mutationFn: () => inventoryApi.saveRecipe(mealId, quantities(lines)),
    onSuccess: (saved) => {
      queryClient.setQueryData(inventoryKeys.recipe(userId, mealId), saved)
      setLines(draftLines(saved.lines))
    },
  })
  if (ingredients.isPending) return <Loading>Wczytywanie składników…</Loading>
  if (ingredients.isError)
    return <ErrorBox error={ingredients.error} onRetry={() => void ingredients.refetch()} />
  if (!ingredients.data.length) return <Link to="/warehouse">Dodaj składniki w widoku stanów.</Link>

  return (
    <form
      className={warehouse.form}
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <fieldset className={`${styles.form} ${warehouse.fields}`} disabled={save.isPending}>
        <LineFields
          ingredients={ingredients.data}
          lines={lines}
          onChange={setLines}
          label="Składniki na porcję"
        />
      </fieldset>
      <button type="submit" className={styles.primaryButton} disabled={save.isPending}>
        {save.isPending ? 'Zapisywanie…' : 'Zapisz recepturę'}
      </button>
      {save.isError && <ErrorBox error={save.error} />}
      {save.isSuccess && (
        <p className={styles.success} role="status">
          Receptura zapisana.
        </p>
      )}
    </form>
  )
}
