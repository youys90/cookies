"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Banner from "@/components/Banner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ProductCard from "@/components/ProductCard";
import StaffPasswordModal from "@/components/StaffPasswordModal";
import ReviewSlider from "@/components/ReviewSlider";
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
  sub_category?: string;
  description?: string;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100];

export default function Home() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("cat") || "all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("size")) || 50);
  const [totalCount, setTotalCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

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
    staffOnly: "➡ Premium High-Quality ✨"
  };

  // 하위 카테고리 (카테고리 키 -> 하위 카테고리 키 배열)
  const subCategoryKeys: Record<string, string[]> = {
    accessory: ["earrings", "necklace", "ring", "bracelet", "etc"],
    hair: ["hairpin", "clippin", "hairband", "headband", "etc"],
    winter: ["gloves", "scarf", "beanie", "knithat", "etc"],
    keyring: ["bagkeyring", "charkeyring", "strap", "etc"],
    eyewear: ["fashionglass", "sunglass", "glasscase", "etc"],
    fashion: ["pouch", "minibag", "wallet", "socks", "cap", "etc"],
    etc: ["season", "event", "test", "etc"],
  };

  // 하위 카테고리 키 -> DB 값 (일본어)
  const subCategoryMap: Record<string, string> = {
    earrings: "ピアス", necklace: "ネックレス", ring: "リング", bracelet: "ブレスレット",
    hairpin: "ヘアピン", clippin: "クリップピン", hairband: "ヘアゴム", headband: "ヘアバンド",
    gloves: "手袋", scarf: "マフラー", beanie: "ビーニー", knithat: "ニット帽",
    bagkeyring: "バッグキーリング", charkeyring: "キャラクターキーリング", strap: "ストラップ",
    fashionglass: "ファッション眼鏡", sunglass: "サングラス", glasscase: "眼鏡ケース",
    pouch: "ポーチ", minibag: "ミニバッグ", wallet: "財布", socks: "靴下", cap: "キャップ",
    season: "シーズン限定", event: "イベント商品", test: "テスト商品", etc: "その他",
  };

  useEffect(() => {
    // 세션 스토리지에서 스태프 접근 권한 확인
    const staffAccess = sessionStorage.getItem("staff_access");
    if (staffAccess === "true") {
      setHasStaffAccess(true);
    }
    // URL에 ?staff=1 있으면 비밀번호 모달 표시
    if (searchParams.get("staff") === "1" && staffAccess !== "true") {
      setShowStaffModal(true);
    }
  }, []);

  // URL 파라미터 변경 감지 (searchParams에서 직접 읽기 - Next.js router.push 대응)
  useEffect(() => {
    const page = Number(searchParams.get("page")) || 1;
    const size = Number(searchParams.get("size")) || 50;
    const cat = searchParams.get("cat") || "all";
    const search = searchParams.get("search") || "";

    setCurrentPage(page);
    setPageSize(size);
    setSelectedCategory(cat);
    setSearchKeyword(search);
    setSearchInput(search);
  }, [searchParams]);

  // 상태 변경 시 URL 업데이트 (브라우저 히스토리에 반영)
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 50) params.set("size", String(pageSize));
    if (selectedCategory !== "all") params.set("cat", selectedCategory);
    if (searchKeyword) params.set("search", searchKeyword);

    const newUrl = params.toString() ? "/?" + params.toString() : "/";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, pageSize, selectedCategory, searchKeyword]);

  // 카테고리/하위카테고리/페이지/검색 변경 시 상품 조회
  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedSubCategory, currentPage, pageSize, searchKeyword]);

  const fetchProducts = async () => {
    setLoading(true);

    // 카테고리 필터 조건
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // 카테고리 필터
    if (selectedCategory === "all") {
      query = query.neq('category', '➡ Premium High-Quality ✨');
    } else {
      query = query.eq('category', categoryMap[selectedCategory]);
    }

    // 하위 카테고리 필터
    if (selectedSubCategory !== "all") {
      query = query.eq('sub_category', subCategoryMap[selectedSubCategory]);
    }

    // 검색 필터
    if (searchKeyword) {
      query = query.or("name.ilike.%" + searchKeyword + "%,name_ja.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%");
    }

    // 페이지네이션 (range는 0-based)
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('상품 조회 실패:', error);
    } else {
      setProducts(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleCategoryClick = (catKey: string) => {
    // staffOnly 카테고리 클릭 시 접근 권한 확인
    if (catKey === "staffOnly") {
      if (hasStaffAccess) {
        setSelectedCategory(catKey);
        setSelectedSubCategory("all");
        setCurrentPage(1);
        setSearchKeyword("");
        setSearchInput("");
        setSearchKeyword("");
        setSearchInput("");
      } else {
        setShowStaffModal(true);
      }
    } else {
      setSelectedCategory(catKey);
      setSelectedSubCategory("all");
      setCurrentPage(1);
    }
  };

  const handleSubCategoryClick = (subCatKey: string) => {
    setSelectedSubCategory(subCatKey);
    setCurrentPage(1);
    setSearchKeyword("");
    setSearchInput("");
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleStaffAccessSuccess = () => {
    setHasStaffAccess(true);
    setShowStaffModal(false);
    setSelectedCategory("staffOnly");
    setSelectedSubCategory("all");
  };

  // 현재 선택된 카테고리의 하위 카테고리 목록
  const currentSubCategories = subCategoryKeys[selectedCategory] || [];

  return (
    <div>
      {/* Banner */}
      <Banner />

      {/* Review Slider - 배너 바로 아래 */}
      <ReviewSlider />

      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-2xl font-light tracking-widest text-gray-900 mb-2">
            COLLECTION
          </h2>
          <p className="text-sm text-gray-500">{t("home.collection")}</p>
        </div>

        
        {/* 검색 */}
        <div className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); setSearchKeyword(searchInput); setCurrentPage(1); }} className="flex justify-center gap-2">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={language === 'ko' ? '상품명 검색...' : '商品名で検索...'}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(""); setSearchKeyword(""); setCurrentPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">
              {language === 'ko' ? '검색' : '検索'}
            </button>
          </form>
          {searchKeyword && (
            <p className="text-center text-sm text-gray-500 mt-2">
              {language === 'ko' ? '"' + searchKeyword + '" 검색 결과' : '"' + searchKeyword + '" の検索結果'}
            </p>
          )}
        </div>

        {/* Category Filter - 스크롤 가능 */}
        <div className="flex justify-start md:justify-center overflow-x-auto pb-2 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
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

        {/* Sub-category Filter - 하위 카테고리가 있을 때만 표시 */}
        {currentSubCategories.length > 0 && (
          <div className="flex justify-start md:justify-center overflow-x-auto pb-2 mb-12 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex space-x-2 md:space-x-3">
              <button
                onClick={() => handleSubCategoryClick("all")}
                className={`px-3 py-1.5 text-xs tracking-wide transition-colors whitespace-nowrap rounded-full ${
                  selectedSubCategory === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {t("subcat.all")}
              </button>
              {currentSubCategories.map((subCatKey) => (
                <button
                  key={subCatKey}
                  onClick={() => handleSubCategoryClick(subCatKey)}
                  className={`px-3 py-1.5 text-xs tracking-wide transition-colors whitespace-nowrap rounded-full ${
                    selectedSubCategory === subCatKey
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {t(`subcat.${subCatKey}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 하위 카테고리 없으면 mb-12 유지 */}
        {currentSubCategories.length === 0 && <div className="mb-8" />}

        {/* 상품 개수 및 페이지 사이즈 선택 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <p className="text-sm text-gray-500">
            {totalCount > 0 ? (
              language === 'ko' ? `총 ${totalCount}개` : `全${totalCount}件`
            ) : null}
          </p>
          <div className="flex items-center gap-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={`px-3 py-1.5 text-xs rounded-full ${
                  pageSize === size
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {size}{language === 'ko' ? '개씩' : '件'}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid - 순번 없이 */}
        {loading ? (
          <div className="text-center text-gray-500 py-20">{t("common.loading")}</div>
        ) : products.length === 0 ? (
          <div className="text-center text-gray-500 py-20">{t("home.noProducts")}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} returnQuery={"page=" + currentPage + "&size=" + pageSize + "&cat=" + selectedCategory + (searchKeyword ? "&search=" + searchKeyword : "")} />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-12 gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {'<<'}
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {'<'}
            </button>

            {/* 페이지 번호 */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 text-sm rounded ${
                    currentPage === pageNum
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {'>'}
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {'>>'}
            </button>
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
