"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const categoriesJa = ["アクセサリー", "ヘアアクセサリー", "冬物アイテム", "キーリング", "メガネ／サングラス", "ファッション雑貨", "その他（ETC）", "🔒 スタッフ専用"];
const categoriesKo = ["악세사리", "헤어", "겨울상품", "키링", "안경/선글라스", "패션잡화", "기타", "🔒 스태프 전용"];

const subCategoriesKo: Record<number, string[]> = {
  0: ["귀걸이", "목걸이", "반지", "팔찌", "기타"],
  1: ["헤어핀", "집게핀", "머리끈", "헤어밴드", "기타"],
  2: ["장갑", "머플러", "비니", "니트모자", "기타"],
  3: ["가방 키링", "캐릭터 키링", "스트랩", "기타"],
  4: ["패션안경", "선글라스", "안경케이스", "기타"],
  5: ["파우치", "미니백", "지갑", "양말", "캡모자", "기타"],
  6: ["시즌 한정", "이벤트 상품", "테스트 상품", "기타"],
  7: [],
};

const subCategoriesJa: Record<number, string[]> = {
  0: ["ピアス", "ネックレス", "リング", "ブレスレット", "その他"],
  1: ["ヘアピン", "クリップピン", "ヘアゴム", "ヘアバンド", "その他"],
  2: ["手袋", "マフラー", "ビーニー", "ニット帽", "その他"],
  3: ["バッグキーリング", "キャラクターキーリング", "ストラップ", "その他"],
  4: ["ファッション眼鏡", "サングラス", "眼鏡ケース", "その他"],
  5: ["ポーチ", "ミニバッグ", "財布", "靴下", "キャップ", "その他"],
  6: ["シーズン限定", "イベント商品", "テスト商品", "その他"],
  7: [],
};

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
  description_ja?: string;
  description_ko?: string;
  stock?: number;
}

interface ProductOption {
  id: number;
  product_id: number;
  option_name: string;
  additional_price: number;
  stock: number;
  is_active: boolean;
  sort_order: number;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const searchParams = useSearchParams();
  const returnQuery = searchParams.get("return");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<string>("");
  const [formData, setFormData] = useState({
    nameJa: "",
    nameKo: "",
    price: "",
    originalPrice: "",
    categoryJa: categoriesJa[0],
    categoryKo: categoriesKo[0],
    subCategoryJa: "",
    subCategoryKo: "",
    descriptionJa: "",
    descriptionKo: "",
    stock: "",
  });

  // 옵션 관련 상태
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [newOption, setNewOption] = useState({ option_name: "", additional_price: 0, stock: 99 });
  const [optionSaving, setOptionSaving] = useState(false);

  const getCategoryIndex = () => categoriesJa.indexOf(formData.categoryJa);

  useEffect(() => {
    fetchProduct();
    fetchOptions();
  }, [productId]);

  const fetchProduct = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !data) {
      alert('상품을 찾을 수 없습니다.');
      if (returnQuery) { window.location.href = '/products?' + returnQuery; } else { window.location.href = '/products'; }
      return;
    }

    const product = data as Product;
    const catIdx = categoriesJa.indexOf(product.category_ja || product.category || categoriesJa[0]);
    const subCatsJa = subCategoriesJa[catIdx] || [];
    const subCatsKo = subCategoriesKo[catIdx] || [];
    const subCatJaIdx = subCatsJa.indexOf(product.sub_category || "");

    setFormData({
      nameJa: product.name_ja || product.name || "",
      nameKo: product.name_ko || "",
      price: String(product.price || ""),
      originalPrice: product.original_price ? String(product.original_price) : "",
      categoryJa: product.category_ja || product.category || categoriesJa[0],
      categoryKo: product.category_ko || categoriesKo[0],
      subCategoryJa: product.sub_category || subCatsJa[0] || "",
      subCategoryKo: subCatJaIdx >= 0 ? subCatsKo[subCatJaIdx] : subCatsKo[0] || "",
      descriptionJa: product.description_ja || product.description || "",
      descriptionKo: product.description_ko || "",
      stock: product.stock ? String(product.stock) : "",
    });
    setOriginalImage(product.image);
    setImagePreview(product.image);
    setLoading(false);
  };

  const fetchOptions = async () => {
    const { data, error } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setOptions(data);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('이미지 업로드 실패:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const translateText = async (text: string, from: string, to: string): Promise<string> => {
    if (!text.trim()) return "";
    try {
      const res = await fetch(`https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(text)}`);
      const data = await res.json();
      return data.translation || text;
    } catch (error) {
      console.error('번역 실패:', error);
      return text;
    }
  };

  const autoTranslate = async (field: 'name' | 'description', sourceLang: 'ja' | 'ko', value: string) => {
    if (!value.trim()) return;

    const to = sourceLang === 'ja' ? 'ko' : 'ja';
    const targetField = field + (to === 'ja' ? 'Ja' : 'Ko') as keyof typeof formData;

    setTranslating(true);
    try {
      const translated = await translateText(value, sourceLang, to);
      setFormData(prev => ({ ...prev, [targetField]: translated }));

      if (field === 'name') {
        if (sourceLang === 'ja') {
          const catIdx = categoriesJa.indexOf(formData.categoryJa);
          setFormData(prev => ({ ...prev, categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0] }));
        } else {
          const catIdx = categoriesKo.indexOf(formData.categoryKo);
          setFormData(prev => ({ ...prev, categoryJa: catIdx >= 0 ? categoriesJa[catIdx] : categoriesJa[0] }));
        }
      }
    } catch (error) {
      console.error('번역 실패:', error);
    }
    setTranslating(false);
  };

  // 옵션 추가
  const handleAddOption = async () => {
    if (!newOption.option_name.trim()) {
      alert('옵션명을 입력하세요.');
      return;
    }
    setOptionSaving(true);
    const { data, error } = await supabase
      .from('product_options')
      .insert({
        product_id: Number(productId),
        option_name: newOption.option_name,
        additional_price: newOption.additional_price || 0,
        stock: newOption.stock || 99,
        is_active: true,
        sort_order: options.length,
      })
      .select()
      .single();

    if (error) {
      alert('옵션 추가 실패: ' + error.message);
    } else {
      setOptions([...options, data]);
      setNewOption({ option_name: "", additional_price: 0, stock: 99 });
    }
    setOptionSaving(false);
  };

  // 옵션 삭제
  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase
      .from('product_options')
      .delete()
      .eq('id', optionId);

    if (error) {
      alert('삭제 실패: ' + error.message);
    } else {
      setOptions(options.filter(o => o.id !== optionId));
    }
  };

  // 옵션 수정
  const handleUpdateOption = async (option: ProductOption) => {
    const { error } = await supabase
      .from('product_options')
      .update({
        option_name: option.option_name,
        additional_price: option.additional_price,
        stock: option.stock,
        is_active: option.is_active,
      })
      .eq('id', option.id);

    if (error) {
      alert('수정 실패: ' + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    let finalData = { ...formData };

    if (formData.nameJa && !formData.nameKo) {
      const [nameKo, descKo] = await Promise.all([
        translateText(formData.nameJa, 'ja', 'ko'),
        formData.descriptionJa ? translateText(formData.descriptionJa, 'ja', 'ko') : '',
      ]);
      const catIdx = categoriesJa.indexOf(formData.categoryJa);
      finalData = {
        ...finalData,
        nameKo,
        descriptionKo: descKo,
        categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0],
      };
    } else if (formData.nameKo && !formData.nameJa) {
      const [nameJa, descJa] = await Promise.all([
        translateText(formData.nameKo, 'ko', 'ja'),
        formData.descriptionKo ? translateText(formData.descriptionKo, 'ko', 'ja') : '',
      ]);
      const catIdx = categoriesKo.indexOf(formData.categoryKo);
      finalData = {
        ...finalData,
        nameJa,
        descriptionJa: descJa,
        categoryJa: catIdx >= 0 ? categoriesJa[catIdx] : categoriesJa[0],
      };
    }

    let imageUrl = originalImage;

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        alert('이미지 업로드에 실패했습니다.');
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: finalData.nameJa || finalData.nameKo,
        name_ja: finalData.nameJa,
        name_ko: finalData.nameKo,
        price: Number(finalData.price),
        original_price: finalData.originalPrice ? Number(finalData.originalPrice) : null,
        stock: finalData.stock ? Number(finalData.stock) : null,
        category: finalData.categoryJa || finalData.categoryKo,
        category_ja: finalData.categoryJa,
        category_ko: finalData.categoryKo,
        sub_category: finalData.subCategoryJa || null,
        image: imageUrl,
        description: finalData.descriptionJa || finalData.descriptionKo,
        description_ja: finalData.descriptionJa,
        description_ko: finalData.descriptionKo,
      })
      .eq('id', productId);

    setUploading(false);

    if (error) {
      alert('수정 실패: ' + error.message);
      return;
    }

    alert('상품이 수정되었습니다!');
    router.push('/products');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-medium text-gray-900">상품 수정</h1>
        <p className="text-sm text-gray-500 mt-1">상품 정보를 수정합니다 (일본어/한국어)</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 기본 정보 폼 */}
        <form onSubmit={handleSubmit} className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상품 이미지
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                {imagePreview ? (
                  <div className="relative w-full aspect-square max-w-[200px] mx-auto">
                    <Image
                      src={imagePreview}
                      alt="미리보기"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="py-8">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">클릭하여 이미지 선택</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상품명 (日本語) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formData.nameJa}
                  onChange={(e) => setFormData({ ...formData, nameJa: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  placeholder="例: ゴールドチェーンネックレス"
                />
                <button
                  type="button"
                  onClick={() => formData.nameKo && autoTranslate('name', 'ko', formData.nameKo)}
                  disabled={translating || !formData.nameKo}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  title="한국어에서 번역"
                >
                  ← KR
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상품명 (한국어)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.nameKo}
                  onChange={(e) => setFormData({ ...formData, nameKo: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  placeholder="예: 골드 체인 목걸이"
                />
                <button
                  type="button"
                  onClick={() => formData.nameJa && autoTranslate('name', 'ja', formData.nameJa)}
                  disabled={translating || !formData.nameJa}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  title="일본어에서 번역"
                >
                  ← JP
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리 (日本語) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoryJa}
                  onChange={(e) => {
                    const idx = categoriesJa.indexOf(e.target.value);
                    const newSubCatsJa = subCategoriesJa[idx] || [];
                    const newSubCatsKo = subCategoriesKo[idx] || [];
                    setFormData({
                      ...formData,
                      categoryJa: e.target.value,
                      categoryKo: idx >= 0 ? categoriesKo[idx] : formData.categoryKo,
                      subCategoryJa: newSubCatsJa[0] || "",
                      subCategoryKo: newSubCatsKo[0] || "",
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                >
                  {categoriesJa.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리 (한국어)
                </label>
                <select
                  value={formData.categoryKo}
                  onChange={(e) => {
                    const idx = categoriesKo.indexOf(e.target.value);
                    const newSubCatsJa = subCategoriesJa[idx] || [];
                    const newSubCatsKo = subCategoriesKo[idx] || [];
                    setFormData({
                      ...formData,
                      categoryKo: e.target.value,
                      categoryJa: idx >= 0 ? categoriesJa[idx] : formData.categoryJa,
                      subCategoryJa: newSubCatsJa[0] || "",
                      subCategoryKo: newSubCatsKo[0] || "",
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                >
                  {categoriesKo.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {(subCategoriesJa[getCategoryIndex()] || []).length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    하위 카테고리 (日本語)
                  </label>
                  <select
                    value={formData.subCategoryJa}
                    onChange={(e) => {
                      const catIdx = getCategoryIndex();
                      const subCatsJa = subCategoriesJa[catIdx] || [];
                      const subCatsKo = subCategoriesKo[catIdx] || [];
                      const subIdx = subCatsJa.indexOf(e.target.value);
                      setFormData({
                        ...formData,
                        subCategoryJa: e.target.value,
                        subCategoryKo: subIdx >= 0 ? subCatsKo[subIdx] : formData.subCategoryKo,
                      });
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  >
                    {(subCategoriesJa[getCategoryIndex()] || []).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    하위 카테고리 (한국어)
                  </label>
                  <select
                    value={formData.subCategoryKo}
                    onChange={(e) => {
                      const catIdx = getCategoryIndex();
                      const subCatsJa = subCategoriesJa[catIdx] || [];
                      const subCatsKo = subCategoriesKo[catIdx] || [];
                      const subIdx = subCatsKo.indexOf(e.target.value);
                      setFormData({
                        ...formData,
                        subCategoryKo: e.target.value,
                        subCategoryJa: subIdx >= 0 ? subCatsJa[subIdx] : formData.subCategoryJa,
                      });
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  >
                    {(subCategoriesKo[getCategoryIndex()] || []).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  판매가 (¥) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  정가 (¥)
                </label>
                <input
                  type="number"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                재고 수량
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상품 설명 (日本語)
              </label>
              <div className="flex gap-2">
                <textarea
                  rows={3}
                  value={formData.descriptionJa}
                  onChange={(e) => setFormData({ ...formData, descriptionJa: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  placeholder="商品についての説明を入力してください"
                />
                <button
                  type="button"
                  onClick={() => formData.descriptionKo && autoTranslate('description', 'ko', formData.descriptionKo)}
                  disabled={translating || !formData.descriptionKo}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
                  title="한국어에서 번역"
                >
                  ← KR
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상품 설명 (한국어)
              </label>
              <div className="flex gap-2">
                <textarea
                  rows={3}
                  value={formData.descriptionKo}
                  onChange={(e) => setFormData({ ...formData, descriptionKo: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-base"
                  placeholder="상품에 대한 설명을 입력하세요"
                />
                <button
                  type="button"
                  onClick={() => formData.descriptionJa && autoTranslate('description', 'ja', formData.descriptionJa)}
                  disabled={translating || !formData.descriptionJa}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
                  title="일본어에서 번역"
                >
                  ← JP
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={uploading}
                className="w-full sm:w-auto px-6 py-3 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? '수정 중...' : '수정하기'}
              </button>
              <button
                type="button"
                onClick={() => { if (returnQuery) { window.location.href = "/products?" + returnQuery; } else { router.back(); } }}
                className="w-full sm:w-auto px-6 py-3 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </form>

        {/* 옵션 관리 패널 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 sticky top-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">COLOR 옵션</h2>

            {/* 기존 옵션 목록 */}
            <div className="space-y-3 mb-4">
              {options.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">등록된 옵션이 없습니다</p>
              ) : (
                options.map((opt, idx) => (
                  <div key={opt.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={opt.option_name}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[idx].option_name = e.target.value;
                          setOptions(updated);
                        }}
                        onBlur={() => handleUpdateOption(opt)}
                        className="text-sm font-medium text-gray-900 border-none p-0 focus:ring-0 flex-1"
                      />
                      <button
                        onClick={() => handleDeleteOption(opt.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">추가금액 (¥)</label>
                        <input
                          type="number"
                          value={opt.additional_price}
                          onChange={(e) => {
                            const updated = [...options];
                            updated[idx].additional_price = Number(e.target.value);
                            setOptions(updated);
                          }}
                          onBlur={() => handleUpdateOption(opt)}
                          className="w-full text-sm px-2 py-1 border border-gray-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">재고</label>
                        <input
                          type="number"
                          value={opt.stock}
                          onChange={(e) => {
                            const updated = [...options];
                            updated[idx].stock = Number(e.target.value);
                            setOptions(updated);
                          }}
                          onBlur={() => handleUpdateOption(opt)}
                          className="w-full text-sm px-2 py-1 border border-gray-200 rounded"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={opt.is_active}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[idx].is_active = e.target.checked;
                          setOptions(updated);
                          handleUpdateOption({ ...opt, is_active: e.target.checked });
                        }}
                        className="rounded"
                      />
                      활성화
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* 새 옵션 추가 */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">옵션 추가</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="옵션명 (예: ゴールド)"
                  value={newOption.option_name}
                  onChange={(e) => setNewOption({ ...newOption, option_name: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="추가금액"
                    value={newOption.additional_price || ''}
                    onChange={(e) => setNewOption({ ...newOption, additional_price: Number(e.target.value) })}
                    className="text-sm px-3 py-2 border border-gray-200 rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="재고"
                    value={newOption.stock || ''}
                    onChange={(e) => setNewOption({ ...newOption, stock: Number(e.target.value) })}
                    className="text-sm px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleAddOption}
                  disabled={optionSaving || !newOption.option_name.trim()}
                  className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {optionSaving ? '추가 중...' : '+ 옵션 추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
