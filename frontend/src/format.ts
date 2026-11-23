import type { Unit } from './api/inventory-client'

const moneyFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const stockFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 3 })
const unitLabel: Record<Unit, string> = { kg: 'kg', l: 'l', pcs: 'szt.' }
const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeZone: 'Europe/Warsaw',
})

export const money = (value: string | number) => moneyFormat.format(Number(value))
export const dateLabel = (value: string) =>
  dateFormat.format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value))
export const orderCode = (id: string) => 'CH-' + id.slice(0, 8).toUpperCase()
export const stockQuantity = (quantity: string, unit: Unit) =>
  stockFormat.format(Number(quantity)) + '\u00a0' + unitLabel[unit]
