import { expect, test, type APIRequestContext } from '@playwright/test'
import type { Meal, Order } from '../src/api/client'
import type { Ingredient, Reservation } from '../src/api/inventory-client'

const orders = '/api/orders/v1'
const fulfillment = '/api/fulfillment/v1'
const inventory = '/api/inventory/v1'

async function csrfHeaders(request: APIRequestContext) {
  const { csrfToken } = await (await request.get(orders + '/auth/csrf/')).json()
  return { 'X-CSRFToken': csrfToken }
}

async function signIn(request: APIRequestContext, email: string, password = 'SmakBox-demo-2026!') {
  const login = await request.post(orders + '/auth/login/', {
    headers: await csrfHeaders(request),
    data: { email, password },
  })
  expect(login.ok()).toBeTruthy()
}

test('Realizacja sprawdza aktualną sesję z Zamówień', async ({ request }) => {
  const health = await request.get(fulfillment + '/health/')
  expect(await health.json()).toEqual({ status: 'ok', service: 'fulfillment' })
  const anonymous = await request.get(fulfillment + '/session/')
  expect(anonymous.status()).toBe(401)

  for (const [account, role] of [
    ['kuchnia', 'kitchen'],
    ['kierowca', 'driver'],
    ['magazyn', 'warehouse'],
  ]) {
    await signIn(request, account + '@smakbox.example')
    const current = await request.get(fulfillment + '/session/')
    if (role === 'warehouse') {
      expect(current.status()).toBe(403)
    } else {
      expect(current.ok()).toBeTruthy()
      expect(await current.json()).toMatchObject({ role, id: expect.any(String) })
    }
  }
})

test('rezerwacja trafia do kuchni, a przygotowanie rozlicza składniki', async ({
  page,
  playwright,
  baseURL,
}) => {
  const kitchen = await playwright.request.newContext({ baseURL })
  const warehouse = await playwright.request.newContext({ baseURL })
  try {
    const email = 'kitchen-flow-' + Date.now() + '@example.com'
    const password = 'Browser-check-2026!'
    const registration = await page.request.post(orders + '/auth/register/', {
      headers: await csrfHeaders(page.request),
      data: { email, password, first_name: 'Ewa', last_name: 'Testowa' },
    })
    expect(registration.status()).toBe(201)
    await signIn(page.request, email, password)
    await signIn(kitchen, 'kuchnia@smakbox.example')
    await signIn(warehouse, 'magazyn@smakbox.example')
    const menu: Meal[] = await (await page.request.get(orders + '/menu/')).json()
    const meal = menu.find(({ name }) => name === 'Kurczak z pieca')!
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(
      new Date(Date.now() + 6 * 86_400_000),
    )
    const submission = await page.request.post(orders + '/orders/', {
      headers: await csrfHeaders(page.request),
      data: {
        delivery_date: day,
        delivery_address: 'ul. Testowa 23, Kraków',
        contact_phone: '500600700',
        items: [{ meal_id: meal.id, quantity: 1 }],
      },
    })
    expect(submission.status()).toBe(201)
    const order: Order = await submission.json()
    const production = fulfillment + '/production/'
    const dateFilter = '?delivery_date=' + day
    const readProduction = async () =>
      (await (await kitchen.get(production + dateFilter)).json()).results
    await expect
      .poll(readProduction, { timeout: 15_000 })
      .toEqual([expect.objectContaining({ order_id: order.id, status: 'ready' })])
    expect(await (await kitchen.get(production + 'summary/' + dateFilter)).json()).toEqual([
      { meal_id: meal.id, meal_name: meal.name, quantity: 1 },
    ])

    const reservationPath = inventory + '/reservations/' + order.id + '/'
    const readReservation = async (): Promise<Reservation> =>
      (await warehouse.get(reservationPath)).json()
    const reservation = await readReservation()
    expect(reservation.status).toBe('reserved')
    const line = reservation.lines[0]
    const readStock = async () => {
      const stock: Ingredient[] = await (await warehouse.get(inventory + '/ingredients/')).json()
      return Number(stock.find(({ id }) => id === line.ingredient_id)?.on_hand)
    }
    const stockBefore = await readStock()

    await page.goto('/orders/' + order.id)
    const cancel = page.getByRole('button', { name: 'Anuluj zamówienie' })
    await expect(cancel).toBeVisible()

    const action = async (name: string) =>
      kitchen.post(production + order.id + '/' + name + '/', {
        headers: await csrfHeaders(kitchen),
      })
    expect((await action('start')).status()).toBe(202)
    expect((await action('start')).status()).toBe(202)
    await expect(page.getByText('W przygotowaniu', { exact: true })).toBeVisible()
    await expect(cancel).toHaveCount(0)
    const lateCancel = await page.request.post(orders + '/orders/' + order.id + '/cancel/', {
      headers: await csrfHeaders(page.request),
    })
    expect(lateCancel.status()).toBe(409)

    await expect.poll(readProduction).toEqual([expect.objectContaining({ status: 'preparing' })])
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await (await action('prepare')).json()).toMatchObject({ status: 'prepared' })
    }
    await expect(page.getByText('Przygotowane', { exact: true })).toBeVisible()
    await expect.poll(async () => (await readReservation()).status).toBe('consumed')
    expect(await readStock()).toBeCloseTo(stockBefore - Number(line.quantity), 3)

    expect(await (await action('pack')).json()).toMatchObject({ status: 'packed' })
    await expect(page.getByText('Spakowane', { exact: true })).toBeVisible()
  } finally {
    await Promise.all([kitchen.dispose(), warehouse.dispose()])
  }
})
