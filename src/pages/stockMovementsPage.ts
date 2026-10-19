import type { PageDefinition } from '../types'

export const stockMovementsPage: Pick<PageDefinition, 'id' | 'label' | 'icon'> = {
  id: 'stock-movements',
  label: 'Movements',
  icon: 'Activity',
}
