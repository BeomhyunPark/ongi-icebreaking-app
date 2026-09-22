# 구르미 테스트 v1.0 정식 출시 계획

- 작성일: 2026-09-14
- 대상: OnGi / `BeomhyunPark/ongi-icebreaking-app`
- 성격: 출시 요구사항 및 검증 체크리스트. 실제 배포 완료 보고서가 아니다.
- 검토 범위: GitHub 기본 브랜치 `master`의 지정 파일, 사용자가 제공한 통계 스크린샷 3장, 8유형 정의 문서.
- 미수행: 코드 수정, 로컬 테스트 실행, 운영 DB 조회, 실제 모바일·카카오톡 테스트, 커밋·푸시·배포.
- 판정: **출시 전환 작업 진행. 최종 공개 승인은 필수 검증 후 결정.**

## 1. 이번 출시의 범위

기존 구르미 테스트를 놀이형 자기이해 콘텐츠로 정식 공개한다. 정식 TCI 검사, 심리 진단 도구 또는 검증된 성격 평가 도구로 출시하는 것이 아니다. [R1, R2]

이번에는 문항과 점수 체계를 다시 설계하지 않는다. 공개 화면의 Beta 흔적, 공감도 응답 동선, 기존 기능의 회귀 검증, 배포·복구 절차를 정리한다.

다음은 이번 범위에서 제외한다.

- 8유형 비율을 균등하게 만들기 위한 cutoff·문항·역채점 변경
- 새 캐릭터, 새 검사 축, 러닝 테스트, 회원가입, 대시보드 전면 재구축
- 서비스 전체 리팩터링, 패키지 일괄 업데이트
- 기존 결과 재계산, 운영 데이터 삭제, 과거 migration 덮어쓰기
- 사용자 승인 없는 커밋·푸시·배포·운영 환경변수 변경

## 2. 확인된 기반과 아직 확인하지 않은 것

`구현 확인`은 소스에서 해당 처리를 읽었다는 뜻이며, 현재 운영 환경에서 성공적으로 실행됨을 보증하지 않는다.

| 항목 | 확인 결과 | 근거 | 남은 확인 |
|---|---|---|---|
| 문항 구성 | 서비스 상수 27문항·축별 9문항, 완료 시 답변·축 구성 검증 구현 | R3 | 실제 seed와 운영 active version의 구성 |
| 서버 채점 | 답변 저장과 완료 시 서버가 choice·highSide로 점수 계산 | R3, R4 | API 통합 실행 |
| 분류 기준 | 축별 9~22 LOW, 23~36 HIGH, 21~24 near-boundary | R4 | 아래 전체 경계값 회귀 검증 |
| 8유형 매핑 | 코드 및 8조합 단위 테스트 존재 | R4, R5 | 실제 문항·답변·완료 API를 잇는 8개 합성 프로필 |
| 답변 변경 제한 | 완료 후 답변 수정 차단, 완료 재요청 시 기존 결과 반환 구현 | R3 | 동시 요청·저장 지연 시나리오 |
| 문항 공개 응답 | ID·순서·상황·A/B 문장으로 구성 | R3 | API·빌드 산출물에서 채점 메타데이터 유출 여부 |
| 버전 연결 | attempt가 자신의 test version을 참조 | R3, R6 | 진행 중·완료된 베타 기록의 회귀 검증 |
| 이어하기·재검사 | 화면 연결 및 관련 E2E 테스트 존재 | R7, R8 | 저장 실패·토큰 유실·실제 브라우저 테스트 |
| 공감도·후속 설문 | 1~4 공감도와 상세 피드백 화면/저장 처리 존재 | R3, R9 | 인라인 공감도 도입 시 다른 피드백 보존 |
| 이미지·카카오 공유 | 결과 이미지 저장 버튼, 카카오 SDK·기기 공유·복사 fallback 구현 | R10, R11 | 운영 도메인과 실제 기기에서 송수신·저장 |
| 내부 통계 보호 | 관리자 키·익명 집계·no-store 정책이 구현 문서에 명시 | R6 | 실제 보호 코드와 API 응답 검증 |
| 테스트 명령 | frontend verify/typecheck/E2E, backend Gradle test 경로 확인 | R12, R13 | 실제 실행 및 결과 기록 |

### 버전 관련 주의

현재 `GureumiScoring`은 공통 계산 클래스로 LOW/HIGH 기준을 갖는다. attempt에 버전이 연결된다는 사실만으로 향후 서로 다른 채점 알고리즘까지 자동 격리된다고 단정하지 않는다. 이번 출시에서는 채점 코드를 바꾸지 않는다. 향후 채점 변경은 버전별 계산 정책까지 별도 설계·검증해야 한다. [R3, R4]

## 3. 파일럿 스냅샷

사용자가 제공한 2026-09-14 스크린샷의 표시값이다. 운영 DB를 직접 조회한 결과가 아니다.

- 화면 표본/완료 기준: 34건
- 공감도 유효 응답: 4건
- 공감도 평균: 3.50 / 4
- 완료 대비 공감도 응답률: 11.8%
- 공감도 분포: 1점 0건, 2점 0건, 3점 2건, 4점 2건

34건을 중복 없는 34명의 고유 사용자로 확정하지 않는다. 스크린샷에는 적용된 version·재검사 포함 여부 등 필터 전체가 보이지 않는다. 분석 기간, started 수, 전체 완료율, 완료 소요시간 중앙값도 확인되지 않는다.

| 유형 | 완료 건수 | 표시 비율 |
|---|---:|---:|
| 아롱이 | 5 | 14.7% |
| 달몽이 | 2 | 5.9% |
| 후우 | 8 | 23.5% |
| 쨍이 | 2 | 5.9% |
| 촉촉이 | 8 | 23.5% |
| 몽실이 | 1 | 2.9% |
| 찌릿이 | 0 | 0.0% |
| 포근이 | 8 | 23.5% |

| 축 | HIGH | LOW | near-boundary | 평균 점수 |
|---|---:|---:|---:|---:|
| 새로움 | 15 / 44.1% | 19 / 55.9% | 8 / 23.5% | 21.85 |
| 걱정 | 24 / 70.6% | 10 / 29.4% | 6 / 17.6% | 24.00 |
| 관계 | 22 / 64.7% | 12 / 35.3% | 9 / 26.5% | 23.68 |

유형별 건수를 정의 문서의 축 조합으로 다시 더하면 새로움 HIGH 15건, 걱정 HIGH 24건, 관계 HIGH 22건으로 화면의 축 집계와 일치한다. 이는 집계 간 산술적 정합성 확인일 뿐, 개별 응답 채점이나 문항 타당성의 검증은 아니다.

찌릿이 0건은 관찰 항목이다. 현재 표본만으로 분류 오류 또는 유형의 희귀성을 확정하지 않는다. 공감도 3.50점도 4건의 자기보고 응답 요약이며 정확도·신뢰도·타당도 수치가 아니다.

## 4. 출시 정책

### 4.1 공개 버전과 내부 검사 버전을 구분한다

공개 제품 상태는 정식 공개 v1.0으로 전환하되, 문항·선택지·구성·점수 규칙이 동일하면 이번 작업에서 내부 검사 코드 `GUREUMI_BETA_V01`과 기존 version_id를 이름 때문에 변경하지 않는다.

정식 공개 시각과 적용 커밋, 내부 검사 코드를 출시 기록에 함께 남긴다. 공개 버전과 내부 검사 코드는 서로 다른 목적이다. 온기 전체 `package.json`의 버전도 구르미 출시를 이유로 `1.0.0`으로 되돌리지 않는다.

실제 문항이나 점수 규칙을 바꿀 필요가 발견되면 출시 전환과 분리해 검토하고 새 검사 버전으로 처리한다. 진행 중 attempt는 시작 버전을 유지하며 기존 완료 결과를 소급 변경하지 않는다. [R6, R14]

### 4.2 관찰을 위해 보정을 보류하되 오류는 즉시 고친다

유형 분포를 예쁘게 만들기 위한 조정은 보류한다. 계산 오류, 권한 누락, 데이터 유실, 잘못된 버전 연결은 표본 수와 관계없이 수정 대상이다.

100건 등의 점검 지점은 운영상 검토 시점으로 사용할 수 있지만, 그 건수를 달성했다고 검사의 품질이 입증되는 것은 아니다.

### 4.3 고유 사용자와 재검사를 과장해 식별하지 않는다

기본 cohort는 문서에 정해진 `해당 검사 버전 + 완료 응답 + 첫 attempt` 기준을 확인해 사용한다. 이전 토큰을 보유한 재검사와, 다른 브라우저·저장소 초기화 후의 새 attempt를 동일하게 식별할 수 있다고 주장하지 않는다. [R3, R6]

베타 전후 비교는 같은 필터를 적용하고, 경계 시각을 기준으로 시작한 기록과 완료한 기록 중 무엇을 기준으로 삼았는지 적는다. 정확한 구분이 지원되지 않으면 혼합 cohort라고 명시한다. 단순 날짜 비교를 위해 새 분석 플랫폼이나 식별자를 추가하지 않는다.

## 5. 1차 구현: 공개 전환과 공감도 동선

### 5.1 공개 화면의 Beta 표시 정리

소스에서 확인한 대상:

- `GureumiIntroScreen.tsx`: BETA v0.1, BETA 1, Beta 테스트 시작하기, Beta 테스트 안내
- `GureumiResultScreen.tsx`: BETA 1 피드백 안내
- `GureumiFeedbackFlow.tsx`: BETA 1 화면 표기
- `src/app/shareTargets.ts`: 구르미 공유 설명의 Beta
- `README.md`: Beta 링크·소개 및 '다음 이야기' 위치
- 홈의 구르미 카드·공개 teaser·실제로 사용되는 정적 공유 메타데이터: 필요한 위치만 추적하여 확인

내부 enum, 검사 코드, API, 기존 `gureumi-beta-stats` 경로, 과거 베타 기록 문서는 무작정 이름을 바꾸지 않는다. 이미 공유된 주소와 이미지 자산 경로를 깨뜨리지 않는다. [R2, R9, R10, R15, R16]

공개 문구 기준:

| 위치 | 문구 |
|---|---|
| 콘텐츠 이름 | 구르미 테스트 |
| 소개 제목 | 나는 어떤 구르미일까? |
| 소개 | 27개의 선택을 따라가며 나와 닮은 구르미를 만나보세요. |
| 기본 CTA | 테스트 시작하기 |
| 문항 수 | 27문항 |
| 공유 설명 | 27개의 선택으로 만나는 나의 구르미. 서로 다른 반응을 가볍게 알아보세요. |
| 공유 CTA | 테스트하러 가기 |
| 간단한 공감도 질문 | 결과가 나와 얼마나 비슷했나요? |
| 추가 피드백 진입 | 자세한 의견 남기기 |
| 고지 | 놀이형 자기이해 콘텐츠이며, 정식 TCI 검사나 심리 진단이 아닙니다. |

현재 소개의 '약 4~5분'은 실측 근거를 이번 검토에서 확인하지 못했다. 완료시간 중앙값 등 근거가 확인되기 전에는 새 시간을 추정하지 말고 '27문항'만 표시한다. 이론 참고 범위와 기존 제작자 크레딧은 보존한다.

### 5.2 결과 화면에 공감도만 바로 남기기

현재 피드백 진입은 결과의 긴 설명·이미지 저장·공유 영역 이후에 있고, 별도 피드백 화면을 연다. 낮은 응답률의 원인을 이것으로 단정할 수는 없지만, 단계를 줄일 개선 후보로 본다. [R9, R10]

결과 설명의 핵심을 읽은 뒤, 하단 공유 행동 전에 작은 공감도 영역을 둔다. 기존 레이아웃·캐릭터·Typography·색감을 유지한다. 강제 모달, 전체 화면 설문, 공유 전 필수 응답을 추가하지 않는다.

선택값:

- 1: 전혀 비슷하지 않아요
- 2: 별로 비슷하지 않아요
- 3: 조금 비슷해요
- 4: 많이 비슷해요

동작:

- 아무것도 미리 선택하지 않는다. 기존 저장값이 있으면 그 값만 복원한다.
- 탭하면 같은 완료 attempt에 저장한다. 별도 제출 화면으로 이동하지 않는다.
- 저장 중, 성공, 실패를 구분한다. 성공 예: '의견 고마워요.'
- 실패를 성공처럼 보이지 않게 하고 다시 시도할 수 있도록 한다.
- 수정 입력은 같은 기록을 갱신한다. 요청 순서가 뒤바뀌어 최신 선택을 덮어쓰지 않게 한다.
- 공유, 이미지 저장, 재검사, 홈 이동은 공감도 미응답이어도 가능하다.
- 헷갈린 문항·직접 고른 구르미·후속 설문은 '자세한 의견 남기기'에서 계속 제공한다.

**데이터 보존 주의:** 현재 `saveFeedback()`은 누락된 confusingQuestionOrders를 빈 목록으로 만들고 rating·selfSelectedResultType 등 quick 필드를 함께 갱신한다. rating만 보내는 인라인 기능을 그대로 붙이면 기존 추가 의견이 지워질 수 있으므로 반드시 확인·수정한다. rating 전용 최소 update 경로를 사용하거나, 기존 계약을 보존하는 명확한 부분 갱신을 구현한다. DB 구조 전체 개편은 하지 않는다. [R3]

공감도 통계 분모는 `rating이 실제로 있는 응답 건수`와 `완료 건수`를 구분한다. 상세 의견만 제출한 기록을 공감도 점수로 채우거나 0점 처리하지 않는다.

### 5.3 첫 배치에서 건드리지 않을 후속 검토 사항

- 결과 지도 막대는 실제 점수가 아니라 HIGH 88%·LOW 34%라는 고정 길이를 사용한다. 현재 백분율 수치를 사용자에게 표기하는 것은 아니지만, 실제 점수로 오해되는지 검토한다. 별도 UX 결정 없이 백분위·정확도·임의 점수를 새로 표시하지 않는다. [R10]
- 상세 피드백의 selfSelectedResultType은 현재 산출 결과로 초기화된다. 이를 사용자의 독립적인 선택이나 자발적 유형 일치 응답이라고 분석하려면 명시적 선택 여부를 구분해야 한다. 이번 공감도 개선과 분리한다. [R9]
- 이 변경들은 채점 오류가 확인된 것이 아니며 문항이나 유형 비율을 수정하는 근거가 아니다.

## 6. 정식 공개 전 필수 검증

상태는 `미실행 / 통과 / 실패 / 환경상 미실행` 중 하나로 적고, 실행 명령·환경·결과 증거를 남긴다. 코드와 테스트 파일의 존재를 통과로 처리하지 않는다.

| ID | 검증 항목 | 통과 기준 | 현재 상태 |
|---|---|---|---|
| G01 | 실제 문항과 8유형 | 버전에 속한 27개 문항으로 만든 합성 응답 8세트가 완료 API에서 각각 기대 유형으로 매핑 | 미실행 |
| G02 | 채점·경계 | 정/역방향 4선택 모두 및 9·20·21·22·23·24·25·36, 범위 밖 값 거부 | 미실행 |
| G03 | 이어하기·기존 결과 | 새로고침·종료 후 재방문으로 저장된 답 복원, 기존 베타 결과 유지, 다른 기기 복원은 약속하지 않음 | 미실행 |
| G04 | 실패·재시도·완료 중복 | 저장 실패 시 다음/완료를 성공 처리하지 않음, 누락 응답 완료 차단, 완료 중복 시 결과 불변 | 미실행 |
| G05 | 개인 attempt 보호 | 타 attempt ID와 다른 resume token의 조합으로 질문·상태·답변 변경·결과·피드백 접근 불가 | 미실행 |
| G06 | 공개 응답·관리자 보호 | 질문에 axis·highSide·score 규칙 미노출, 관리자 키 없음/불일치 시 통계 차단, 토큰·키가 공개 URL·로그·통계에 섞이지 않음 | 미실행 |
| G07 | 공감도 갱신 | 기존 공감도 복원, 무선택·1~4 검증, 재입력 중복 행 없음, 상세 의견·후속 설문 보존 | 미실행 |
| G08 | 실물 공유 | 카카오톡 송수신과 링크 열기, 8종 이미지·이름 일치, 저장 성공/취소/fallback 안내 확인 | 미실행 |
| G09 | 모바일 사용 | iPhone Safari·Android Chrome·카카오톡 인앱에서 핵심 완료 흐름, 터치·스크롤·320px 좁은 화면 점검 | 미실행 |
| G10 | 공개 문구·자료 | 현재 공개 UI·공유 메타데이터의 Beta 표시 정리, 과거 기록 보존, 고지·크레딧·출처 유지 | 미실행 |
| G11 | 수집·운영 경계 | 응답/토큰/자유의견 보관·삭제·로그 정책과 사용자 안내 대조, 기존 요청 남용 방지 정책 확인 | 미실행 |
| G12 | 배포·복구 | 운영 DB 백업/복구 가능 여부, 마지막 정상 배포 참조, 호환 배포 순서·롤백 책임자 기록 | 미실행 |

권한 검사는 화면 숨김이 아니라 서버에서 매 요청·대상 자원에 대해 검증하는 것을 기준으로 한다. 로컬 합성 데이터에서 권한·상태·중복 요청 규칙을 직접 깨보는 테스트를 수행한다. [E1, E2]

G11의 보관기간은 이번 자료만으로 확정하지 않는다. 다른 프로젝트의 삭제 정책을 가져오거나 임의로 30일 등의 값을 적용하지 않는다. 이름을 묻지 않는다는 이유만으로 모든 운영 로그와 자유의견까지 개인정보가 없다고 단정하지 않는다. 이 문서는 법적 적합성 확인서가 아니다.

G08은 자동화 테스트와 구분한다. 현재 E2E 공통 fixture는 허용된 로컬 origin 이외의 네트워크를 차단하므로 카카오 SDK의 운영 동작을 입증하지 않는다. 카카오 JavaScript SDK 도메인 등록, SDK 키 종류 및 초기화, 이미지 공개 URL을 운영 설정에서 확인한다. 실제 값·secret을 문서에 적지 않는다. [R17, E3]

## 7. 실행 순서와 공개 승인

### 1차: 코드 변경 배치

별도 `gureumi-v1-codex-batch-1.md`를 전달한다. 공개 문구 전환, 인라인 공감도, 관련 회귀 테스트, 최소 문서 갱신까지만 수행한다. 완료 후 사용자가 diff를 검토한다.

### 2차: 출시 검증

첫 배치에서 다루지 않은 G01~G12의 나머지 항목을 실행한다. 기존 테스트가 있으면 재사용하고 빠진 사례만 보완한다. 실제 기기/운영 설정이 필요한 항목은 사용자가 확인하며, 확인 전에는 통과로 기록하지 않는다.

오탈자 등의 경미한 문제와 출시를 막는 문제를 구분한다. 결과 오류·데이터 유실·타인 접근·주요 환경에서 완료 불가·작동하지 않는 핵심 공유는 해결 후 공개한다. 개선 아이디어만으로 출시 범위를 계속 늘리지 않는다.

### 3차: 배포와 공지

1. 적용 commit, frontend/backend 기존 정상 버전, 내부 검사 코드, 배포 시각 기록.
2. 운영 DB를 변경하는 작업이 있으면 백업과 호환성부터 확인. 이번 기본 범위에서는 새 schema migration을 요구하지 않는다.
3. backend API 변경이 있으면 이전 frontend 요청을 계속 처리할 수 있는지 확인하고 backend → frontend 순으로 배포. 실제 배포 플랫폼과 자동 트리거는 배포 직전에 확인한다.
4. 새 사용자 흐름과 기존 저장 결과 복원을 각각 smoke test.
5. 공유 링크·이미지·통계 접근 확인.
6. 필수 검증이 통과한 뒤에만 정식 공개 공지 게시.

오류 발생 시 정상 배포 버전으로 복구하되 응답 DB를 리셋하지 않는다. frontend에 새 API 호출이 추가됐다면 frontend·backend rollback 호환성을 함께 확인한다. 파괴적 down migration을 즉석에서 실행하지 않는다.

현재 개발 문서에는 frontend GitHub Pages/Actions, backend Railway가 기재돼 있으나 운영 배포 설정 자체는 이번 검토에서 확인하지 않았다. [R13]

## 8. 출시 후 관찰

- 공개 직후: 시작·답변 저장·완료 API 오류, 저장 결과 복구, 핵심 공유 동작 우선 확인.
- D+7: 같은 cohort 기준으로 완료율, 공감도 응답률, 오류·문의, 유형/축 분포 검토.
- 충분한 추가 응답이 쌓인 뒤: 기존 베타 기록과 비교하되 필터·기간·재검사·경계값 비중을 함께 명시.

검사 로직 수정은 분포만으로 결정하지 않는다. 문항 오해, 한 문항에 여러 축 혼입, 역채점 오류, 반복성, 실제 사용자 피드백을 근거로 별도 변경 기록을 남긴다. [R14]

피드백 동선이 바뀌면 응답하는 사람의 구성도 바뀔 수 있다. 전후 공감도 평균 차이를 곧바로 검사 정확도 변화로 해석하지 않는다.

## 9. 공개 공지 초안 — 배포 확인 후 사용

> 나는 어떤 구르미일까?
>
> 온기에 구르미 테스트가 정식으로 열렸어요.
> 27개의 선택을 따라가며 나와 닮은 구르미를 만나보세요.
>
> 혼자 가볍게 해봐도 좋고, 셀이나 소그룹에서 결과를 나누며
> “너는 이럴 때 어떻게 반응해?” 하고 대화를 시작해봐도 좋아요.
>
> 서로 다른 여덟 구르미 중, 여러분은 누구인가요?
>
> [검증 완료된 구르미 공유 링크 삽입]
>
> 놀이형 자기이해 콘텐츠이며, 정식 TCI 검사나 심리 진단이 아닙니다.

## 10. 근거

### 프로젝트 자료

- R1. 사용자가 첨부한 `gureumi-tci-results-8-types.md` — 8유형 정의, 3축 구조, 고지, 문항 설계 원칙.
- R2. [README.md](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/README.md)
- R3. [GureumiService.java](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/backend/src/main/java/app/ongi/sharing/gureumi/GureumiService.java) — 이번 검토는 1~260행.
- R4. [GureumiScoring.java](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/backend/src/main/java/app/ongi/sharing/gureumi/GureumiScoring.java)
- R5. [GureumiScoringTest.java](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/backend/src/test/java/app/ongi/sharing/gureumi/GureumiScoringTest.java)
- R6. [beta-implementation.md](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/docs/gureumi/beta-implementation.md)
- R7. [GureumiApp.tsx](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/src/features/gureumi/GureumiApp.tsx)
- R8. [gureumi.spec.ts](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/e2e/gureumi.spec.ts)
- R9. [GureumiFeedbackFlow.tsx](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/src/features/gureumi/screens/GureumiFeedbackFlow.tsx) — 상태 초기화 및 quick 저장, 화면 헤더 등 확인. 전체 후속 설문 UI 검토는 하지 않음.
- R10. [GureumiResultScreen.tsx](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/src/features/gureumi/screens/GureumiResultScreen.tsx)
- R11. [kakaoShare.ts](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/src/features/gureumi/services/kakaoShare.ts)
- R12. [package.json](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/package.json)
- R13. [DEVELOPMENT.md](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/docs/DEVELOPMENT.md) — 이번 검토는 1~180행.
- R14. [beta-validation.md](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/docs/gureumi/beta-validation.md)
- R15. [GureumiIntroScreen.tsx](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/src/features/gureumi/screens/GureumiIntroScreen.tsx)
- R16. [shareTargets.ts](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/src/app/shareTargets.ts) — 구르미 항목 확인.
- R17. [e2e/fixtures.ts](https://github.com/BeomhyunPark/ongi-icebreaking-app/blob/master/e2e/fixtures.ts)

### 외부 기술 참고 — 검증 방법 제안의 근거이며 운영 상태의 증거는 아님

- E1. [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — 매 요청 서버 권한 검사, 대상 자원 접근 통제, 권한 테스트.
- E2. [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html) — 서버 상태·파생값 검증, 동시성·순서·중복 요청 테스트.
- E3. [Kakao JavaScript 시작하기](https://developers.kakao.com/docs/ko/javascript/getting-started) — SDK 도메인 등록, SDK 버전·integrity, JavaScript 키 초기화.

외부 자료 확인일: 2026-09-14. 출처는 관찰한 구현과 권고를 구분하기 위해 첨부했다.
