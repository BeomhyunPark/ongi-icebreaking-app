# 실제 브라우저 회귀 테스트

## 실행

Node.js 24.15 이상, Java 21, 실행 중인 Docker가 필요하다.

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

`playwright.config.ts`가 테스트 전용 빌드(`dist-e2e`)와 서버를 시작하고 종료한다. 운영 배포용 `dist`는 건드리지 않는다. 포트 4176과 18080이 사용 중이면 실패하며 기존 서버에 연결하지 않는다.

- 프론트: `http://127.0.0.1:4176`
- API: `http://127.0.0.1:18080`
- DB: `backend/src/test/java/app/ongi/sharing/E2eServer.java`가 매 실행 새 PostgreSQL Testcontainer를 생성한다. 실제 migration과 API를 사용하며 개발용/운영 DB를 재사용하지 않는다. 종료 시 임시 DB도 정리된다.
- 브라우저의 외부 HTTP 요청은 차단한다. 외부 공유 서비스 자체의 동작은 이 테스트 범위가 아니다.

## 수정 위치

| 검증 대상 | 파일 |
| --- | --- |
| 홈 분류, 좁은 화면, 흔적·밸런스·뽑기·월드컵 복원 | `e2e/activities.spec.ts` |
| 구르미 답변 복원, 완료 결과, 피드백, 재검사 | `e2e/gureumi.spec.ts` |
| 서로 다른 세션의 동시 작성, 재연결, 작성자 공개, 라운드 충돌, 종료 | `e2e/sharing.spec.ts` |
| 외부 요청 차단, 페이지 오류 감지 | `e2e/fixtures.ts` |
| 브라우저·모바일 설정, 서버 실행 | `playwright.config.ts` |

특정 흐름만 실행하려면 `npm run test:e2e -- e2e/sharing.spec.ts --project=chromium`처럼 지정한다. 상태가 실제로 바뀌었는지 locator assertion으로 기다린다. 임의의 긴 sleep이나 재시도만으로 실패를 숨기지 않는다.

익명 나눔은 진행자도 참여하는 3인 모임을 사용한다. 작성자 아닌 세션의 공개 요청 거부, 연결이 끊긴 동안의 공개 내용 복구, 같은 버전의 중복 다음 요청 중 하나만 성공하는지 확인한다. 재연결 검증에는 화면 새로고침을 쓰지 않는다.

## CI와 실패 확인

GitHub Actions는 단위·백엔드 테스트와 함께 브라우저 테스트를 통과해야 Pages를 배포한다. 브라우저 테스트에서 사용하는 로컬 API 주소는 별도 테스트 빌드에만 주입한다.

- 로컬 보고서: `npx playwright show-report`
- 실패한 화면·실행 기록: `test-results/`, `playwright-report/`
- CI 실패 자료: `browser-diagnostics` artifact, 7일 보관

Chromium의 데스크톱·모바일 에뮬레이션 검증이며 실제 Safari/카카오톡 인앱 브라우저 검증을 대신하지 않는다. 실제 기기의 공유·설치 기능은 배포 전 별도 점검한다.
