import Link from "next/link";
import Image from "next/image";

interface Product {
  id: number;
  name: string;
  price: number;
  original_price?: number;
  image: string;
  category: string;
  description?: string;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  return (
    <Link href={`/product/${product.id}`} className="group">
      <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-lg">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {product.original_price && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            SALE
          </span>
        )}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-xs text-gray-400 tracking-wide">{product.category}</p>
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-gray-600">
          {product.name}
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-900">
            {formatPrice(product.price)}
          </span>
          {product.original_price && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
