# 마니또

## 사용 흐름

1. 홈의 **마니또**에서 진행자가 모임을 만들고, 본인도 참가할지 고른다.
2. 참가자는 초대 링크 또는 12자리 코드와 이름으로 들어온다.
3. 진행자가 명단을 확인하고 배정을 확정한다. 참가자가 최소 2명이어야 한다.
4. 각자 자기 상대만 확인한다. 진행자는 공통 미션을 등록한다.
5. 참가자가 미션 완료를 체크하거나 취소한다. 진행자는 참가자별 완료 현황을 본다.
6. 홈으로 돌아가 다른 기능을 사용할 수 있다. **진행 중인 마니또**에서 모임을 다시 연다.

정체 공개와 나눔 진행은 앱 밖에서 진행자가 운영한다. 앱에서 종료하면 배정, 미션, 완료 기록과 참가자 정보를 삭제한다.

## 현재 범위

- 모임은 생성 후 30일간 유지되며, 만료된 데이터는 시간당 정리한다.
- 참가자 최대 100명, 공통 미션 최대 50개. 배정 뒤 신규 참가는 닫히며 재배정하지 않는다.
- 참가자는 자기 완료 상태만, 진행자는 모든 참가자의 완료 현황을 본다. 진행자에게도 전체 배정표를 제공하지 않는다.
- 현황은 방을 보고 있는 동안 5초 간격으로 조회하고, 창으로 돌아오거나 네트워크가 복구되면 다시 조회한다.
- 참가한 브라우저의 HttpOnly cookie로 복귀한다. 기기·브라우저 변경 또는 쿠키 삭제 후의 복구 기능은 아직 없다.
- 브라우저 저장소에는 방 코드, 제목, 만료 시각만 남긴다. 배정 상대와 인증 토큰은 저장하지 않는다.
- 여러 모임에 참여할 수 있다. 방별 cookie 경로와 저장 목록을 사용한다.

## 구현

- `src/features/manitto`: 화면, 제어 hook, API, 방 참조 저장소
- `backend/.../manitto`: 전용 API와 서비스
- `V8__create_manitto.sql`: 독립된 방·참가자·미션·완료 테이블
- URL: `/?activity=manitto&manittoRoom=<code>`

API:

```text
POST   /api/manitto/rooms
POST   /api/manitto/rooms/{code}/join
GET    /api/manitto/rooms/{code}
POST   /api/manitto/rooms/{code}/assign
POST   /api/manitto/rooms/{code}/missions
PUT    /api/manitto/rooms/{code}/missions/{missionId}/completion
DELETE /api/manitto/rooms/{code}
```

방의 DB 행을 잠근 트랜잭션에서 참가·배정·미션·완료 변경과 조회를 처리한다. 참가자 목록을 무작위로 섞어 순환 연결하므로 자기 배정 없이 한 사람당 한 명에게 배정된다. 재요청은 기존 배정을 유지한다. 미션 등록은 클라이언트 UUID로 재시도를 구분하며, 완료 표시는 원하는 상태를 PUT한다.

쿠키는 방마다 경로를 구분하고 30일 만료 시각에 맞춘다. 서버에는 토큰 해시만 보관한다. 기존 Origin 및 `X-OnGi-Client` 검증과 참가 요청 제한을 적용하며, 방 응답은 `Cache-Control: no-store`를 사용한다.

## 검증

```sh
npm test -- tests/manittoApp.test.tsx
cd backend
./gradlew test --tests '*ManittoIntegrationTest'
cd ..
npm run test:e2e -- e2e/manitto.spec.ts
```

임시 PostgreSQL에서 migration, 권한, 배정 불변성, 중복 요청, 방 간 격리, 종료·만료 삭제를 검증한다. 실제 브라우저 테스트는 데스크톱과 320px 화면에서 별도 세션 참가, 미션 반영, 홈 이동, 다른 활동 사용과 새로고침 복원을 확인한다.

배포 시 프론트엔드와 V8 migration을 포함한 백엔드가 함께 필요하다.
