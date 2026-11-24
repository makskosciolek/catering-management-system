import type { components } from './inventory-schema'
import { ApiError, serviceApi } from './transport'

type Schema = components['schemas']
export type Ingredient = Schema['Ingredient']
export type Reservation = Schema['Reservation']
export type Unit = Schema['UnitEnum']
export type QuantityLine = Schema['QuantityLine']
export type QuantityLineInput = Schema['QuantityLineInput']
export type ReceiptInput = Schema['ReceiptInput']
export type Recipe = Schema['Recipe']

const { read, write } = serviceApi('/api/inventory/v1')
const inventoryKey = ['private', 'inventory'] as const
export const inventoryRefreshInterval = 5000
export const inventoryKeys = {
  ingredients: (userId: string) => [...inventoryKey, userId, 'ingredients'] as const,
  receipts: (userId: string) => [...inventoryKey, userId, 'receipts'] as const,
  reservations: (userId: string) => [...inventoryKey, userId, 'reservations'] as const,
  recipe: (userId: string, mealId: string) => [...inventoryKey, userId, 'recipe', mealId] as const,
}

export const inventoryApi = {
  ingredients: () => read<Ingredient[]>('/ingredients/'),
  createIngredient: (data: Pick<Ingredient, 'name' | 'unit' | 'minimum'>) =>
    write<Ingredient>('/ingredients/', data),
  receipts: (page: number) => read<Schema['PaginatedReceiptList']>('/receipts/?page=' + page),
  createReceipt: (data: ReceiptInput) => write<Schema['Receipt']>('/receipts/', data),
  recipe: async (mealId: string) => {
    try {
      return await read<Recipe>('/recipes/' + encodeURIComponent(mealId) + '/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
  saveRecipe: (mealId: string, lines: QuantityLineInput[]) =>
    write<Recipe>('/recipes/' + encodeURIComponent(mealId) + '/', { lines }, 'PUT'),
  reservations: (page: number) =>
    read<Schema['PaginatedReservationList']>('/reservations/?page=' + page),
  retryReservation: (orderId: string) =>
    write<Reservation>('/reservations/' + encodeURIComponent(orderId) + '/retry/'),
}

export const ingredientListQuery = (userId: string) => ({
  queryKey: inventoryKeys.ingredients(userId),
  queryFn: inventoryApi.ingredients,
  refetchInterval: inventoryRefreshInterval,
})
