"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";
import FormActionBar from "@/components/FormActionBar";

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
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // 2026-08-03 fix: FileList 무효화 후 files.length 참조 문제로 미리보기 안 뜨는 버그 해결
    // - Promise.all로 병렬 로딩 (순서 안정)
    // - fileInputRef.current.value=""는 setImages 완료 후 실행
    const fileArray = Array.from(files);
    try {
      const loaded = await Promise.all(fileArray.map((file) =>
        new Promise<ImageItem>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ file, preview: reader.result as string });
          reader.onerror = () => reject(new Error("파일 읽기 실패: " + file.name));
          reader.readAsDataURL(file);
        })
      ));
      setImages((prev) => [...prev, ...loaded]);
    } catch (err) {
      console.error("이미지 미리보기 생성 실패:", err);
      alert("이미지 미리보기 생성에 실패했습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  // 드래그로 순서 변경 (HTML5 native · 크림디자인팀 v2 · 시각 피드백 강화)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const onDragStart = (i: number) => setDragIndex(i);
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== i && dragOverIndex !== i) setDragOverIndex(i);
  };
  const onDragLeave = () => setDragOverIndex(null);
  const onDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setImages((prev) => {
      const a = [...prev];
      const [moved] = a.splice(dragIndex, 1);
      a.splice(targetIndex, 0, moved);
      return a;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const onDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const uploadImage = async (file: File): Promise<string> => {
    // 2026-08-03 fix: null 반환 대신 throw로 상위에서 명시적 실패 처리
    const fileExt = (file.name.split(".").pop() || "bin").toLowerCase();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${fileExt}`;
    const filePath = `products/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, { contentType: file.type || undefined });
    if (uploadError) {
      console.error("이미지 업로드 실패:", uploadError);
      throw new Error(`이미지 업로드 실패 (${file.name}): ${uploadError.message}`);
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const uploadAllImages = async (): Promise<string[]> => {
    // 2026-08-03 fix: 조용한 skip 제거 → 하나라도 실패하면 throw 로 상위 명시적 알림
    const urls: string[] = [];
    for (const img of images) {
      if (img.file) {
        const u = await uploadImage(img.file); // 실패 시 throw
        urls.push(u);
      } else if (img.url) {
        urls.push(img.url);
      }
    }
    return urls;
  };

  // 번역 함수는 '@/lib/translate'의 translateKoJa 사용 (중복 제거)

  const autoTranslate = async (field: 'name' | 'description', sourceLang: 'ja' | 'ko', value: string) => {
    if (!value.trim()) return;

    const to: 'ko' | 'ja' = sourceLang === 'ja' ? 'ko' : 'ja';
    const targetField = field + (to === 'ja' ? 'Ja' : 'Ko') as keyof typeof formData;

    setTranslating(true);
    try {
      const translated = await translateKoJa(value, sourceLang, to);
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setUploading(true);

    let finalData = { ...formData };

    if (formData.nameJa && !formData.nameKo) {
      const [nameKo, descKo] = await Promise.all([
        translateKoJa(formData.nameJa, 'ja', 'ko'),
        formData.descriptionJa ? translateKoJa(formData.descriptionJa, 'ja', 'ko') : '',
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
        translateKoJa(formData.nameKo, 'ko', 'ja'),
        formData.descriptionKo ? translateKoJa(formData.descriptionKo, 'ko', 'ja') : '',
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

    let uploadedUrls: string[];
    try {
      uploadedUrls = await uploadAllImages();
    } catch (err) {
      alert((err as Error).message);
      setUploading(false);
      return;
    }
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
        stock: 2147483647, // 재고 UI 미노출 · 큰 값 고정 (필요 시 옵션에서 관리)
        category: finalData.categoryJa || finalData.categoryKo,
        category_ja: finalData.categoryJa,
        category_ko: finalData.categoryKo,
        // 지시사항 17: DB는 일본어 원문만 저장, 한국어는 SUB_CATEGORY_KO 사전 매핑으로 표시.
        // subCategoryKo는 폼 표시용 상태이며 별도 컬럼으로 저장하지 않음 (products/new와 동일 정책).
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
    <div className="pb-8 -mx-8 -mt-8 px-8 pt-4 min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-amber-50/40">
      {/* 수정 모드 · 상단 굵은 앰버 스트라이프 · 경고 톤 · 실수 방지 */}
      <div className="-mx-8 -mt-4 mb-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 shadow-md"></div>

      {/* 헤더 배너 · 진한 앰버 · 흰 텍스트 · 수정 임팩트 */}
      <div className="mt-6 mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 shadow-xl">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10"></div>
        <div className="absolute -right-4 -bottom-10 w-32 h-32 rounded-full bg-white/5"></div>
        {/* 좌측 얇은 흰 세로 · 강조 */}
        <div className="absolute left-0 top-4 bottom-4 w-1 bg-white/60 rounded-r-full"></div>
        <div className="relative px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-inner">
            ✏️
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-none">상품 수정 중</h1>
              <span className="inline-flex items-center bg-white text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase shadow animate-pulse">EDIT</span>
            </div>
            <p className="text-amber-50 text-sm mt-1.5">⚠ 기존 상품을 수정합니다 · 변경 사항이 즉시 반영됩니다</p>
          </div>
        </div>
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
                  {images.map((img, index) => {
                    const isDragging = dragIndex === index;
                    const isOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
                    return (
                    <div
                      key={index}
                      className={`relative group transition-transform duration-150 ${isDragging ? "opacity-30 scale-95" : ""} ${isOver ? "scale-105" : ""}`}
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDragLeave={onDragLeave}
                      onDrop={() => onDrop(index)}
                      onDragEnd={onDragEnd}
                    >
                      {/* 드롭 위치 힌트 · 좌측에 파란 세로 바 */}
                      {isOver && <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 rounded-full shadow-lg z-20"></div>}
                      <div className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-move transition-all ${
                        isOver ? "border-blue-500 ring-4 ring-blue-200 shadow-xl" :
                        index === 0 ? "border-blue-500" : "border-gray-200 hover:border-blue-400"
                      }`}>
                        <Image src={img.preview} alt={`이미지 ${index + 1}`} fill className="object-cover" unoptimized />
                        {/* 순번 배지 · 우상단 · 원형 · 어두운 배경 · 순서 즉시 파악 */}
                        <div className="absolute top-1.5 right-1.5 w-7 h-7 bg-gray-900/85 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm ring-2 ring-white/20">
                          {index + 1}
                        </div>
                        {/* 메인 배지 · 좌상단 */}
                        {index === 0 && (
                          <div className="absolute top-1.5 left-1.5 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md tracking-wider">MAIN</div>
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
                    );
                  })}
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
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG · 여러 장 선택 가능</p>
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
                      {/* 재고 필드 · 사장님 요청으로 UI 숨김 · 저장 시 기존 값 유지 */}
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

      <FormActionBar
        cancelHref={returnQuery ? `/products?${returnQuery}` : "/products"}
        cancelLabel="취소"
        primary={{
          label: uploading ? "수정 중..." : "✏️ 수정하기",
          onClick: () => handleSubmit(),
          disabled: uploading,
        }}
      />
    </div>
  );
}
