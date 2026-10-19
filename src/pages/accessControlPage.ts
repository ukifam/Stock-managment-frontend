import type { PageDefinition } from '../types'

export const accessControlPage: Pick<PageDefinition, 'id' | 'label' | 'icon'> = {
  id: 'access-control',
  label: 'Roles & Permissions',
  icon: 'gear',
}
