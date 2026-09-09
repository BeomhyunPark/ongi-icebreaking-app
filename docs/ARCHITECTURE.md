# 코드 구조와 수정 위치

## 처음 수정할 때

실행 방법은 [개발 가이드](DEVELOPMENT.md), 버전·배포 규칙은 [RELEASING](../RELEASING.md)을 따른다.

| 수정할 내용 | 먼저 볼 곳 |
| --- | --- |
| 홈 노출·활동 이름·목적 분류 | `src/app/activityCatalog.ts`, `src/app/homeSections.ts`, `src/features/home/HomeScreen.tsx` |
| URL·활동 진입 | `src/app/activityNavigation.ts`, `ActivityRenderer.tsx`, `activityRegistry.ts` |
| 질문·후보·문구 데이터 | 해당 활동의 `data/` |
| 화면 배치·버튼 표시 | 해당 활동의 `screens/`, `components/`, `styles/` |
| 진행·초기화·이전 선택 | 해당 활동의 `state/`, 진행 hook |
| 새로고침 복원 | 해당 활동의 `services/*Storage.ts` |
| API·실시간 동기화 | `anonymous-sharing/api/`, `hooks/useSharingSession.ts`, `hooks/useRoomEvents.ts` |
| 공용 링크·이미지 공유 | `src/platform/shareLink.ts`, `src/platform/resultImage.ts` |
| 익명 나눔 API 규칙 | `backend/.../room`, `participant`, `response`, `sharing`, `session` |

## 책임과 의존 방향

```text
app/                         URL, 활동 등록, 활동별 props 연결
features/<activity>/
  <Activity>App.tsx          현재 단계에 맞는 화면 조립
  screens/, components/     화면 표시와 입력 이벤트
  hooks/                    API·저장·타이머와 사용자 동작 연결
  state/                    순수 상태 전이와 초기화
  domain/, data/            계산 규칙, 타입, 콘텐츠
  services/, api/           저장 직렬화, 통신, 이미지 처리
components/, platform/      활동과 무관한 공용 UI·브라우저 기능
```

- 다른 활동의 내부 구현을 직접 import하지 않는다. 홈의 활동 바로가기는 앱 셸이 `homeNavigation.ts`에서 링크로 변환한다.
- 공통 UI·플랫폼은 활동 내부에 의존하지 않는다. 활동 고유 이미지 이름·콘텐츠는 해당 활동이 소유한다.
- 화면에서 API를 호출하거나 저장소를 직접 수정하지 않는다. 네이티브 공유처럼 버튼·DOM 바인딩이 필요한 처리는 전용 hook/service에 위임한다.
- 도메인과 reducer는 React, DOM, 브라우저 저장소에 의존하지 않는다. 난수·타이머 같은 외부 효과는 분리한다.
- 무조건 클래스로 바꾸거나 모든 상태를 전역화하지 않는다. 함께 바뀌어야 하는 상태를 묶고 관련 없는 지역 UI 상태는 지역에 둔다.

## 활동별 진행 모델

- **흔적 찾기:** `state/testReducer.ts`가 질문·건너뛰기·동점·결과 전환을 소유한다. 점수 계산은 `domain/`에 있다.
- **모임 도구:** `domain/prepareDraw.ts`가 입력 검증과 실제 결과 생성을 담당한다. `state/pickerReducer.ts`는 설정 → 추첨 중 → 결과 및 사다리 공개 순서를 관리한다. 결과는 모드별 union이며 추첨 중/결과 단계에는 반드시 결과가 있다. hook은 추첨 애니메이션 1,600ms, 사다리 공개 1,100ms와 저장을 연결한다.
- **밸런스:** `state/balanceReducer.ts`가 질문 선택·시작·답변·이전/다음·완료·다시 보기를 담당한다. 시작할 질문이 없거나 답변하지 않은 경우 잘못된 진행을 거부한다.
- **익명 나눔:** 서버가 방 상태의 기준이다. `services/roomSnapshot.ts`가 필요한 데이터를 모으고 `useSharingSession`이 최신 요청만 적용한다. reducer는 스냅샷을 한 번에 적용한다. 입력 초안은 서버 재조회보다 우선하며 700ms 지연 저장과 직렬 저장 큐를 유지한다. 초기화·홈 이동·언마운트 후의 오래된 응답은 적용하지 않는다. 표시할 화면은 `domain/selectSharingScreen.ts`에서 결정한다. 사용자 명령은 `useAnonymousSharingController`에 있다.
- **월드컵:** `domain/tournament.ts`의 기존 계산을 유지한다. `useWorldCup`은 저장·이어하기·직전 선택 취소를 연결하고 화면은 단계별로 분리한다.
- **구르미:** `state/gureumiReducer.ts`가 복원·소개·질문·결과·피드백 단계와 요청 상태를 함께 소유한다. 결과/피드백 단계에는 결과와 시도 참조가 반드시 있다. `useGureumiController`는 API 요청을 연결하며 중복 명령과 언마운트 이후 응답을 차단한다. `useGureumiAnswers`는 답변별 저장 대기·실패 복원·응답 시간을 소유하고 초기화 이전 응답을 무시한다. 새 검사 시작 실패 시 기존 이어하기/결과는 보존한다. 서버 점수 계산은 변경하지 않는다.

## 저장소와 API 호환성

리팩터링만으로 키나 API 응답을 바꾸지 않는다. 저장소 데이터는 `unknown`으로 읽고 파싱 후 사용한다. 손상된 데이터는 정상 초기 상태로 복귀한다.

- `ongi.group-picker.session.v1.<mode>`: 기존 결과를 새 모드별 타입으로 읽는다. 쓰기 형식은 v2.3.0도 읽을 수 있는 v1 필드를 유지한다.
- `ongi.balance-game.session.v1.<weight>`: 기존 질문 ID·순서·선택·위치를 유지한다. 다른 대화 온도의 질문은 거부한다.
- 익명 나눔 초안의 저장 위치·만료와 방 참조 방식은 유지한다.
- 백엔드 도메인 오류는 `StateTransitionException.Reason`으로 구분한다. 서비스가 기존 HTTP 상태·문제 코드로 변환한다. 이번 변경에는 DB migration이 없다.

## 검증과 변경 순서

1. 수정할 규칙의 domain/reducer 테스트를 추가한다.
2. 해당 화면 흐름 테스트를 실행한다. 예: `npm test -- tests/groupPickerApp.test.tsx tests/pickerState.test.ts`.
3. `npm run verify`와 `cd backend && ./gradlew test`를 실행한다.
4. `npm run test:e2e`로 실제 브라우저의 모바일 폭·복원·동시 접속 흐름을 확인한다. 실행 조건과 범위는 [브라우저 테스트 가이드](BROWSER_TESTS.md)를 참고한다. 키보드 이동과 실제 기기 공유 동작도 점검한다.
5. 기능별 커밋 후 버전·태그·배포를 별도로 수행한다. 운영 DB나 기존 Git 태그를 덮어쓰지 않는다.

`tests/architectureBoundaries.test.ts`는 활동 간 직접 의존성과 도메인의 브라우저 의존성을 검사한다. 전체 테스트 개수는 고정 문서 숫자가 아닌 실제 검증 결과를 기준으로 한다.

## 남은 제약

앱 셸과 홈은 여전히 비교적 크다. 홈의 목적 분류는 카탈로그의 `intent`, 배치는 `group`을 기준으로 하며 ID 조건으로 새 분류를 추가하지 않는다. 구르미 피드백 설문의 입력과 내부 하위 화면은 지역 상태로 유지한다. 익명 나눔의 스냅샷은 여러 API 응답을 조합하므로 서버 트랜잭션 스냅샷을 의미하지 않는다. 새 기능이 이 경계를 넘어가면 통신 계약부터 검토하며, 파일을 더 잘게 나누는 것만을 목표로 하지 않는다.
