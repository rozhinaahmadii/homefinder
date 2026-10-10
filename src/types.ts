export interface Contact {
  name: string;
  agency?: string;
  email?: string;
}

export interface Listing {
  id: number;
  title: string;
  offerType: 'sale' | 'rent';
  propertyType: 'apartment' | 'house' | 'studio';
  city: string;
  district?: string;
  address?: string;
  price: number | null;
  currency: string;
  area: number;
  rooms: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  description: string;
  features: string[];
  image?: string | null;
  publishedAt: string;
  contact?: Contact;
}
