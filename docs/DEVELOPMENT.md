# 온기 개발 가이드

이 문서는 온기를 개발하거나 운영하는 사람을 위한 기술 문서입니다. 서비스 소개는 [프로젝트 README](../README.md)를 참고하세요.

## 기술 구성

- Frontend: React 19, TypeScript, Vite
- Backend: Java 21, Spring Boot, Gradle
- Database: PostgreSQL, Flyway (로컬 개발: 16)
- 실시간 갱신: Server-Sent Events
- 테스트: Vitest, Testing Library, axe-core, Spring Boot Test, Testcontainers
- Frontend 배포: GitHub Pages, GitHub Actions
- Backend 운영: Railway, Dockerfile 빌드, Railway PostgreSQL

운영 환경은 `ongi.greengroove.app`의 정적 frontend와 `ongi-api.greengroove.app`의 API로 분리됩니다.

처음 수정한다면 [코드 구조와 수정 위치](./ARCHITECTURE.md)를 먼저 확인하세요. 기능별 진입점, 상태 전이, 저장소 호환성, 검증 명령을 정리했습니다.

## 저장소 구조

```text
/
├── src/                    React + TypeScript frontend
├── tests/                  frontend unit/integration tests
├── backend/                Spring Boot API와 integration tests
├── docs/                   제품·architecture 문서
├── scripts/                이미지 생성, 부하 테스트, 운영 자동화
├── deploy/                 홈서버 서비스 설정
├── compose.yaml            로컬 PostgreSQL
└── compose.home-server.yaml
```

## 로컬 실행

필요한 도구:

- Node.js 24
- Java 21
- Docker

환경변수 예시는 [`.env.example`](../.env.example)에 있습니다. 로컬 기본값으로 실행할 때는 별도 운영 secret이 필요하지 않습니다.

```bash
docker compose up -d postgres

cd backend
./gradlew bootRun

# 별도 터미널, 저장소 루트
npm install
npm run dev
```

기본 주소:

| 구성 | 주소 |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8080` |
| Health check | `http://localhost:8080/actuator/health` |
| PostgreSQL | `localhost:5432/ongi` |

Flyway migration은 Backend 시작 시 자동 실행됩니다. 이미 운영에 적용한 migration 파일은 수정하지 않고 새 migration을 추가합니다.

## 주요 환경변수

| 변수 | 설명 | 로컬 기본값 |
|---|---|---|
| `DB_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://localhost:5432/ongi` |
| `DB_USERNAME` | DB 사용자 | `ongi` |
| `DB_PASSWORD` | DB 비밀번호 | 로컬 개발 비밀번호 |
| `ONGI_ALLOWED_ORIGINS` | credential CORS 허용 origin | `http://localhost:5173` |
| `ONGI_SECURE_COOKIE` | HTTPS 전용 cookie | `false` |
| `ONGI_ROOM_ACTIVE_LIFETIME` | 활성 Room 만료 | `12h` |
| `ONGI_TOMBSTONE_RETENTION` | 종료 상태와 session hash 유지 | `24h` |
| `ONGI_JOIN_ATTEMPTS_PER_CODE_PER_MINUTE` | 같은 IP와 code 조합 제한 | 로컬 `15`, 홈서버 `30` |
| `ONGI_TRUST_CLOUDFLARE_CONNECTING_IP` | Tunnel이 보장한 실제 client IP 사용 | `false` |
| `VITE_API_BASE_URL` | Frontend API origin | `http://localhost:8080` |

운영 비밀번호는 repository나 image에 넣지 않고 배포 환경의 secret으로 주입합니다.

## API 구성

### Room과 익명 나눔

```text
POST /api/rooms
POST /api/room-joins

GET  /api/rooms/{roomId}/state
POST /api/rooms/{roomId}/lock
POST /api/rooms/{roomId}/unlock
POST /api/rooms/{roomId}/cancel
GET  /api/rooms/{roomId}/participants
GET  /api/rooms/{roomId}/participants/me

GET  /api/rooms/{roomId}/questions
GET  /api/rooms/{roomId}/responses/me
PUT  /api/rooms/{roomId}/responses
POST /api/rooms/{roomId}/responses/complete

POST /api/rooms/{roomId}/start-sharing
GET  /api/rooms/{roomId}/sharing/current
POST /api/rooms/{roomId}/sharing/reveal
POST /api/rooms/{roomId}/next
POST /api/rooms/{roomId}/complete

GET  /api/rooms/{roomId}/events
```

Room Code와 public Room ID는 credential이 아닙니다. 최초 join을 제외한 Room API는 해당 Room의 HttpOnly session cookie를 검증하고, 변경 요청에는 `X-OnGi-Client: web` header가 필요합니다.

Host와 Participant token은 256-bit random 값이며 cookie에만 저장합니다. DB에는 SHA-256 hash만 저장하고 frontend 저장소에는 Room ID만 남깁니다.

상세 흐름과 권한 경계는 [익명 자기소개 나눔 설계](./ongi-sharing-mvp.md)를 참고하세요.

### 익명 참여와 반응

```text
PUT    /api/engagement/visitors/{visitorKey}
PUT    /api/engagement/visits/{visitKey}
GET    /api/engagement/contents/{contentCode}
POST   /api/engagement/participations
PUT    /api/engagement/participations/{participationId}/completion
GET    /api/engagement/contents/{contentCode}/like
PUT    /api/engagement/contents/{contentCode}/like
DELETE /api/engagement/contents/{contentCode}/like
POST   /api/engagement/events
GET    /api/engagement/statistics
GET    /api/engagement/contents/{contentCode}/statistics
GET    /api/engagement/share-links/{code}
```

좋아요는 밸런스 게임의 대화 온도, 최애 월드컵의 주제, 공동체 도구의 모드처럼 `variantCode` 단위로 집계합니다. 전체 데이터 정의와 ERD는 [Engagement v0.1](./engagement-v0.1.md)에 있습니다.

### 구르미 Beta 내부 통계

`/?page=gureumi-beta-stats`는 공개 메뉴에 등록하지 않은 데스크톱 운영 대시보드입니다. 전체 방문자·세션·페이지 조회·콘텐츠별 시작/완료/공유/좋아요와 구르미 문항 품질 통계를 함께 표시합니다.

백엔드에 `ONGI_ADMIN_KEY`를 설정해야 하며, 브라우저가 전송하는 `X-OnGi-Admin-Key`와 일치할 때만 내부 통계 API가 응답합니다. 키는 프론트엔드 빌드에 포함하지 않고 대시보드 탭의 `sessionStorage`에만 보관합니다.

화면은 문항 choice·평균 응답 시간, 축 HIGH/LOW·boundary, 8종 결과, 결과별·전체 만족도, funnel을 익명 집계로 보여줍니다. 개별 attempt와 token은 내부 API에서도 반환하지 않습니다. 상세한 집계 의미와 보호 경계는 [GUREUMI Beta 구현 메모](./gureumi/beta-implementation.md)를 참고하세요.

## 실시간 갱신

`GET /api/rooms/{roomId}/events`는 다음 trigger를 전송합니다.

- `PARTICIPANT_JOINED`
- `PARTICIPANT_PROGRESS_CHANGED`
- `ROOM_ACCESS_CHANGED`
- `ROOM_CANCELLED`
- `SHARING_STARTED`
- `ROUND_CHANGED`
- `PROFILE_REVEALED`
- `ROOM_COMPLETED`

이벤트 payload에는 이름이나 답변을 넣지 않습니다. Client는 trigger를 받으면 REST API로 현재 상태를 다시 조회하며, 모바일 background 전환이나 platform timeout으로 연결이 끊기면 `EventSource`가 재연결합니다.

## 개인정보 삭제

Host가 Room을 종료하면 같은 DB transaction에서 답변, 참여자 이름과 record, 나눔 순서, participant-session 연결을 즉시 hard delete합니다.

완료 화면 복구와 code 재사용 방지를 위한 `COMPLETED` Room과 익명화한 session hash는 기본 24시간 뒤 삭제합니다. 종료되지 않은 Room은 생성 12시간 후 전체 삭제합니다. 나눔 시작 전 Room을 취소하면 tombstone 없이 관련 데이터를 즉시 삭제합니다.

Backup에는 보존 기간 동안 과거 block이 남을 수 있으므로 운영 backup retention과 접근 권한을 별도로 관리합니다.

## 테스트와 빌드

```bash
npm test
npm run build

cd backend
./gradlew test
```

Frontend 전체 검증은 `npm run verify`로 실행합니다. Backend integration test는 Testcontainers PostgreSQL을 사용하므로 Docker가 실행 중이어야 합니다.

## Frontend 배포

`master` push 시 [GitHub Actions workflow](../.github/workflows/pages.yml)가 frontend 테스트, production build, backend integration test를 실행한 뒤 GitHub Pages에 배포합니다.

Repository variable:

```text
VITE_API_BASE_URL=https://ongi-api.greengroove.app
```

## 이전 운영 환경 — Surface Pro 홈서버

아래 내용은 이전 환경과 복구 참고용입니다. 현재 운영 배포는 Railway에서 관리하며, 일반 배포를 위해 이 절차를 실행하지 않습니다.

PostgreSQL은 Docker network 내부에서만 접근하고 Backend는 Surface의 `127.0.0.1:8080`에 공개합니다. 외부 연결은 공유기 port forwarding 대신 Cloudflare Tunnel을 사용합니다.

```powershell
Copy-Item .env.home-server.example .env.home-server
notepad .env.home-server

docker compose --env-file .env.home-server -f compose.home-server.yaml up -d --build
docker compose --env-file .env.home-server -f compose.home-server.yaml ps
Invoke-RestMethod http://localhost:8080/actuator/health/readiness
```

Cloudflare Tunnel:

```text
Hostname: ongi-api.greengroove.app
Service:  http://localhost:8080
```

`cloudflared`가 별도 container에서 실행된다면 service 주소로 `http://host.docker.internal:8080`을 사용합니다.

운영 명령:

```powershell
# 로그
docker compose --env-file .env.home-server -f compose.home-server.yaml logs -f backend

# 수동 재배포
docker compose --env-file .env.home-server -f compose.home-server.yaml up -d --build

# DB volume을 유지하며 중지
docker compose --env-file .env.home-server -f compose.home-server.yaml down
```

`down -v`는 PostgreSQL volume까지 삭제하므로 사용하지 않습니다. Docker Desktop은 Windows 로그인 시 자동 시작하도록 설정하고 Surface의 절전·최대 절전 모드를 끕니다.

기본 resource limit은 Backend container 2GB, Java heap 1GB, PostgreSQL 768MB, 열린 파일 8,192개입니다. 외부 부하 테스트와 Docker 지표 수집은 [부하 테스트 가이드](../tests/load/README.md)를 참고하세요.

### Backend 자동 배포

홈서버 감시기는 매분 원격 `master`를 확인합니다. Backend 관련 변경이 있으면 깨끗한 snapshot에서 테스트한 뒤 Backend container만 다시 빌드합니다. 새 container가 readiness 검사를 통과하지 못하면 직전 image로 복구하며 PostgreSQL container와 volume은 변경하지 않습니다.

```bash
# cron 감시 설치
scripts/home-server/install-autodeploy-cron.sh

# 상태와 로그
crontab -l
tail -f .deployment/backend/watch.log

# 즉시 한 번 배포
scripts/home-server/deploy-backend.sh

# 자동 배포 제거
scripts/home-server/install-autodeploy-cron.sh --remove
```

초 단위 감시가 필요하면 [systemd service](../deploy/systemd/ongi-backend-autodeploy.service)를 사용할 수 있습니다. Cron과 systemd를 동시에 실행해도 lock으로 중복 배포는 막지만 운영 방식은 하나만 선택합니다.

## 현재 운영 환경 — Railway

현재 Backend와 PostgreSQL은 Railway에서 운영합니다. `master`의 GitHub 검증이 통과하면 연결된 Backend 서비스가 자동 배포됩니다.

초기 구성 기록은 [Railway Backend 배포 가이드](./RAILWAY_DEPLOYMENT.md)에 있습니다. 이 문서의 새 DB 생성 절차를 일상적인 배포에 적용하지 않습니다. 기존 운영 DB를 유지하고, 서비스 대시보드에서 build·deploy 설정을 관리합니다.

1. Backend source root를 `/backend`로 지정합니다.
2. Backend와 PostgreSQL을 같은 region에 둡니다.
3. DB 접속 정보, CORS origin, secure cookie를 운영 secret과 변수로 설정합니다.
4. Readiness health check를 `/actuator/health/readiness`로 지정합니다.
5. Backend는 SSE subscriber registry가 process memory에 있으므로 replica를 1개로 유지합니다.

둘 이상의 Backend replica가 필요해지면 PostgreSQL LISTEN/NOTIFY 같은 cross-instance event 전달 수단을 먼저 추가해야 합니다.

## 관련 문서

- [제품 로드맵](../ROADMAP.md)
- [익명 자기소개 나눔 MVP](./ongi-sharing-mvp.md)
- [익명 참여·반응 데이터 설계](./engagement-v0.1.md)
- [부하 테스트와 운영 지표 수집](../tests/load/README.md)
