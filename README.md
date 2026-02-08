# Split Translate Reader

원문과 번역본을 나란히 볼 수 있는 Chrome Extension입니다.

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-orange.svg)

</div>

## 📖 소개

Split Translate Reader는 웹페이지의 원문과 번역본을 좌우 분할 화면으로 동시에 볼 수 있게 해주는 Chrome 확장 프로그램입니다. Chrome의 자동 번역 기능과 함께 사용하여 원문을 참조하면서 번역을 읽을 수 있습니다.

### ✨ 주요 기능

- **📄 Split View**: 원문(좌측)과 번역본(우측)을 동시에 표시
- **🔄 실시간 동기화**: 한쪽에서 텍스트를 드래그하면 반대쪽에서 해당 위치 하이라이트
- **🌐 자동 번역 통합**: Chrome 자동 번역 기능과 완벽한 호환
- **📱 탭별 독립 관리**: 각 탭마다 독립적으로 Split View 활성화/비활성화
- **🎨 시스템 테마 지원**: 라이트/다크 모드 자동 적용
- **🔍 드래그 하이라이트**: 드래그한 텍스트의 원문 위치를 자동으로 찾아 표시
- **📍 네비게이션 유지**: 페이지 내 링크 클릭 시에도 Split View 상태 유지

## 🚀 설치 방법

### 개발 모드로 설치 (권장)

1. **저장소 클론**
   ```bash
   git clone https://github.com/seungkeolkim/split-ranslate-reader.git
   cd split-ranslate-reader
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **빌드**
   ```bash
   npm run build
   ```

4. **Chrome에 로드**
   - Chrome 브라우저에서 `chrome://extensions/` 접속
   - 우측 상단의 "개발자 모드" 활성화
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - 프로젝트 폴더 선택

### 개발 모드 (Watch)

코드 수정 시 자동으로 다시 빌드:
```bash
npm run watch
```

## 📋 사용 방법

### 기본 사용법

1. **Split View 활성화**
   - 번역하고 싶은 페이지에서 확장 프로그램 아이콘 클릭
   - "Start Split View" 버튼 클릭
   - 좌측: 원문, 우측: 현재 페이지(번역 대상)

2. **Chrome 자동 번역 실행**
   - 우측 패널에서 우클릭
   - "한국어로 번역" 선택 (또는 원하는 언어)

3. **드래그 하이라이트**
   - 좌측(원문) 또는 우측(번역본)에서 텍스트 드래그
   - 반대쪽에서 해당 위치가 자동으로 하이라이트됨

4. **Split View 종료**
   - 확장 프로그램 아이콘 클릭
   - "Stop Split View" 버튼 클릭

### 고급 기능

#### 타겟 언어 변경
- Popup에서 "Target language" 선택
- 원하는 언어 선택 후 Chrome 번역 실행

#### 탭별 독립 관리
- 각 탭에서 독립적으로 Split View 활성화/비활성화 가능
- 탭 전환 시 각 탭의 상태가 유지됨

#### 페이지 내 네비게이션
- Split View 상태에서 페이지 내 링크 클릭 가능
- 새 페이지에서도 자동으로 Split View 재구성

## 🛠️ 기술 스택

- **TypeScript**: 타입 안정성과 개발 생산성
- **esbuild**: 빠른 빌드 속도
- **Chrome Extension Manifest V3**: 최신 Chrome Extension API
- **Chrome Storage API**: 탭별 상태 관리
- **Chrome Action API**: 동적 아이콘 상태 표시

## 📁 프로젝트 구조

```
split-translate-reader/
├── src/
│   ├── background/         # Background service worker
│   │   └── background.ts   # 탭 관리, 아이콘 업데이트, 로깅
│   ├── content/            # Content script
│   │   └── content.ts      # Split UI, 스냅샷 캡처, 드래그 하이라이트
│   ├── popup/              # Extension popup
│   │   ├── popup.html      # Popup UI
│   │   ├── popup.ts        # Popup 로직
│   │   └── popup.css       # Popup 스타일
│   └── shared/             # 공유 타입
│       └── types.ts        # TypeScript 타입 정의
├── icons/                  # Extension 아이콘
│   ├── icon-active-*.png   # 활성화 상태 (녹색)
│   └── icon-inactive-*.png # 비활성화 상태 (회색)
├── scripts/
│   └── build.mjs           # esbuild 빌드 스크립트
├── dist/                   # 빌드 결과물
├── manifest.json           # Chrome Extension manifest
├── package.json            # npm 설정
├── tsconfig.json           # TypeScript 설정
└── README.md               # 프로젝트 문서
```

## 🔧 개발 가이드

### 빌드 스크립트

```bash
# 프로덕션 빌드
npm run build

# Watch 모드 (개발 중 자동 재빌드)
npm run watch
```

### 주요 컴포넌트

#### 1. Background Service Worker (`src/background/background.ts`)
- 탭 ID 관리
- 아이콘 상태 업데이트 (활성화/비활성화)
- 로그 수집 및 관리
- 탭 종료 시 Storage 정리

#### 2. Content Script (`src/content/content.ts`)
- Split UI 생성 및 관리
- 원문 스냅샷 캡처
- 드래그 하이라이트
- 네비게이션 감지 및 자동 재구성
- 스크롤 동기화

#### 3. Popup UI (`src/popup/`)
- Split View 토글 버튼
- 상태 표시 (Active/Inactive)
- 타겟 언어 선택

### 아키텍처 설계

#### Strategy 1: Snapshot 기반 원문 보존
- 페이지 로드 시 원본 HTML을 캡처
- Chrome 번역이 적용되기 전의 상태를 보존
- iframe에서 원문을 독립적으로 렌더링

#### Strategy 2: 블록 단위 매핑
- 텍스트 블록을 선택자로 식별 (`p`, `li`, `h1-h6`, `td`, `th`, `div`, `span` 등)
- innerText 길이 20자 이상 필터링
- 화면에 보이는 요소만 매핑

#### Strategy 3: Navigation 감지
- `popstate` 이벤트 감지 (뒤로가기/앞으로가기)
- `history.pushState/replaceState` 훅킹 (SPA 라우팅)
- URL 변경 폴링 (fallback)
- 페이지 이동 시 자동 Split View 재구성

## 🎨 UI/UX 특징

### 아이콘 상태 표시
- **녹색 (#35a324)**: Split View 활성화
- **회색 (#6C757D)**: Split View 비활성화

### 컬러 테마
- 시스템/브라우저 설정 자동 반영
- 라이트 모드/다크 모드 완벽 지원
- Split 전후 일관된 테마 유지

### 드래그 하이라이트
- **좌측(원문)**: 주황색 하이라이트 `rgba(255,200,120,0.5)`
- **우측(번역본)**: 파란색 하이라이트 `rgba(180,220,255,0.45)`

## 🐛 알려진 제한사항

### MVP 단계의 제한사항
- 좌측(원문) → 우측(번역본) 하이라이트만 지원
- 우측(번역본) → 좌측(원문) 매핑은 향후 개선 예정
- 일부 동적 컨텐츠가 많은 사이트에서는 스냅샷 캡처 타이밍 이슈 가능

### 브라우저 호환성
- Chrome/Edge (Manifest V3 지원 브라우저만)
- Firefox는 현재 미지원 (Manifest V3 구현 차이)

## 🛣️ 로드맵

### v0.2.0 (계획)
- [ ] 우측(번역본) → 좌측(원문) 역방향 하이라이트
- [ ] 하이라이트 지속 모드 (클릭 시 고정)
- [ ] Split Pane 크기 조절 핸들
- [ ] 키보드 단축키 지원

### v0.3.0 (계획)
- [ ] 스크롤 동기화 개선
- [ ] 성능 최적화 (throttling)
- [ ] 다양한 페이지 구조 지원 확대
- [ ] 사용자 설정 저장

### v1.0.0 (계획)
- [ ] Chrome Web Store 배포
- [ ] 다국어 지원 (i18n)
- [ ] 사용자 매뉴얼 및 튜토리얼
- [ ] 고급 설정 페이지

## 🤝 기여하기

기여를 환영합니다! 버그 리포트, 기능 제안, Pull Request 모두 환영합니다.

### 기여 가이드라인
1. 이슈를 먼저 생성하여 논의
2. 브랜치 생성: `feature/기능명` 또는 `fix/버그명`
3. 커밋 메시지는 한국어로 명확하게 작성
4. PR은 main 브랜치로 생성
5. 코드 리뷰 후 병합

### 커밋 메시지 규칙
- `feat:` - 새로운 기능 추가
- `fix:` - 버그 수정
- `docs:` - 문서 수정
- `style:` - 코드 포맷팅
- `refactor:` - 코드 리팩토링
- `test:` - 테스트 추가/수정
- `chore:` - 빌드/설정 변경

## 📄 라이선스

MIT License

## 👤 작성자

**seungkeolkim**
- GitHub: [@seungkeolkim](https://github.com/seungkeolkim)

## 🙏 감사의 말

이 프로젝트는 다음 기술들을 사용하여 만들어졌습니다:
- Chrome Extension API
- TypeScript
- esbuild
- And many other open source projects

---

<div align="center">

**⭐ 이 프로젝트가 도움이 되었다면 Star를 눌러주세요! ⭐**

</div>
