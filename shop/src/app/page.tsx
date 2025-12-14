"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Banner from "@/components/Banner";
import ProductCard from "@/components/ProductCard";
import StaffPasswordModal from "@/components/StaffPasswordModal";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: number;
  name: string;
  name_ja?: string;
  name_ko?: string;
  price: number;
  original_price?: number;
  image: string;
  category: string;
  category_ja?: string;
  category_ko?: string;
  description?: string;
}

export default function Home() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);

  // 카테고리 (staffOnly 포함 - 비밀번호 기능은 나중에)
  const categoryKeys = ["all", "accessory", "hair", "winter", "keyring", "eyewear", "fashion", "etc", "staffOnly"];
  const categoryMap: Record<string, string> = {
    all: "all",
    accessory: "アクセサリー",
    hair: "ヘアアクセサリー",
    winter: "冬物アイテム",
    keyring: "キーリング",
    eyewear: "メガネ／サングラス",
    fashion: "ファッション雑貨",
    etc: "その他（ETC）",
    staffOnly: "🔒 スタッフ専用"
  };

  useEffect(() => {
    fetchProducts();
    // 세션 스토리지에서 스태프 접근 권한 확인
    const staffAccess = sessionStorage.getItem("staff_access");
    if (staffAccess === "true") {
      setHasStaffAccess(true);
    }
    // URL에 ?staff=1 있으면 비밀번호 모달 표시
    if (searchParams.get("staff") === "1" && staffAccess !== "true") {
      setShowStaffModal(true);
    }
  }, [searchParams]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)  // 판매중인 상품만
      .order('created_at', { ascending: false });

    if (error) {
      console.error('상품 조회 실패:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleCategoryClick = (catKey: string) => {
    // staffOnly 카테고리 클릭 시 접근 권한 확인
    if (catKey === "staffOnly") {
      if (hasStaffAccess) {
        setSelectedCategory(catKey);
      } else {
        setShowStaffModal(true);
      }
    } else {
      setSelectedCategory(catKey);
    }
  };

  const handleStaffAccessSuccess = () => {
    setHasStaffAccess(true);
    setShowStaffModal(false);
    setSelectedCategory("staffOnly");
  };

  const filteredProducts = selectedCategory === "all"
    ? products.filter((p) => p.category !== "🔒 スタッフ専用") // all에서는 스태프 전용 제외
    : products.filter((p) => p.category === categoryMap[selectedCategory]);

  return (
    <div>
      {/* Banner */}
      <Banner />

      {/* Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-light tracking-widest text-gray-900 mb-2">
            COLLECTION
          </h2>
          <p className="text-sm text-gray-500">{t("home.collection")}</p>
        </div>

        {/* Category Filter - 스크롤 가능 */}
        <div className="flex justify-start md:justify-center overflow-x-auto pb-2 mb-12 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex space-x-3 md:space-x-4">
            {categoryKeys.map((catKey) => (
              <button
                key={catKey}
                onClick={() => handleCategoryClick(catKey)}
                className={`px-3 md:px-4 py-2 text-sm tracking-wide transition-colors whitespace-nowrap ${
                  selectedCategory === catKey
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t(`category.${catKey}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="text-center text-gray-500">{t("common.loading")}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500">{t("home.noProducts")}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* About Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">{t("home.freeShipping")}</h3>
              <p className="text-xs text-gray-500">{t("home.freeShippingDesc")}</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">{t("home.quality")}</h3>
              <p className="text-xs text-gray-500">{t("home.qualityDesc")}</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">{t("home.gift")}</h3>
              <p className="text-xs text-gray-500">{t("home.giftDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Staff Password Modal */}
      <StaffPasswordModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        onSuccess={handleStaffAccessSuccess}
      />
    </div>
  );
}
