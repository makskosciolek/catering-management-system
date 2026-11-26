import { expect, test } from '@playwright/test'

const orders = '/api/orders/v1/auth'
const fulfillment = '/api/fulfillment/v1'

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
    const csrf = await request.get(orders + '/csrf/')
    const login = await request.post(orders + '/login/', {
      headers: { 'X-CSRFToken': (await csrf.json()).csrfToken },
      data: { email: account + '@smakbox.example', password: 'SmakBox-demo-2026!' },
    })
    expect(login.ok()).toBeTruthy()
    const current = await request.get(fulfillment + '/session/')
    if (role === 'warehouse') {
      expect(current.status()).toBe(403)
    } else {
      expect(current.ok()).toBeTruthy()
      expect(await current.json()).toMatchObject({ role, id: expect.any(String) })
    }
  }
})
