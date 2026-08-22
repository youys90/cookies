"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";
import ImageLibraryPicker from "@/components/ImageLibraryPicker";

const categoriesJa = ["アクセサリー", "ヘアアクセサリー", "冬物アイテム", "キーリング", "メガネ／サングラス", "ファッション雑貨", "その他（ETC）", "➡ Premium High-Quality ✨"];
const categoriesKo = ["악세사리", "헤어", "겨울상품", "키링", "안경/선글라스", "패션잡화", "기타", "➡ Premium High-Quality ✨"];

// 하위 카테고리 (상위 카테고리 인덱스 기준)
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

interface ImageItem {
  file: File | null;
  preview: string;
  url?: string;
}

interface TempOption {
  option_name: string;
  additional_price: number;
  stock: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiHint, setAiHint] = useState<string>("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 옵션 관련 상태
  const [tempOptions, setTempOptions] = useState<TempOption[]>([]);
  const [newOption, setNewOption] = useState({ option_name: "", additional_price: 0, stock: 99 });

  const [formData, setFormData] = useState({
    nameJa: "",
    nameKo: "",
    price: "",
    originalPrice: "",
    categoryJa: categoriesJa[0],
    categoryKo: categoriesKo[0],
    subCategoryJa: subCategoriesJa[0]?.[0] || "",
    subCategoryKo: subCategoriesKo[0]?.[0] || "",
    descriptionJa: "",
    descriptionKo: "",
    stock: "",
  });

  const getCategoryIndex = () => categoriesJa.indexOf(formData.categoryJa);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Promise.all + 인덱스별 배열로 선택 순서 보장 (첫 번째 = 메인)
    const readAsDataUrl = (file: File): Promise<ImageItem> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ file, preview: reader.result as string });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

    try {
      const newImages = await Promise.all(Array.from(files).map(readAsDataUrl));
      setImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error('이미지 읽기 실패:', err);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImageUp = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  const moveImageDown = (index: number) => {
    if (index === images.length - 1) return;
    setImages((prev) => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  const setAsMain = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const newImages = [...prev];
      const [item] = newImages.splice(index, 1);
      newImages.unshift(item);
      return newImages;
    });
  };

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
    // 2026-08-03 fix: 실패 조용히 넘기지 않고 throw (수정 페이지와 일관)
    const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, { contentType: file.type || undefined });

    if (uploadError) {
      console.error('이미지 업로드 실패:', uploadError);
      throw new Error(`이미지 업로드 실패 (${file.name}): ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const uploadAllImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const img of images) {
      if (img.file) {
        const url = await uploadImage(img.file); // 실패 시 throw
        uploadedUrls.push(url);
      } else if (img.url) {
        uploadedUrls.push(img.url);
      }
    }

    return uploadedUrls;
  };

  const autoTranslate = async (field: 'name' | 'description', sourceLang: 'ja' | 'ko', value: string) => {
    if (!value.trim()) return;

    const from = sourceLang;
    const to: 'ja' | 'ko' = sourceLang === 'ja' ? 'ko' : 'ja';
    const targetField = field + (to === 'ja' ? 'Ja' : 'Ko') as keyof typeof formData;

    setTranslating(true);
    try {
      const translated = await translateKoJa(value, from, to);
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
      console.error('자동 번역 실패:', error);
    }
    setTranslating(false);
  };

  const manualTranslate = async () => {
    const hasJa = formData.nameJa.trim();
    const hasKo = formData.nameKo.trim();

    if (!hasJa && !hasKo) {
      alert('번역할 텍스트를 입력하세요');
      return;
    }

    if (hasJa) {
      setTranslating(true);
      try {
        const [nameKo, descKo] = await Promise.all([
          translateKoJa(formData.nameJa, 'ja', 'ko'),
          formData.descriptionJa ? translateKoJa(formData.descriptionJa, 'ja', 'ko') : '',
        ]);
        const catIdx = categoriesJa.indexOf(formData.categoryJa);
        setFormData(prev => ({
          ...prev,
          nameKo,
          descriptionKo: descKo,
          categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0],
        }));
      } catch (error) {
        alert('번역 중 오류가 발생했습니다');
      }
      setTranslating(false);
    }
  };

  const getTranslateButtonText = () => {
    if (translating) return '번역 중...';
    if (formData.nameJa.trim()) return '일본어 → 한국어 재번역';
    if (formData.nameKo.trim()) return '한국어 → 일본어 재번역';
    return '번역';
  };

  // ── AI 자동 채우기 (Vision) ───────────────────────
  // 첫 번째 이미지를 /api/ai/analyze-image로 보내서 상품명·카테고리·설명 자동 채움.
  // API 키 없으면 서버에서 mock 응답. 결제·키 설정되면 자동으로 실제 AI 호출.
  const handleAiFill = async () => {
    if (images.length === 0 || !images[0].file) {
      alert("먼저 이미지를 업로드하세요");
      return;
    }
    setAiRunning(true);
    try {
      const form = new FormData();
      form.append("image", images[0].file);
      if (aiHint.trim()) form.append("hint", aiHint.trim());
      const res = await fetch("/api/ai/analyze-image", { method: "POST", body: form });
      const json = await res.json();
      const r = json?.result;
      if (!r) {
        alert("AI 응답 없음: " + (json?.error || "알 수 없는 오류"));
      } else {
        const catIdx = categoriesJa.indexOf(r.category);
        setFormData((prev) => ({
          ...prev,
          nameJa: r.name_ja || prev.nameJa,
          nameKo: r.name_ko || prev.nameKo,
          descriptionJa: r.description_ja || prev.descriptionJa,
          descriptionKo: r.description_ko || prev.descriptionKo,
          categoryJa: r.category || prev.categoryJa,
          categoryKo: catIdx >= 0 ? categoriesKo[catIdx] : prev.categoryKo,
          subCategoryJa: r.sub_category || prev.subCategoryJa,
        }));
        if (json.mock) {
          alert(
            "AI 자동 채우기 완료 (mock 모드)\n\nANTHROPIC_API_KEY 설정 후 서버 재시작하면 실제 AI 응답으로 자동 전환됩니다."
          );
        }
      }
    } catch (e) {
      alert("AI 분석 오류: " + String(e));
    }
    setAiRunning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (images.length === 0) {
      alert('최소 1개의 이미지를 등록해주세요');
      return;
    }

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

    let uploadedUrls: string[];
    try {
      uploadedUrls = await uploadAllImages();
    } catch (err) {
      alert((err as Error).message);
      setUploading(false);
      return;
    }
    if (uploadedUrls.length === 0) {
      alert('이미지 업로드에 실패했습니다.');
      setUploading(false);
      return;
    }

    const { data: insertedProduct, error } = await supabase
      .from('products')
      .insert({
        name: finalData.nameJa || finalData.nameKo,
        name_ja: finalData.nameJa,
        name_ko: finalData.nameKo,
        price: Number(finalData.price),
        original_price: finalData.originalPrice ? Number(finalData.originalPrice) : null,
        stock: finalData.stock ? Number(finalData.stock) : null,
        category: finalData.categoryJa || finalData.categoryKo,
        category_ja: finalData.categoryJa,
        category_ko: finalData.categoryKo,
        sub_category: finalData.subCategoryJa || finalData.subCategoryKo || null,
        image: uploadedUrls[0],
        images: uploadedUrls,
        description: finalData.descriptionJa || finalData.descriptionKo,
        description_ja: finalData.descriptionJa,
        description_ko: finalData.descriptionKo,
      })
      .select()
      .single();

    if (error || !insertedProduct) {
      setUploading(false);
      alert('등록 실패: ' + (error?.message || '알 수 없는 오류'));
      return;
    }

    // 옵션 저장
    if (tempOptions.length > 0) {
      const optionsToInsert = tempOptions.map((opt, idx) => ({
        product_id: insertedProduct.id,
        option_name: opt.option_name,
        additional_price: opt.additional_price,
        stock: opt.stock,
        is_active: true,
        source: "일반",
        sort_order: idx,
      }));

      const { error: optError } = await supabase
        .from('product_options')
        .insert(optionsToInsert);

      if (optError) {
        console.error('옵션 저장 실패:', optError);
      }
    }

    setUploading(false);
    alert('상품이 등록되었습니다!');
    router.push('/products');
  };

  return (
    <div className="pb-8 -mx-8 -mt-8 px-8 pt-4 min-h-screen bg-gradient-to-br from-blue-50/60 via-white to-blue-50/30">
      {/* 등록 모드 · 상단 굵은 파랑 스트라이프 (전 너비) */}
      <div className="-mx-8 -mt-4 mb-0 h-2 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 shadow-md"></div>

      {/* 헤더 배너 · 진한 파랑 · 흰 텍스트 · 큰 아이콘 · 확실한 인지 */}
      <div className="mt-6 mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 shadow-xl">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10"></div>
        <div className="absolute -right-4 -bottom-10 w-32 h-32 rounded-full bg-white/5"></div>
        <div className="relative px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-inner">
            🆕
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-none">신규 상품 등록</h1>
              <span className="inline-flex items-center bg-white text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase shadow">NEW</span>
            </div>
            <p className="text-blue-50 text-sm mt-1.5">새 상품을 등록합니다 · 일본어 / 한국어 입력 가능</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 space-y-5">

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <label className="block text-sm font-medium text-gray-700">
                상품 이미지 <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-2">(첫 번째가 메인 이미지)</span>
              </label>
              {images.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={aiHint}
                    onChange={(e) => setAiHint(e.target.value)}
                    placeholder="AI 힌트(선택): 예) 골드, 데일리"
                    className="px-2 py-1 text-xs border border-gray-200 rounded w-48 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    disabled={aiRunning}
                  />
                  <button
                    type="button"
                    onClick={handleAiFill}
                    disabled={aiRunning}
                    className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
                    title="첫 이미지를 AI가 분석해서 상품명·카테고리·설명을 자동 채웁니다 (한/일)"
                  >
                    {aiRunning ? "✨ AI 분석 중..." : "✨ AI로 자동 채우기"}
                  </button>
                </div>
              )}
            </div>

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
                    {isOver && <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 rounded-full shadow-lg z-20"></div>}
                    <div className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-move transition-all ${
                      isOver ? "border-blue-500 ring-4 ring-blue-200 shadow-xl" :
                      index === 0 ? "border-blue-500" : "border-gray-200 hover:border-blue-400"
                    }`}>
                      <Image
                        src={img.preview}
                        alt={`이미지 ${index + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      {/* 순번 배지 */}
                      <div className="absolute top-1.5 right-1.5 w-7 h-7 bg-gray-900/85 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm ring-2 ring-white/20">
                        {index + 1}
                      </div>
                      {index === 0 && (
                        <div className="absolute top-1.5 left-1.5 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md tracking-wider">
                          MAIN
                        </div>
                      )}
                    </div>

                    <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                        title="삭제"
                      >
                        ✕
                      </button>
                      {index !== 0 && (
                        <button
                          type="button"
                          onClick={() => setAsMain(index)}
                          className="w-6 h-6 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-600"
                          title="메인으로 설정"
                        >
                          ★
                        </button>
                      )}
                    </div>

                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveImageUp(index)}
                        disabled={index === 0}
                        className="w-6 h-6 bg-gray-700 text-white rounded text-xs flex items-center justify-center hover:bg-gray-800 disabled:opacity-30"
                        title="앞으로"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImageDown(index)}
                        disabled={index === images.length - 1}
                        className="w-6 h-6 bg-gray-700 text-white rounded text-xs flex items-center justify-center hover:bg-gray-800 disabled:opacity-30"
                        title="뒤로"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="py-4">
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-sm text-gray-500">📤 새 이미지 업로드</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG · 여러 장</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="border-2 border-dashed border-[var(--color-brand)]/40 rounded-lg p-4 text-center hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 transition"
              >
                <div className="py-4">
                  <svg className="w-8 h-8 text-[var(--color-brand)] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-[var(--color-brand-dk)] font-medium">🗂️ 라이브러리에서 선택</p>
                  <p className="text-xs text-gray-500 mt-1">이미 업로드된 이미지 재사용</p>
                </div>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            <ImageLibraryPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(urls) => setImages((prev) => [...prev, ...urls.map((u) => ({ file: null, preview: u, url: u }))])}
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <button
              type="button"
              onClick={manualTranslate}
              disabled={translating}
              className="w-full px-4 py-2.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 transition-colors"
            >
              {getTranslateButtonText()}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              입력 완료 후 포커스 빠지면 자동 번역됩니다
            </p>
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
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                title="일본어에서 번역"
              >
                JP→KR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상위 카테고리 (日本語) <span className="text-red-500">*</span>
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
                상위 카테고리 (한국어)
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

          {(subCategoriesJa[getCategoryIndex()]?.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  하위 카테고리 (日本語)
                </label>
                <select
                  value={formData.subCategoryJa}
                  onChange={(e) => {
                    const idx = subCategoriesJa[getCategoryIndex()]?.indexOf(e.target.value) ?? -1;
                    const subCatsKo = subCategoriesKo[getCategoryIndex()] || [];
                    setFormData({
                      ...formData,
                      subCategoryJa: e.target.value,
                      subCategoryKo: idx >= 0 ? subCatsKo[idx] : formData.subCategoryKo,
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
                    const idx = subCategoriesKo[getCategoryIndex()]?.indexOf(e.target.value) ?? -1;
                    const subCatsJa = subCategoriesJa[getCategoryIndex()] || [];
                    setFormData({
                      ...formData,
                      subCategoryKo: e.target.value,
                      subCategoryJa: idx >= 0 ? subCatsJa[idx] : formData.subCategoryJa,
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
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
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
                className="px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap self-start"
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
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? '등록 중...' : '🆕 등록하기'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
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

          {/* 임시 옵션 목록 */}
          <div className="space-y-3 mb-4">
            {tempOptions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">등록된 옵션이 없습니다</p>
            ) : (
              tempOptions.map((opt, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={opt.option_name}
                      onChange={(e) => {
                        const updated = [...tempOptions];
                        updated[idx].option_name = e.target.value;
                        setTempOptions(updated);
                      }}
                      className="text-sm font-medium text-gray-900 border-none p-0 focus:ring-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setTempOptions(tempOptions.filter((_, i) => i !== idx))}
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
                          const updated = [...tempOptions];
                          updated[idx].additional_price = Number(e.target.value);
                          setTempOptions(updated);
                        }}
                        className="w-full text-sm px-2 py-1 border border-gray-200 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">재고</label>
                      <input
                        type="number"
                        value={opt.stock}
                        onChange={(e) => {
                          const updated = [...tempOptions];
                          updated[idx].stock = Number(e.target.value);
                          setTempOptions(updated);
                        }}
                        className="w-full text-sm px-2 py-1 border border-gray-200 rounded"
                      />
                    </div>
                  </div>
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
                type="button"
                onClick={() => {
                  if (!newOption.option_name.trim()) {
                    alert('옵션명을 입력하세요.');
                    return;
                  }
                  setTempOptions([...tempOptions, { ...newOption }]);
                  setNewOption({ option_name: "", additional_price: 0, stock: 99 });
                }}
                className="w-full py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
              >
                + 옵션 추가
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
