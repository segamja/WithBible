# with BIBLE 디자인 명세서 (Final)

## 1. 브랜드 아이덴티티
- **앱 이름**: with BIBLE (위드바이블)
- **핵심 슬로건**: "함께 읽는 말씀, 함께 자라는 우리"
- **디자인 컨셉**: Modern Christian, Youth Community, Warm, Social, Habit-forming.
- **로고**: {{DATA:IMAGE:IMAGE_5}} (열린 성경과 연결된 공동체를 형상화한 Deep Navy 심볼)

## 2. 컬러 시스템
- **Primary**: Deep Navy (`#172033`) - 주요 텍스트, 브랜드 강조
- **Background**: Warm White (`#FAF9F6`) - 전체 배경
- **Surface**: White (`#FFFFFF`) - 카드 및 섹션 배경
- **Accent (Success)**: Soft Sage (`#6FA58A`) - 진행률, 완료 상태
- **Accent (Secondary)**: Soft Sky (`#8CA9C8`) - 보조 버튼, 정보 표시
- **Highlight (Streak)**: Warm Yellow (`#F2C86B`) - 연속 읽기(Streak), 축하 애니메이션

## 3. 타이포그래피 (Pretendard)
- **Display**: 32~36px, Bold (인사말, 큰 숫자)
- **Page Title**: 24~28px, Bold
- **Body**: 15~16px, Regular
- **Caption**: 12~14px, Medium

## 4. 주요 화면 구성 및 UX 원칙
- **학생 홈 ({{DATA:SCREEN:SCREEN_92}})**: 
  - 앱 실행 후 1초 이내에 '오늘 읽을 분량'과 '우리 반 진행률' 확인 가능.
  - 원탭(One-tap) 인증 버튼으로 즉시 촬영 단계 진입.
- **말씀 인증 ({{DATA:SCREEN:SCREEN_57}})**:
  - 사진 인증은 반드시 **읽은 성경 본문**이어야 함 (얼굴 사진 지양).
  - 인증 완료 시 Streak(연속 읽기) 카운트 증가와 반 공동 게이지 실시간 반영.
- **우리반 대시보드 ({{DATA:SCREEN:SCREEN_91}})**:
  - 개인의 성과보다 '우리 반이 함께 걷고 있는 여정'을 시각화.
  - 공동 Streak를 통해 소속감과 동기부여 강화.
- **피드 및 응원 ({{DATA:SCREEN:SCREEN_93}})**:
  - Instagram과 유사한 친숙한 UI.
  - '좋아요' 대신 '응원하기(🙌)' 기능을 사용하여 신앙 공동체적 유대감 강조.

## 5. 컴포넌트 가이드
- **Card**: 20~24px의 넉넉한 Radius, 매우 약한 Shadow 사용.
- **Progress Bar**: Soft Sage 컬러의 넓은 수평 바 또는 원형 링 형태.
- **Navigation**: 하단 5개 메뉴 (홈, 인증, 우리반, 피드, 마이).
