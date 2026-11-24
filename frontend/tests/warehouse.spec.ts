import { expect, test, type Page } from '@playwright/test'
import type { Ingredient, ReceiptInput, Recipe, Reservation } from '../src/api/inventory-client'
import type { Order } from '../src/api/client'
import { orderCode } from '../src/format'

async function logIn(page: Page, account: string) {
  await page.getByRole('button', { name: account, exact: true }).click()
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
}

const lowIngredient: Ingredient = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Mąka pełnoziarnista z ekologicznej uprawy na potrzeby kuchni pilotażowej',
  unit: 'kg',
  on_hand: '12.875',
  reserved: '11.250',
  available: '1.625',
  minimum: '2.000',
  below_minimum: true,
}

const quantity = {
  ingredient_id: lowIngredient.id,
  name: lowIngredient.name,
  unit: lowIngredient.unit,
  quantity: '11.250',
}

const reservation: Reservation = {
  order_id: 'a1000000-0000-4000-8000-000000000001',
  delivery_date: '2026-11-25',
  status: 'reserved',
  attempt: 1,
  updated_at: '2026-11-23T17:00:00Z',
  shortages: [],
  missing_recipes: [],
  lines: [quantity],
}

test('magazynier widzi zapas i wszystkie wyniki rezerwacji', async ({ page }, info) => {
  const shortage: Reservation = {
    ...reservation,
    order_id: 'a2000000-0000-4000-8000-000000000002',
    status: 'shortage',
    shortages: [{ ...quantity, needed: '2.125', available: '1.625', missing: '0.500' }],
    missing_recipes: ['00000000-0000-4000-8000-000000000003'],
    lines: [],
  }
  const rows: Reservation[] = [
    reservation,
    shortage,
    { ...reservation, status: 'cancelled', order_id: 'a3000000-0000-4000-8000-000000000003' },
    { ...reservation, status: 'consumed', order_id: 'a4000000-0000-4000-8000-000000000004' },
  ]
  await page.route('**/api/inventory/v1/ingredients/', (route) =>
    route.fulfill({
      json: [
        lowIngredient,
        {
          ...lowIngredient,
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Sól',
          below_minimum: false,
        },
      ],
    }),
  )
  await page.route('**/api/inventory/v1/reservations/?*', (route) => {
    const first = new URL(route.request().url()).searchParams.get('page') === '1'
    return route.fulfill({
      json: {
        count: 5,
        previous: first ? null : '?page=1',
        next: first ? '?page=2' : null,
        results: first
          ? rows
          : [{ ...reservation, order_id: 'a5000000-0000-4000-8000-000000000005' }],
      },
    })
  })
  await page.goto('/login')
  await logIn(page, 'Dane magazyniera')
  await expect(page).toHaveURL(/\/warehouse$/)
  const table = page.getByRole('table', { name: 'Stany składników' })
  await expect(table.getByText('1,625\u00a0kg').first()).toBeVisible()
  const filter = page.getByRole('checkbox', { name: 'Tylko poniżej minimum' })
  await filter.focus()
  await filter.press('Space')
  await expect(filter).toBeChecked()
  await expect(table.getByText('Sól')).toHaveCount(0)

  const reservations = page.getByRole('list', { name: 'Rezerwacje' })
  await expect(reservations.getByText('Zarezerwowano', { exact: true })).toBeVisible()
  await expect(reservations.getByText('Brak zapasu lub receptury')).toBeVisible()
  await expect(reservations.getByText('0,5\u00a0kg')).toBeVisible()
  await expect(reservations.getByText(/Brak receptury dla dania/)).toBeVisible()
  await expect(reservations.getByText('Anulowano', { exact: true })).toBeVisible()
  await expect(reservations.getByText('Zużyto składniki', { exact: true })).toBeVisible()
  await expect(reservations.getByRole('link', { name: /^CH-/ })).toHaveCount(0)
  const cancelled = reservations.getByRole('listitem').filter({ hasText: 'CH-A3000000' })
  await cancelled.getByText('Zwolnione ilości', { exact: true }).click()
  await expect(cancelled.getByText('11,25\u00a0kg', { exact: true })).toBeVisible()

  for (const width of [390, 1280, 1920]) {
    await page.setViewportSize({ width, height: 960 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
    await page.screenshot({ path: info.outputPath('warehouse-' + width + '.png'), fullPage: true })
  }
  const chrome = await page.context().newCDPSession(page)
  await chrome.send('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 864,
    deviceScaleFactor: 1.25,
    mobile: false,
  })
  await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(1.25)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(1536)

  await page.getByRole('button', { name: 'Następna' }).click()
  await expect(reservations.getByText('CH-A5000000')).toBeVisible()
  await page.getByRole('button', { name: 'Poprzednia' }).click()
  await expect(reservations.getByText('CH-A1000000')).toBeVisible()
  await page.goto('/orders')
  await expect(page).toHaveURL(/\/warehouse$/)
})

test('menedżer otwiera zamówienie z magazynu, a klient nie ma dostępu do panelu', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/warehouse')
  await expect(page).toHaveURL(/\/login$/)
  await logIn(page, 'Dane klienta')
  await expect(page).toHaveURL(/\/menu$/)
  await expect(page.getByRole('link', { name: 'Magazyn' })).toHaveCount(0)
  const protectedRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/inventory/')) protectedRequests.push(request.url())
  })
  await page.goto('/warehouse')
  await expect(page).toHaveURL(/\/menu$/)
  expect(protectedRequests).toEqual([])

  const context = await browser.newContext({ baseURL })
  try {
    const manager = await context.newPage()
    await manager.goto('/login')
    await logIn(manager, 'Dane menedżera')
    await manager.getByRole('link', { name: 'Magazyn' }).click()
    await expect(manager.getByRole('table', { name: 'Stany składników' })).toBeVisible()
    const orderLink = manager
      .getByRole('list', { name: 'Rezerwacje' })
      .getByRole('link', { name: /^CH-/ })
      .first()
    const orderCode = await orderLink.innerText()
    await orderLink.click()
    await expect(manager.getByRole('heading', { name: orderCode })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('magazyn odróżnia ładowanie, pustą listę i utratę dostępu', async ({ page }) => {
  await page.route('**/api/orders/v1/auth/me/', (route) =>
    route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000012',
        email: 'magazyn@smakbox.example',
        first_name: 'Ewa',
        last_name: 'Lis',
        phone: '',
        role: 'warehouse',
      },
    }),
  )
  let stockStatus = 503
  await page.route('**/api/inventory/v1/ingredients/', (route) =>
    route.fulfill({
      status: stockStatus,
      json: stockStatus === 200 ? [lowIngredient] : { detail: 'Brak dostępu do magazynu.' },
    }),
  )
  let releaseReservations!: () => void
  const reservationsReady = new Promise<void>((resolve) => {
    releaseReservations = resolve
  })
  await page.route('**/api/inventory/v1/reservations/?*', async (route) => {
    await reservationsReady
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
  })
  await page.goto('/warehouse')
  await expect(page.getByText('Wczytywanie rezerwacji…')).toBeVisible()
  await expect(
    page.getByText('Aplikacja jest chwilowo niedostępna. Spróbuj ponownie.'),
  ).toBeVisible()
  releaseReservations()
  await expect(page.getByText('Rezerwacje pojawią się po złożeniu zamówień.')).toBeVisible()

  stockStatus = 200
  await page.getByRole('button', { name: 'Ponów', exact: true }).click()
  await expect(page.getByText(lowIngredient.name)).toBeVisible()
  stockStatus = 403
  await expect(page.getByText('Brak dostępu do magazynu.')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(lowIngredient.name)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Rezerwacje zamówień' })).toHaveCount(0)
})

async function addIngredient(page: Page, name: string) {
  await page.getByText('Dodaj składnik', { exact: true }).click()
  await page.getByLabel('Nazwa składnika').fill(name)
  await page.getByLabel('Minimum', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Zapisz składnik' }).click()
  await expect(page.getByText('Składnik zapisany.')).toBeVisible()
}

async function fillReceipt(page: Page, supplier: string, ingredient: string, quantity: string) {
  await page.getByLabel('Dostawca').fill(supplier)
  await page
    .getByRole('combobox', { name: 'Składnik 1' })
    .selectOption({ label: ingredient + ' (kg)' })
  await page.getByLabel(/^Ilość 1/).fill(quantity)
}

async function csrfHeaders(page: Page) {
  const { csrfToken } = await (await page.request.get('/api/orders/v1/auth/csrf/')).json()
  return { 'X-CSRFToken': csrfToken }
}

test('ponowienie przyjęcia po utracie odpowiedzi nalicza dostawę raz', async ({ page }, info) => {
  const ingredient = 'Mąka do testu przyjęcia ' + Date.now()
  const supplier = 'Dostawca testowy ' + Date.now()
  await page.goto('/login')
  await logIn(page, 'Dane magazyniera')
  await addIngredient(page, ingredient)
  await page.getByRole('link', { name: 'Zarejestruj przyjęcie' }).click()
  await fillReceipt(page, supplier, ingredient, '2.5')
  const form = page.getByRole('region', { name: 'Nowe przyjęcie' })
  for (const width of [390, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(form.getByLabel('Dostawca')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
    await page.screenshot({
      path: info.outputPath('receipt-form-' + width + '.png'),
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 1536, height: 864 })
  const chrome = await page.context().newCDPSession(page)
  await chrome.send('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 864,
    deviceScaleFactor: 1.25,
    mobile: false,
  })
  await expect
    .poll(() => page.evaluate(() => [window.innerWidth, window.devicePixelRatio]))
    .toEqual([1536, 1.25])
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(1536)
  await page.screenshot({ path: info.outputPath('receipt-form-125-percent.png') })
  await chrome.send('Emulation.clearDeviceMetricsOverride')

  const requests: { data: ReceiptInput; status: number }[] = []
  await page.route('**/api/inventory/v1/receipts/', async (route) => {
    const response = await route.fetch()
    requests.push({ data: route.request().postDataJSON(), status: response.status() })
    if (requests.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })

  await page.getByRole('button', { name: 'Zapisz przyjęcie' }).click()
  await expect(page.getByRole('alert')).toContainText('Nie udało się połączyć')
  await page.reload()
  await expect(page.getByLabel('Dostawca')).toHaveValue(supplier)
  await expect(page.getByLabel('Dostawca')).toBeDisabled()
  await page.getByRole('button', { name: 'Ponów zapis przyjęcia' }).click()
  await expect(page.getByText('Przyjęcie zapisane.')).toBeVisible()
  expect(requests.map(({ status }) => status)).toEqual([201, 200])
  expect(requests[1].data).toEqual(requests[0].data)

  const history = page
    .getByRole('list', { name: 'Przyjęcia' })
    .getByRole('listitem')
    .filter({ hasText: supplier })
  await expect(history).toHaveCount(1)
  await expect(history).toContainText(ingredient)
  await page.getByRole('link', { name: 'Stan i rezerwacje' }).click()
  const row = page.getByRole('row').filter({ hasText: ingredient })
  await expect(row.getByRole('cell').nth(1)).toHaveText('2,5\u00a0kg')
  await expect(row.getByRole('cell').nth(3)).toHaveText('2,5\u00a0kg')
  await page.getByRole('checkbox', { name: 'Tylko poniżej minimum' }).check()
  await expect(row).toHaveCount(0)
})

test('receptura, przyjęcie i ponowienie zmieniają status zamówienia', async ({
  page,
  browser,
  baseURL,
}, info) => {
  const ingredient = 'Składnik receptury ' + Date.now()
  await page.goto('/login')
  await logIn(page, 'Dane magazyniera')
  await addIngredient(page, ingredient)
  await page.getByRole('link', { name: 'Receptury', exact: true }).click()
  const picker = page.getByRole('combobox', { name: 'Danie', exact: true })
  const mealId = await picker.selectOption({ label: 'Krem z pomidorów' }).then(([id]) => id)
  const recipePath = '/api/inventory/v1/recipes/' + mealId + '/'
  const original = await page.request.get(recipePath)
  expect(original.ok()).toBeTruthy()
  const recipe: Recipe = await original.json()

  const customer = await browser.newContext({ baseURL })
  try {
    const additionalLine = page.getByRole('button', { name: 'Usuń pozycję 2' })
    await additionalLine.click()
    await page
      .getByRole('combobox', { name: 'Składnik 1' })
      .selectOption({ label: ingredient + ' (kg)' })
    await page.getByLabel(/^Ilość 1/).fill('0.5')
    await page.getByRole('button', { name: 'Zapisz recepturę' }).click()
    await expect(page.getByText('Receptura zapisana.')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 900 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390)
    await page.screenshot({ path: info.outputPath('recipe-form-390.png'), fullPage: true })

    const client = await customer.newPage()
    await client.goto('/login')
    await logIn(client, 'Dane klienta')
    await expect(client).toHaveURL(/\/menu$/)
    const { earliest_delivery_date: deliveryDate } = await (
      await client.request.get('/api/orders/v1/orders/delivery-window/')
    ).json()
    const submission = await client.request.post('/api/orders/v1/orders/', {
      headers: await csrfHeaders(client),
      data: {
        delivery_date: deliveryDate,
        delivery_address: 'ul. Testowa 11, Warszawa',
        contact_phone: '500600700',
        items: [{ meal_id: mealId, quantity: 2 }],
      },
    })
    expect(submission.status()).toBe(201)
    const order: Order = await submission.json()
    await client.goto('/orders/' + order.id)
    await expect(client.getByText('Brak składników lub receptury', { exact: true })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('link', { name: 'Stan i rezerwacje' }).click()
    const reservation = page
      .getByRole('list', { name: 'Rezerwacje' })
      .getByRole('listitem')
      .filter({ hasText: orderCode(order.id) })
      .first()
    await expect(reservation).toContainText(ingredient)
    await page.getByRole('link', { name: 'Przyjęcia', exact: true }).click()
    await fillReceipt(page, 'Dostawca składnika do receptury', ingredient, '1')
    await page.getByRole('button', { name: 'Zapisz przyjęcie' }).click()
    await expect(page.getByText('Przyjęcie zapisane.')).toBeVisible()
    await page.getByRole('link', { name: 'Stan i rezerwacje' }).click()
    await reservation.getByRole('button', { name: 'Ponów rezerwację' }).click()
    await expect(reservation.getByText('Zarezerwowano', { exact: true })).toBeVisible()
    await expect(client.getByText('Składniki zarezerwowane', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
  } finally {
    await customer.close()
    const restored = await page.request.put(recipePath, {
      headers: await csrfHeaders(page),
      data: {
        lines: recipe.lines.map(({ ingredient_id, quantity }) => ({ ingredient_id, quantity })),
      },
    })
    expect(restored.ok()).toBeTruthy()
  }
})

test('menedżer odczytuje przyjęcia i receptury, po wylogowaniu dane znikają', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, 'Dane menedżera')
  await page.getByRole('link', { name: 'Magazyn', exact: true }).click()
  await expect(page.getByText('Dodaj składnik', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Receptury', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Danie', exact: true })
    .selectOption({ label: 'Krem z pomidorów' })
  await expect(page.getByText('Pomidory', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zapisz recepturę' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Przyjęcia', exact: true }).click()
  const history = page.getByRole('list', { name: 'Przyjęcia' })
  await expect(history).toContainText('Dostawa startowa SmakBox')
  await expect(page.getByRole('region', { name: 'Nowe przyjęcie' })).toHaveCount(0)

  const logout = await page.request.post('/api/orders/v1/auth/logout/', {
    headers: await csrfHeaders(page),
  })
  expect(logout.ok()).toBeTruthy()
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 })
  await expect(history).toHaveCount(0)
})
