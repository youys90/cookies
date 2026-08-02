import { redirect } from "next/navigation";

// 구 라우트: /products/[id] → 신 라우트: /product/[id] 로 영구 리디렉트
// CREAM 리디자인은 신규 라우트(product/[id])에만 적용되므로,
// 카트/리뷰 등에서 남아있는 /products/[id] 링크 진입 시에도 신규 UI로 통일한다.
export default async function LegacyProductRedirect({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  redirect(`/product/${resolved.id}`);
}
