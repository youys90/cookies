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

## 참고

- 프로젝트 컨텍스트: `C:\Claude\1.projects\web-dev.md`
- 학습 로드맵: `C:\Claude\study\nextjs-학습로드맵.md`

---
마지막 업데이트: 2025-12-13
