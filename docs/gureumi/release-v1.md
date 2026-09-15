# 구르미 공개 전환 1차 작업 기록

- 작업일: 2026-09-15
- 브랜치: `master` (전환하지 않음)
- 배포 대상: 온기 `v2.6.0`. 2026-09-15 사용자가 현재 작업본 배포를 승인했다. 최초 구현 단계의 커밋·배포 금지 요청은 이 후속 요청으로 해제되었다.
- 배포 경로: `master` 반영 → GitHub Actions 전체 검증 → GitHub Pages. 실제 성공 여부와 실행 시각은 [배포 실행 기록](https://github.com/BeomhyunPark/ongi-icebreaking-app/actions/workflows/pages.yml)에서 해당 릴리스 커밋 기준으로 확인한다.
- 사용자 추가 문서 `gureumi-v1-codex-batch-1.md`, `gureumi-v1-release-plan.md`는 수정하지 않았다.
- 후속 사용자 지시 “피드백 받는거 다 없애버려”에 따라 원래 인라인 공감도 요구를 취소하고 공개 피드백 수집 UI 전체 제거로 범위를 변경했다.

## 변경 범위와 파일

- `src/app/activityCatalog.ts`, `src/app/shareTargets.ts`: 공개 이름·27문항·공유 설명 정리, Beta 배지와 근거 없는 소요시간 제거. 기존 공유 URL 유지.
- `src/features/home/HomeScreen.tsx`, `styles/home.css`: 홈에서 흔적 찾기와 구르미를 동일한 테스트 목록으로 구성하고 놀거리와 분리. `src/app/homeSections.ts`의 분류 및 추천 대상도 맞춤. 기존 `sunny.png`를 목록 아이콘으로 표시.
- `src/features/gureumi/screens/GureumiIntroScreen.tsx`, `GureumiQuestionScreen.tsx`, `GureumiResultScreen.tsx`: 소개 제목·시작 CTA·고지 정리. 결과 하단에 재검사 버튼 유지. 이론 참고 설명과 제작자 크레딧 보존.
- `src/features/gureumi/screens/GureumiFeedbackFlow.tsx`: 삭제. 공감도·헷갈린 문항·직접 고른 유형·후속 설문·자유의견 수집 화면 제거.
- `src/features/gureumi/GureumiApp.tsx`, `hooks/useGureumiController.ts`, `state/gureumiReducer.ts`, `api/gureumiApi.ts`, `domain/types.ts`, `styles/gureumi.css`: 피드백 진입·상태·저장 호출·입력 타입·전용 스타일 제거.
- `src/features/gureumi/services/kakaoShare.ts`: 공유 CTA를 “테스트하러 가기”로 정리.
- `tests/gureumiFeedbackFlow.test.tsx`: 기존 설문 제출 테스트를 수집 UI 부재 및 공유·이미지 저장·재검사·홈 이동 회귀 테스트로 교체. 공유·이미지 동작은 mock으로 검증.
- `tests/gureumiTeaser.test.tsx`, `gureumiState.test.ts`, `gureumiKakaoShare.test.ts`, `activityShare.test.tsx`, `shareTargets.test.ts`: 공개 문구, 기존 공감도 포함 결과 복원, 피드백 요청 부재와 유지되는 동작 확인.
- `e2e/gureumi.spec.ts`: 기존 27문항 완료·답변 이어하기·새로고침 결과 복원·재검사 흐름 재사용. 피드백 UI 및 요청 부재, 공유·이미지 버튼 이용 가능, 8종 소개 확인.
- `e2e/activities.spec.ts`: 홈 카드의 새 접근성 이름 반영.
- `README.md`, `public/images/teasers/gureumi-test/README.md`, 이 문서: 현재 콘텐츠와 자산 사용처, 검증 및 남은 작업 기록. 과거 Beta 검증 문서는 보존.

## 버전·데이터·API 호환성

공개 v1.0은 콘텐츠 공개 상태를 의미한다. 문항과 채점은 같으므로 내부 검사 코드 `GUREUMI_BETA_V01`, 기존 `version_id`와 저장 키를 유지했다. 후속 버전 관리 요청에 따라 온기 앱 버전은 `2.5.1`에서 `2.6.0`으로 올렸다. `package.json`, lockfile의 루트 버전, `backend/build.gradle`, `public/sw.js`, `CHANGELOG.md`, `releaseHistory.ts`를 동기화했다. 앱 릴리스는 `v2.6.0` 태그로 구분한다.

`git diff`상 backend 소스 전체(빌드 파일의 앱 버전만 변경), 적용된 migration, 문항 seed, `GureumiScoring`, 8유형 매핑 및 결과 콘텐츠 `src/features/gureumi/data/results.ts`, 결과 저장 이미지는 변경이 없다. 문항 화면은 헤더의 Beta 문구만 수정했다. 27문항의 문구·순서·선택지·축·highSide·점수·cutoff·near-boundary, 진행 중 attempt 버전과 완료 결과를 변경하거나 재계산하지 않았다. 프런트에 문항별 채점 메타데이터를 추가하지 않았다.

새 공개 클라이언트에는 인라인 공감도와 상세 피드백 저장 경로가 모두 없다. 따라서 공감도·상세 의견·후속 설문이 서로를 덮어쓰는 새 호출도 발생하지 않는다. 기존 DB 기록과 내부 관리자 통계는 보존한다. 결과 응답의 선택적 `feedbackRating`도 수신 호환성을 유지하되 화면에는 입력을 노출하지 않는다.

기존 서버 `PUT .../feedback`, `PUT .../feedback/follow-up`은 구버전 클라이언트 호환용으로 유지했다. **서버의 피드백 접수 자체를 차단한 변경은 아니다.** API 추가, 기존 누락값의 의미 변경, schema migration은 없다. 기존 quick endpoint는 여전히 quick 필드를 함께 덮어쓰므로 구버전 호출에서 rating 단독 업데이트 시 상세 quick 값이 초기화될 수 있는 기존 계약도 그대로다. 이번 클라이언트는 해당 API를 호출하지 않는다.

내부 통계 URL `gureumi-beta-stats`와 통계 계산은 변경하지 않았다. 기존 구현은 `count(feedback.rating)`과 `avg(feedback.rating)`으로 공감도 없는 기록을 제외하며, 공감도 응답 수/완료 수와 전체 피드백 존재 funnel을 구분한다.

## 실제 검증

| 명령 | 결과 | 검증 구분 |
|---|---|---|
| `npm run typecheck` | 통과 | TypeScript |
| `npm run verify` | 55개 파일, 287개 테스트 및 production build 통과 | Vitest: 단위·jsdom·mock 포함 |
| `(cd backend && ./gradlew test)` | 38개 테스트 통과, 실패·건너뜀 0 | 실제 Spring/MockMvc + Testcontainers PostgreSQL 통합 및 단위 테스트 |
| `npm run test:e2e -- e2e/gureumi.spec.ts` | Chromium 데스크톱·모바일 에뮬레이션 2개 통과 | 로컬 실제 backend + 격리 테스트 DB |
| `npm run test:e2e -- e2e/activities.spec.ts --grep 'home filters and narrow layouts'` | 데스크톱·모바일 에뮬레이션 2개 통과 | 홈 필터·좁은 레이아웃 |
| `npm run test:e2e -- e2e/activities.spec.ts --grep 'home filters and narrow layouts\|built app, release history'` | 데스크톱·모바일 4개 통과 | 최종 홈 분류·필터 및 v2.6.0 표시·업데이트 내역·서비스워커 일치 |
| `git diff --check` | 통과 | 공백 오류 |

백엔드 통과에는 기존 `GureumiScoringTest` 5개(정/역채점, 축별 경계, 8조합)와 `GureumiIntegrationTest` 5개(문항·답변·완료·기존 피드백·버전·통계)가 포함된다. 모든 경계값에 대한 새 테스트나 8개 합성 프로필의 전체 API 검증을 추가한 것은 아니다.

초기 타입 검사는 삭제된 화면을 참조하던 테스트와 Testing Library의 잘못된 `exact` 옵션으로 실패했고 수정 후 통과했다. 초기 E2E도 타입 오류, 이후 샌드박스의 서버 실행 제약으로 시작하지 못했다. Gradle은 샌드박스에서 캐시 잠금 파일을 쓰지 못했다. 승인된 외부 실행에서 Gradle과 E2E를 재실행해 통과했다. Docker 불가 메시지는 샌드박스 내부 관찰이었으며 최종 외부 실행에서는 Testcontainers DB를 사용했다.

생성된 `dist/share/gureumi/index.html`의 description·OG·Twitter description에 새 공유 설명이 반영됨을 확인했다. 외부 네트워크 차단 E2E fixture는 변경하지 않았다. 카카오 공유 버튼 표시나 mock 호출 성공을 실제 카카오톡 송수신 성공으로 간주하지 않는다. 후속 결과 버튼 수정은 기존 동작 테스트 3개와 mock 결과를 사용한 320px·430px 브라우저 캡처로 확인했다. 홈 분류는 320px·390px 캡처로 확인했고 320px에서 가로 넘침이 없었다.

## 개발 단계 미실행 검증 및 잔여 확인

- **공유 이미지 문구 수정 필요:** `public/images/share/gureumi-v1.png`를 직접 확인했으며 이미지 내부에 `GUREUMI TEST · BETA`가 남아 있다. `scripts/GenerateShareImages.java`에는 구르미 생성 대상이 없고 관련 자산 문서에서도 재생성 소스를 찾지 못했다. 기존 소스/제작 절차로 해당 PNG를 수정한 뒤 OG 캐시를 확인해야 한다. 임의 이미지 생성·폰트 교체는 하지 않았다. 공개 Beta 표기 정리의 잔여 작업이다.
- 실제 iPhone Safari/Android/카카오톡 인앱에서 터치, 이미지 저장, 카카오 송수신과 링크 복귀 미실행. 모바일 E2E는 에뮬레이션이다.
- 운영 환경의 active version/27문항 seed, 도메인·카카오 SDK 키·공유 미리보기 캐시·통계 보호 설정 미확인. 운영 DB·secret·환경변수 조회/변경 및 테스트 데이터 생성 없음.
- 로컬에서는 전체 E2E 모음 미실행. 구르미·홈·버전 일치 시나리오를 실행했으며 배포 workflow에서 전체 E2E를 수행한다.
- `lint` script가 없어 lint는 미실행. 신규 패키지 설치와 lint 체계 추가 없음.
- 인라인 공감도 저장·재시도·인가·상세 의견 상호 보존에 대한 신규 테스트는 수집 기능 제거로 요구가 취소되어 추가하지 않았다. 기존 backend 계약 테스트는 유지하고 실행했다. 후속 `2.6.0` 빌드 버전 변경 이후 backend 전체 테스트는 반복 실행하지 않았으며, 홈·버전 E2E에서는 backend를 다시 빌드해 기동했다.

## 배포·복구

이번 변경은 frontend만 배포하면 적용되며 backend 선행 배포나 DB migration이 필요하지 않다. 기존 API를 유지하므로 구버전 클라이언트가 계속 저장할 수 있다. 서버 접수 중단까지 필요하면 별도 범위로 명시해야 한다.

frontend를 이전 버전으로 rollback하면 피드백 수집 UI가 다시 나타난다. 기존 기록은 삭제하지 않았으므로 데이터 복구 작업은 필요하지 않다. 적용 코드는 `v2.6.0` 태그로 구분하고 공개 시각·실행 결과는 해당 커밋의 GitHub Actions 배포 기록을 기준으로 확인한다.

### 데스크톱 카드 모서리 후속 수정

단일 카드에 `:first-child`와 `:last-child`가 모두 적용되면서 위쪽 radius가 0이 되던 충돌을 `:only-child` 규칙으로 수정했다. 로컬 Chromium 1440px hover 상태에서 수정 전 0px/23px였던 위·아래 모서리가 수정 후 모두 23px인 것과 화면을 확인했다. 320px 단일 카드와 두 테스트 목록도 캡처 확인했다. CSS 수정으로 전체 테스트는 반복 실행하지 않았고 `git diff --check`는 통과했다. v2.6.0 변경에 포함하며 모서리 수정만을 위한 추가 버전은 만들지 않는다.
