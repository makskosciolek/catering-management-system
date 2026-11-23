import { expect, test, type Page } from '@playwright/test'
import type { Ingredient, Reservation } from '../src/api/inventory-client'

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
