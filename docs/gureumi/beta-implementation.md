# GUREUMI Beta v0.1 구현 메모

## 데이터 흐름

1. 서버가 active test version으로 익명 attempt와 32-byte resume token을 만든다.
2. 브라우저에는 opaque `attemptId`와 token만 저장하고, DB에는 SHA-256 token hash만 저장한다.
3. 질문 API는 문항 ID·순서·상황·A/B 문장만 반환한다.
4. 선택할 때마다 서버가 attempt 소유권과 version을 검증해 answer를 upsert한다.
5. 완료 요청에서 서버가 27개 답과 축별 9개 문항을 다시 검증하고 score·level·boundary·result를 한 transaction에서 확정한다.
6. 완료된 attempt만 결과와 익명 Beta 피드백을 조회·저장할 수 있다.

## API

모든 attempt 전용 요청은 `X-Gureumi-Resume-Token` header를 사용한다.

- `POST /api/gureumi/attempts` — active version attempt 생성. 이전 token을 보내면 완료 attempt 뒤 재검사 번호를 잇는다.
- `GET /api/gureumi/attempts/current` — token에 연결된 현재 상태와 저장된 선택 조회.
- `GET /api/gureumi/attempts/{attemptId}/questions` — attempt가 시작한 version의 public 문항 조회.
- `PUT /api/gureumi/attempts/{attemptId}/answers` — 문항별 선택과 response time 즉시 저장 또는 수정.
- `POST /api/gureumi/attempts/{attemptId}/complete` — 서버 authoritative scoring과 결과 확정.
- `GET /api/gureumi/attempts/{attemptId}/result` — 완료된 결과의 표시용 최소 정보 조회.
- `PUT /api/gureumi/attempts/{attemptId}/feedback` — 1–4 결과 공감도, 헷갈린 문항, 직접 고른 구르미 upsert.
- `PUT /api/gureumi/attempts/{attemptId}/feedback/follow-up` — 선택형 9문항 후속 설문 upsert.

### 내부 Beta 통계

- Frontend: `/?page=gureumi-beta-stats`
- API: `GET /api/gureumi/internal/statistics`
- Header: `X-OnGi-Admin-Key: <ONGI_ADMIN_KEY>`
- Filter: `version`, `completedAnswersOnly`, `firstAttemptOnly`

통계 화면은 홈과 공개 메뉴에 링크하지 않는 hidden URL로 운영하며, 서버 환경변수 `ONGI_ADMIN_KEY`와 일치하는 관리자 키를 입력해야 한다. API는 개별 attempt나 token이 아닌 익명 집계만 반환하고 `no-store`를 사용한다. 관리자 키는 브라우저 탭의 `sessionStorage`에만 보관하며 탭을 닫으면 삭제된다.

## 익명 Beta 분석

개인정보와 raw IP를 추가 수집하지 않는다. version, attempt number, 시작/완료 시각, 문항별 raw choice·서버 score·response time, 축별 score/level/boundary, result type과 Figma에 정의된 선택형 Beta 피드백을 이용해 문항·축·결과 분포와 funnel을 계산할 수 있다. 자유 의견에는 이름·연락처를 적지 않도록 화면에서 안내한다.

Funnel은 attempt 수, 해당 attempt의 최대 answer order, completed 상태와 feedback 존재 여부로 `started`, `Q9 reached`, `Q18 reached`, `completed`, `feedback submitted`를 계산한다.

내부 통계 API는 개별 attempt ID·resume token·token hash·IP를 반환하지 않고 다음 집계만 반환한다.

- Funnel: 시작, Q9, Q18, 완료, feedback 제출 수와 비율
- 문항: 4개 choice별 수·비율, 서버 score 평균, 평균 response time
- 축: HIGH/LOW, raw score 평균, boundary 수·비율
- 결과: 8종별 인원·비율, 만족도 평균·분포
- Feedback: 전체 1–4 분포와 완료 대비 제출률

기본 cohort는 `current version + completed answers + first attempt`다. 화면에서 중도 이탈 응답과 재검사까지 포함해 비교할 수 있다. 결과 비율을 인위적으로 보정하지 않는다.

## 버전 운영

`GUREUMI_BETA_V01` seed는 migration으로 고정된다. 새 active version을 만들 때 이전 version과 question을 수정하지 않는다. attempt가 `version_id`를 소유하고 answer에도 같은 version을 강제하는 복합 foreign key를 두어 active version 변경 중에도 문항 세트가 섞이지 않게 한다.
