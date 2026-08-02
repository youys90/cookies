# Cookies 프로젝트 운영 지침

## 개요
- **브랜드**: Cookies
- **GitHub**: https://github.com/youys90/cookies
- **구조**: monorepo (shop + adm)

---

## 폴더 구조

```
cookies/
├── shop/     # 고객용 (포트 3000)
├── adm/      # 관리자용 (포트 3001)
└── GUIDE.md  # 이 파일
```

---

## 브랜치 전략

| 브랜치 | 용도 | 배포 |
|--------|------|------|
| `real` | 운영 | Vercel 연결 |
| `dev` | 개발 통합 | 테스트용 |
| `feature/*` | 기능 개발 | 작업 후 dev로 머지 |

### 흐름
```
feature/기능명 → dev → real
      ↓           ↓      ↓
    개발중      테스트   배포
```

---

## Git 작업 규칙

### 기본 흐름 (필수!)
```bash
git pull                    # 1. 최신화 먼저!
# 코드 수정
git add .                   # 2. 스테이징
git commit -m "작업내용"     # 3. 커밋
git push                    # 4. 업로드
```

### 왜 pull 먼저?
- 여러 기기에서 작업할 수 있음
- 충돌 방지
- **습관적으로 pull 먼저!**

---

## DB 운영 지침

### 구조
| 용도 | DB | 설명 |
|------|-----|------|
| **운영** | Supabase | 24시간 운영, 실제 데이터 |
| **개발/테스트** | 로컬 PostgreSQL | 덤프해서 사용 |

### 덤프 & 복원
```bash
# Supabase → 로컬 덤프
pg_dump -h aws-1-ap-northeast-2.pooler.supabase.com -p 5432 -U postgres.bnrsdiucywkeykskdzci -d postgres > backup.sql

# 로컬에 복원
psql -h localhost -U postgres -d cookies < backup.sql
```

### DBeaver 연결 정보 (Supabase)
| 항목 | 값 |
|------|-----|
| Host | `aws-1-ap-northeast-2.pooler.supabase.com` |
| Port | `5432` |
| Database | `postgres` |
| Username | `postgres.bnrsdiucywkeykskdzci` |
| Password | (별도 관리) |

---

## 배포 구조

| 서비스 | 용도 | 비용 |
|--------|------|------|
| GitHub | 코드 저장 | 무료 |
| Vercel | 서버 (배포) | 무료 |
| Supabase | DB | 무료 |

### 배포 주소 (예정)
| 사이트 | URL |
|--------|-----|
| shop | cookies-shop.vercel.app |
| adm | cookies-adm.vercel.app |

---

## 개발 환경

### 도구
| 용도 | 도구 |
|------|------|
| IDE | VS Code |
| DB 클라이언트 | DBeaver |
| 버전관리 | Git Bash |
| 터미널 | VS Code 내장 (Ctrl+`) |

### 서버 실행
```bash
# shop (고객용)
cd cookies/shop
npm install   # 최초 1회
npm run dev   # localhost:3000

# adm (관리자용)
cd cookies/adm
npm install   # 최초 1회
npm run dev -- -p 3001   # localhost:3001
```

---

## VS Code 단축키

| 단축키 | 기능 |
|--------|------|
| Ctrl+P | 파일 검색 |
| Ctrl+Shift+F | 전체 검색 |
| Ctrl+D | 같은 단어 다중 선택 |
| Alt+위/아래 | 줄 이동 |
| Ctrl+/ | 주석 토글 |
| Ctrl+` | 터미널 열기 |
| Ctrl+F | 파일 내 검색 |
| Ctrl+S | 저장 (자동 반영됨) |

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| DB | PostgreSQL (Supabase) |
| 배포 | Vercel |

---

## 작업 규칙

1. **pull 먼저** - 작업 전 항상 최신화
2. **dev에서 작업** - real 직접 수정 금지
3. **운영 DB 직접 수정 주의** - 테스트는 로컬에서
4. **저장하면 자동 반영** - Hot Reload 활용

---

## DB 권한

| DB | 누가 수정 | 비고 |
|----|----------|------|
| **운영 (Supabase)** | YYS만 | Claude 수정 금지 |
| **로컬 (개발용)** | Claude 가능 | 테스트/개발용 |

---

## 폴더 구조 (중요!)

| 폴더 | 상태 | 설명 |
|------|------|------|
| `cookies/` | **사용** | GitHub에 올린 것, 개발/배포용 |
| ~~`jewelry-shop/`~~ | **삭제됨** | 사용 안 함 |
| ~~`jewelry-adm/`~~ | **삭제됨** | 사용 안 함 |

**로컬 개발도 cookies 폴더에서!**

---

## 백업 정책

### 백업 시점
- 운영 반영 전 백업 (소스 + DB)

### 백업 폴더 구조
```
C:\Claude\10.etc\backup\cookies\
└── 2025\
    └── 12\
        ├── 2025-12-13_반영전\
        │   ├── shop\
        │   ├── adm\
        │   └── db_backup.sql
        └── 2025-12-20_반영전\
            └── ...
```

### 백업 내용
| 항목 | 포함 여부 |
|------|----------|
| 소스 코드 | O |
| DB 덤프 | O |
| node_modules | X (용량 큼, 재설치 가능) |

---

## ⚠ 다국어 처리 규칙 (매우 중요 — 위반 금지)

**shop은 JP/KO 이중 언어 UI. 어떤 문구도 언어별 대응이 누락돼선 안 된다.**

### 규칙

1. **DB에 언어별 컬럼이 이미 있으면 무조건 사용**
   - `products`: `name_ja`, `name_ko`, `description_ja`, `description_ko`, `category_ja`, `category_ko`
   - 렌더 시 `language === "ja" ? product.name_ja : product.name_ko` 패턴 준수
   - 절대 `product.name`만 쓰지 말 것 (원본 필드는 fallback용)

2. **DB에 단일 언어(주로 일본어)만 저장된 필드는 프론트 매핑 사전 사용**
   - 대표 예: `products.sub_category` (일본어만 저장 → [shop/src/app/page.tsx](web-dev/cookies/shop/src/app/page.tsx) 의 `SUB_CATEGORY_KO` 사전)
   - 새 값이 나올 때마다 사전에 한국어 대응 추가

3. **하드코딩 문구는 모두 `useLanguage().t()` 또는 삼항 분기**
   - 인라인 삼항: `{language === "ja" ? "送料無料" : "배송비 무료"}`
   - 재사용은 [LanguageContext.tsx](web-dev/cookies/shop/src/contexts/LanguageContext.tsx) 딕셔너리에 추가

4. **CREAM 등 브랜드/영문 표기는 언어 무관 그대로 유지**
   - CREAM, ACC, BAG, JEWELRY, SALE 등 영문 라벨은 두 언어 공용

5. **검수 방법**
   - 헤더 언어 스위처로 JP ↔ KO 토글하며 화면 정독
   - 특히 카테고리·서브카테고리·주문 폼·리뷰·푸터 순 확인

### 위반 시 결과
- 한국어 사용자에게 일본어 그대로 노출 → 신뢰도 하락
- YYS가 여러 번 강조 (2026-08-02 카테고리 서브 라벨 사고 발생)

### adm(관리자) 폼에서의 다국어 처리 규칙 (필수)

**adm에서 신규 콘텐츠를 등록/수정하는 모든 폼은 "한국어 · 일본어 자동 번역 버튼"을 필수 탑재.**

- **대상 폼**: 카테고리 관리, 상품 등록/수정, 리뷰 등록, 배너/공지 등록, 브랜드 소개 등 두 언어 컬럼(예: `name_ko` + `name_ja`)이 있는 모든 곳
- **번역 API**: [/api/ai/translate](web-dev/cookies/adm/src/app/api/ai/translate/route.ts) 사용 (Anthropic Claude, mock/real 자동 전환)
- **버튼 위치**: 각 언어 입력 필드 라벨 우측에 `🌐 → 일본어` / `🌐 → 한국어` 링크 배치
- **동작**: 원본 언어 입력 → 버튼 클릭 → API 호출 → 대응 필드에 자동 채움
- **선호**: 사장님이 두 번 타이핑하지 않도록 편의성 우선. 결과가 어색하면 수동 수정 가능

### 위반 시 결과 (adm)
- 사장님이 한국어·일본어 두 번 입력 → 노가다·오타 위험
- 편집 폼 하나에라도 번역 버튼 없으면 즉시 추가할 것

---

## 참고

- 프로젝트 컨텍스트: `C:\Claude\1.projects\web-dev.md`
- 학습 로드맵: `C:\Claude\study\nextjs-학습로드맵.md`

---
마지막 업데이트: 2025-12-13
