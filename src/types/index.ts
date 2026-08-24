export type OrderMode = 'pickup' | 'delivery' | 'automac' | 'table';

export type Language = 'es' | 'en' | 'pt';

export interface IngredientOption {
  id: string;
  name: string;
  nameEn: string;
  namePt: string;
  price: number;
  calories: number;
  defaultAmount: number; // 0, 1, 2...
  maxAmount: number;
  category: 'patty' | 'cheese' | 'veggie' | 'sauce' | 'bread' | 'extra';
}

export interface ComboSideOption {
  id: string;
  name: string;
  nameEn: string;
  namePt: string;
  extraPrice: number;
  calories: number;
  image: string;
}

export interface ComboDrinkOption {
  id: string;
  name: string;
  nameEn: string;
  namePt: string;
  extraPrice: number;
  calories: number;
  size: 'regular' | 'medium' | 'large';
  image: string;
}

export interface MenuItem {
  id: string;
  name: string;
  nameEn: string;
  namePt: string;
  description: string;
  descriptionEn: string;
  descriptionPt: string;
  category:
    | 'hamburguesas'
    | 'signature'
    | 'pollo'
    | 'acompanamientos'
    | 'bebidas'
    | 'postres'
    | 'desayunos'
    | 'cajita-feliz'
    | 'promociones';
  price: number;
  originalPrice?: number;
  calories: number;
  image: string;
  isPopular?: boolean;
  isNew?: boolean;
  isPromo?: boolean;
  inStock: boolean;
  stockCount?: number;
  customizable: boolean;
  availableInCombo?: boolean;
  defaultComboPrice?: number;
  ingredients?: IngredientOption[];
  tags: string[];
}

export interface RawMaterialItem {
  id: string;
  name: string;
  category: 'carnes' | 'panaderia' | 'vegetales_salsas' | 'lacteos_postres' | 'congelados' | 'aceites_empaques';
  stockCount: number;
  unit: 'unidades' | 'cajas' | 'bolsas' | 'paquetes' | 'cartuchos' | 'cubetas' | 'bidones';
  minThreshold: number;
  optimalStock: number;
  lastRestocked: string;
  description: string;
}

export interface CustomizationSelection {
  ingredientAmounts: Record<string, number>; // ingredientId -> amount
  size: 'regular' | 'medium' | 'large';
  isCombo: boolean;
  selectedSide?: ComboSideOption;
  selectedDrink?: ComboDrinkOption;
  specialInstructions?: string;
}

export interface CartItem {
  id: string; // unique cart line item id
  product: MenuItem;
  quantity: number;
  customization: CustomizationSelection;
  unitPrice: number;
  totalPrice: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  isOpen: boolean;
  hours: string;
  estimatedPrepTimeMin: number;
  features: {
    hasDriveThru: boolean;
    hasMcCafe: boolean;
    hasPlayPlace: boolean;
    hasTableService: boolean;
    has24Hours: boolean;
    hasDelivery: boolean;
  };
  phone: string;
}

export type OrderStatus =
  | 'placed'
  | 'kitchen_preparing'
  | 'quality_check'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  timestamp: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  mode: OrderMode;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tip: number;
  tax: number;
  total: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  paymentMethod: 'card' | 'apple_pay' | 'google_pay' | 'mercadopago' | 'kiosk_cash';
  paymentStatus: 'paid' | 'pending' | 'failed';
  paymentToken?: string;
  status: OrderStatus;
  store: StoreLocation;
  deliveryAddress?: {
    street: string;
    details?: string;
    commune: string;
    notes?: string;
  };
  tableNumber?: string;
  vehiclePlate?: string;
  estimatedReadyTime: string;
  trackingLogs: {
    status: OrderStatus;
    time: string;
    message: string;
  }[];
}

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'mercadopago' | 'kiosk_cash';

export interface LoyaltyTier {
  id: 'bronze' | 'silver' | 'gold' | 'platinum';
  name: string;
  minPoints: number;
  multiplier: number;
  color: string;
  perks: string[];
  benefits: string[];
}

export interface LoyaltyReward {
  id: string;
  title: string;
  titleEn: string;
  titlePt: string;
  pointsCost: number;
  image: string;
  category: 'burger' | 'drink' | 'dessert' | 'combo' | 'discount';
  expiresInDays: number;
  terms: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  authProvider: 'google' | 'apple' | 'email' | 'guest';
  loyaltyPoints: number;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  savedAddresses: {
    id: string;
    label: string;
    street: string;
    commune: string;
    isDefault: boolean;
  }[];
  paymentMethods: {
    id: string;
    type: 'visa' | 'mastercard' | 'amex';
    last4: string;
    expiry: string;
    isDefault: boolean;
  }[];
  favoriteItemIds: string[];
  orderHistory: string[];
  securitySettings: {
    twoFactorEnabled: boolean;
    e2eEncryptionEnabled: boolean;
    suspiciousAlertsEnabled: boolean;
    marketingPushEnabled: boolean;
    orderPushEnabled: boolean;
    biometricsEnabled: boolean;
  };
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'order' | 'security' | 'reward' | 'promo';
  read: boolean;
  actionUrl?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: 'AUTH_LOGIN' | 'ORDER_CREATED' | 'SECURITY_MODIFIED' | 'PAYMENT_TOKENIZED' | 'INVENTORY_UPDATED' | 'DATA_EXPORT';
  userId: string;
  ipAddress: string;
  userAgent: string;
  status: 'SUCCESS' | 'WARNING' | 'ALERT';
  details: string;
  integrityHash: string;
}

export interface AnalyticsMetric {
  date: string;
  hour?: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
  topItem: string;
  activeUsers: number;
}
