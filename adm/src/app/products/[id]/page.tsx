"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const categoriesJa = ["アクセサリー", "ヘアアクセサリー", "冬物アイテム", "キーリング", "メガネ／サングラス", "ファッション雑貨", "その他（ETC）", "➡ Premium High-Quality ✨"];
const categoriesKo = ["악세사리", "헤어", "겨울상품", "키링", "안경/선글라스", "패션잡화", "기타", "➡ Premium High-Quality ✨"];

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
  images?: string[] | unknown;
  category: string;
  category_ja?: string;
  category_ko?: string;
  sub_category?: string;
  description?: string;
  description_ja?: string;
  description_ko?: string;
  stock?: number;
}

interface ImageItem {
  file: File | null;
  preview: string;
  url?: string;
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

  // 다중 이미지 편집 (판석이형 피드백: 수정 시 사진도 편집 가능)
  const [images, setImages] = useState<ImageItem[]>([]);
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
    // 기존 이미지들을 ImageItem 배열로 로드 (images 배열 우선, 없으면 image 단일)
    const existingImages: ImageItem[] = [];
    const imgArr = Array.isArray(product.images) ? (product.images as string[]) : [];
    if (imgArr.length > 0) {
      imgArr.forEach((u) => {
        if (typeof u === "string" && u) existingImages.push({ file: null, preview: u, url: u });
      });
    } else if (product.image) {
      existingImages.push({ file: null, preview: product.image, url: product.image });
    }
    setImages(existingImages);
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

  // ── 다중 이미지 편집 ──────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageItem[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push({ file, preview: reader.result as string });
        if (newImages.length === files.length) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const moveImageUp = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const a = [...prev];
      [a[index - 1], a[index]] = [a[index], a[index - 1]];
      return a;
    });
  };

  const moveImageDown = (index: number) => {
    if (index === images.length - 1) return;
    setImages((prev) => {
      const a = [...prev];
      [a[index], a[index + 1]] = [a[index + 1], a[index]];
      return a;
    });
  };

  const setAsMain = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const a = [...prev];
      const [item] = a.splice(index, 1);
      a.unshift(item);
      return a;
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `products/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);
    if (uploadError) {
      console.error("이미지 업로드 실패:", uploadError);
      return null;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const uploadAllImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const img of images) {
      if (img.file) {
        const u = await uploadImage(img.file);
        if (u) urls.push(u);
      } else if (img.url) {
        urls.push(img.url);
      }
    }
    return urls;
  };

  // 번역 함수 (MyMemory + Google Translate fallback)
  const translateText = async (text: string, from: string, to: string): Promise<string> => {
    if (!text.trim()) return "";

    // 영문자 부분 추출해서 보존
    const englishParts: string[] = [];
    const placeholder = "{{EN}}";
    const preserved = text.replace(/[A-Za-z]+/g, (match) => {
      englishParts.push(match);
      return placeholder;
    });

    const restoreEnglish = (translated: string) => {
      let result = translated;
      englishParts.forEach((eng) => {
        result = result.replace(placeholder, eng);
      });
      return result;
    };

    // 1차: MyMemory API
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(preserved)}&langpair=${from}|${to}`);
      const data = await res.json();
      const translated = data.responseData?.translatedText || "";

      if (translated && !translated.includes("MYMEMORY WARNING")) {
        return restoreEnglish(translated);
      }
    } catch (error) {
      console.error('MyMemory 번역 실패:', error);
    }

    // 2차: Google Translate fallback
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(preserved)}`);
      const data = await res.json();
      const translated = data[0]?.map((item: string[]) => item[0]).join('') || text;
      return restoreEnglish(translated);
    } catch (error) {
      console.error('Google 번역 실패:', error);
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

    if (images.length === 0) {
      alert("최소 1개의 이미지를 등록해주세요.");
      setUploading(false);
      return;
    }

    const uploadedUrls = await uploadAllImages();
    if (uploadedUrls.length === 0) {
      alert("이미지 업로드에 실패했습니다.");
      setUploading(false);
      return;
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
        image: uploadedUrls[0],
        images: uploadedUrls,
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
                상품 이미지 <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-2">(첫 번째가 메인 · 여러 장 선택 가능 · 순서 변경/삭제)</span>
              </label>

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <div className={`relative aspect-square rounded-lg overflow-hidden border-2 ${index === 0 ? "border-blue-500" : "border-gray-200"}`}>
                        <Image src={img.preview} alt={`이미지 ${index + 1}`} fill className="object-cover" unoptimized />
                        {index === 0 && (
                          <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">메인</div>
                        )}
                      </div>
                      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => removeImage(index)} className="w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600" title="삭제">✕</button>
                        {index !== 0 && (
                          <button type="button" onClick={() => setAsMain(index)} className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-600" title="메인으로 설정">★</button>
                        )}
                      </div>
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => moveImageUp(index)} disabled={index === 0} className="w-6 h-6 bg-gray-700 text-white rounded text-xs flex items-center justify-center hover:bg-gray-800 disabled:opacity-30" title="앞으로">←</button>
                        <button type="button" onClick={() => moveImageDown(index)} disabled={index === images.length - 1} className="w-6 h-6 bg-gray-700 text-white rounded text-xs flex items-center justify-center hover:bg-gray-800 disabled:opacity-30" title="뒤로">→</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="py-4">
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-sm text-gray-500">{images.length === 0 ? "클릭하여 이미지 선택" : "이미지 추가"}</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG (여러 장 선택 가능)</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
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
                  className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  title="한국어에서 번역"
                >
                  KR→JP
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
                  className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  title="일본어에서 번역"
                >
                  JP→KR
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
                  판매가 (₩) <span className="text-red-500">*</span>
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
                  정가 (₩)
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
                  className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
                  title="한국어에서 번역"
                >
                  KR→JP
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
                  className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
                  title="일본어에서 번역"
                >
                  JP→KR
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
                        <label className="text-xs text-gray-500">추가금액 (₩)</label>
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
