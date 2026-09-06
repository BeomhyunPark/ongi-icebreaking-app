# Railway Backend 배포

Backend와 PostgreSQL을 Railway에서 새로 시작한다. 기존 홈서버 데이터는 이전하지 않는다.

## 1. 프로젝트와 데이터베이스 생성

1. Railway에서 새 프로젝트를 만든다.
2. `+ New` → `Database` → `PostgreSQL`을 선택한다.
3. PostgreSQL 배포가 완료될 때까지 기다린다.
4. 데이터베이스에 Public Networking은 켜지 않는다. Backend는 Railway private network로 연결한다.

## 2. Backend 서비스 연결

1. `+ New` → `GitHub Repo`에서 `BeomhyunPark/ongi-icebreaking-app`을 선택한다.
2. 서비스 이름을 `ongi-backend`로 지정한다.
3. Settings → Source에서 배포 branch를 `master`로 지정한다.
4. Root Directory를 `/backend`로 지정한다.
5. GitHub Autodeploy를 활성화하고 `Wait for CI`를 켠다.
6. Settings → Deploy에서 아래 값을 설정한다.
   - Healthcheck Path: `/actuator/health/readiness`
   - Healthcheck Timeout: `180`
   - Restart Policy: `On Failure`
   - Max restart retries: `5`
   - Replicas: `1`

Railway는 `/backend/Dockerfile`을 자동으로 감지한다. 기존 `railway.json` Config as Code 방식은 새 Railway 서비스에서 사용할 수 없으므로 위 배포 설정은 대시보드에서 관리한다.

## 3. 환경변수 연결

Backend 서비스의 Variables → Raw Editor에 아래 값을 추가한다. `Postgres`는 Railway canvas에 표시되는 PostgreSQL 서비스 이름과 정확히 같아야 한다.

```dotenv
DB_URL=jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_POOL_SIZE=5

ONGI_ALLOWED_ORIGINS=https://ongi.greengroove.app
ONGI_ADMIN_KEY=<충분히 긴 임의의 관리자 키>
ONGI_SECURE_COOKIE=true
ONGI_TRUST_CLOUDFLARE_CONNECTING_IP=false
ONGI_ROOM_ACTIVE_LIFETIME=12h
ONGI_TOMBSTONE_RETENTION=24h
ONGI_JOIN_ATTEMPTS_PER_CODE_PER_MINUTE=15

JAVA_TOOL_OPTIONS=-Xms128m -Xmx512m -XX:+ExitOnOutOfMemoryError
```

`PORT`는 Railway가 주입하고 Spring Boot가 자동으로 사용한다. 애플리케이션이 시작될 때 Flyway가 빈 PostgreSQL에 전체 schema와 기본 질문 데이터를 생성한다.

## 4. 임시 도메인으로 검증

Settings → Networking → Generate Domain으로 Railway 도메인을 만든 뒤 확인한다.

```text
https://<railway-domain>/actuator/health/readiness
```

응답이 `{"status":"UP"}`인지 확인하고 구르미 시작 API와 프론트 연결을 검증한다. 새 DB이므로 방문자 수와 참여 통계는 0부터 시작한다.

## 5. 운영 도메인 전환

1. Backend 서비스에 custom domain `ongi-api.greengroove.app`을 추가한다.
2. Railway가 표시하는 CNAME과 TXT 레코드를 Cloudflare DNS에 추가한다.
3. 기존 Cloudflare Tunnel의 같은 hostname/DNS 레코드를 Railway CNAME으로 교체한다.
4. Cloudflare proxy를 사용하면 SSL/TLS 모드는 `Full`로 둔다.
5. Railway에서 domain verification이 끝난 뒤 readiness와 실제 API를 다시 확인한다.

Frontend의 GitHub repository variable `VITE_API_BASE_URL`은 이미 `https://ongi-api.greengroove.app`을 사용하므로 도메인을 유지하면 다시 빌드할 필요가 없다.

## 6. 전환 후 확인

- Railway Deployments에서 현재 `master` commit SHA가 배포됐는지 확인한다.
- Backend 로그에서 Flyway V1~V6 적용과 Spring Boot 시작 완료를 확인한다.
- `/actuator/health/readiness`가 200인지 확인한다.
- 이후 backend 변경 commit을 push해 GitHub Autodeploy가 동작하는지 확인한다.
- 안정화 전까지 홈서버와 Tunnel 설정은 삭제하지 않고 rollback 경로로 남겨둔다.
