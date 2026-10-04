import type { Language, OrderClientStatus, Role } from './enums.js'

export interface ProfileDto {
  id: string
  email: string
  displayName: string
  role: Role
  preferredLanguage: Language
}

export interface CompanyDto {
  id: string
  name: string
  slug: string
}

export interface OrderListItemDto {
  id: string
  title: string
  clientStatus: OrderClientStatus
  dueDate: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  perPage: number
  total: number
  totalPages: number
}
