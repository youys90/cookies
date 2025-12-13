export interface Product {
  id: number;
  name: string;
  nameEn: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  description: string;
  details: string[];
  stock?: number;
  status?: "active" | "inactive";
}

export const products: Product[] = [
  {
    id: 1,
    name: "골드 체인 목걸이",
    nameEn: "Gold Chain Necklace",
    price: 89000,
    originalPrice: 120000,
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400",
    category: "목걸이",
    description: "세련된 14K 골드 체인 목걸이",
    details: ["14K 골드", "길이 45cm", "무게 3.2g"],
    stock: 25,
    status: "active"
  },
  {
    id: 2,
    name: "실버 진주 귀걸이",
    nameEn: "Silver Pearl Earrings",
    price: 45000,
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400",
    category: "귀걸이",
    description: "우아한 담수 진주 귀걸이",
    details: ["925 실버", "담수 진주 8mm", "드롭형"],
    stock: 42,
    status: "active"
  },
  {
    id: 3,
    name: "로즈골드 반지",
    nameEn: "Rose Gold Ring",
    price: 128000,
    originalPrice: 150000,
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400",
    category: "반지",
    description: "미니멀한 로즈골드 반지",
    details: ["18K 로즈골드", "사이즈 조절 가능"],
    stock: 18,
    status: "active"
  },
  {
    id: 4,
    name: "크리스탈 팔찌",
    nameEn: "Crystal Bracelet",
    price: 67000,
    image: "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=400",
    category: "팔찌",
    description: "스와로브스키 크리스탈 팔찌",
    details: ["스털링 실버", "스와로브스키 크리스탈", "길이 17cm"],
    stock: 31,
    status: "active"
  },
  {
    id: 5,
    name: "다이아몬드 펜던트",
    nameEn: "Diamond Pendant",
    price: 298000,
    originalPrice: 350000,
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400",
    category: "목걸이",
    description: "0.3캐럿 다이아몬드 펜던트",
    details: ["18K 화이트골드", "0.3ct 다이아몬드", "체인 포함"],
    stock: 8,
    status: "active"
  },
  {
    id: 6,
    name: "빈티지 골드 귀걸이",
    nameEn: "Vintage Gold Earrings",
    price: 76000,
    image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=400",
    category: "귀걸이",
    description: "빈티지 스타일 골드 귀걸이",
    details: ["14K 골드", "빈티지 디자인", "클립형"],
    stock: 15,
    status: "active"
  },
  {
    id: 7,
    name: "하트 목걸이",
    nameEn: "Heart Necklace",
    price: 55000,
    image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400",
    category: "목걸이",
    description: "러블리 하트 펜던트 목걸이",
    details: ["925 실버", "로즈골드 도금", "길이 42cm"],
    stock: 52,
    status: "active"
  },
  {
    id: 8,
    name: "레이어드 팔찌 세트",
    nameEn: "Layered Bracelet Set",
    price: 89000,
    originalPrice: 110000,
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400",
    category: "팔찌",
    description: "3종 레이어드 팔찌 세트",
    details: ["믹스 메탈", "3개 세트", "조절 가능"],
    stock: 0,
    status: "inactive"
  }
];

export const categories = ["목걸이", "귀걸이", "반지", "팔찌"];

// 더미 주문 데이터
export interface Order {
  id: string;
  date: string;
  customer: string;
  products: { productId: number; quantity: number }[];
  total: number;
  status: "pending" | "confirmed" | "shipped" | "delivered";
}

export const orders: Order[] = [
  { id: "ORD-001", date: "2024-12-13", customer: "김민지", products: [{ productId: 1, quantity: 1 }], total: 89000, status: "pending" },
  { id: "ORD-002", date: "2024-12-12", customer: "이서윤", products: [{ productId: 3, quantity: 1 }, { productId: 2, quantity: 2 }], total: 218000, status: "confirmed" },
  { id: "ORD-003", date: "2024-12-11", customer: "박지현", products: [{ productId: 5, quantity: 1 }], total: 298000, status: "shipped" },
  { id: "ORD-004", date: "2024-12-10", customer: "최수아", products: [{ productId: 7, quantity: 1 }], total: 55000, status: "delivered" },
];
