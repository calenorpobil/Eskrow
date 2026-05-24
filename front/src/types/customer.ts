export interface Customer {
  customerId: string;
  companyName: string;
  contactName?: string;
  contactTitle?: string;
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fax?: string;
}

export type OrderDirection = "asc" | "desc";

export type CustomerOrderBy =
  | "customer_id"
  | "company_name"
  | "contact_name"
  | "city"
  | "country";

export interface CustomerQueryParams {
  page?: number;
  perPage?: number;
  nameFilter?: string;
  orderBy?: CustomerOrderBy;
  orderDirection?: OrderDirection;
}
