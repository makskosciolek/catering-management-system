import type { components } from './inventory-schema'
import { serviceApi } from './transport'

type Schema = components['schemas']
export type Ingredient = Schema['Ingredient']
export type Reservation = Schema['Reservation']
export type Unit = Schema['UnitEnum']

const { read } = serviceApi('/api/inventory/v1')
export const inventoryKey = ['private', 'inventory'] as const

export const inventoryApi = {
  ingredients: () => read<Ingredient[]>('/ingredients/'),
  reservations: (page: number) =>
    read<Schema['PaginatedReservationList']>('/reservations/?page=' + page),
}
