export interface CartItem {
  goods: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  sellerId?: number;
}

export interface Product {
  id: number;
  sellerId: number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  media?: Record<string, unknown>;
  quantity: number;
  targetPrice?: number;
  costPrice?: number;
  velocity?: number;
  kalmanVariance?: number;
  storageCost?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  image?: string;
  role: string;
  username?: string;
  profile?: Record<string, unknown>;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  userId: number;
  cart: CartItem[];
  shipping?: string;
  paymentStatus: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EnrichedProfile extends UserProfile {
  budget?: number;
  gold?: number;
  stocks?: Record<string, number>;
  products?: Product[];
  skillLevel?: number;
  skillTitle?: string;
  loanParameters?: Record<string, unknown>;
}

export interface AgentAsset {
  userId: number;
  name: string;
  budget: number;
  gold: number;
  stocks: Record<string, number>;
  products: Product[];
  skillLevel: number;
  skillTitle: string;
}
