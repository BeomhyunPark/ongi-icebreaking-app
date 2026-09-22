# Herdr 개발 자동화

이 자동화는 Herdr `0.9.1`의 실제 CLI를 기준으로 온기 로컬 개발환경과 구현·리뷰 흐름을 준비한다. 기존 탭, pane, agent와 실행 중인 서버를 우선 재사용하므로 같은 명령을 반복해도 리소스가 계속 늘어나지 않는다.

## 구성

- `DEV` 탭
  - `IMPLEMENT Codex`: `ongi-implementer` Codex 세션
  - `Git / Diff`: 현재 브랜치와 변경 상태를 보여 주는 shell
  - `Frontend Server`: 저장소 루트에서 `npm run dev`
  - `Backend Server`: `backend/`에서 `./gradlew bootRun`
- `REVIEW` 탭
  - `REVIEW Codex`: `ongi-reviewer` Codex 세션
  - `Test / Logs`: 테스트 실행과 결과 확인용 shell
- 로컬 DB: 저장소의 `compose.yaml`에 정의된 PostgreSQL
- 테스트 로그와 dev process 상태: `.herdr/logs/` (`*.log`로 Git 제외)

## 시작

저장소 루트에서 Herdr를 열고, Herdr 안의 shell pane에서 실행한다.

```bash
herdr
scripts/herdr/ongi-herdr doctor
scripts/herdr/ongi-herdr dev
```

`dev`는 다음 순서로 동작한다.

1. `DEV`와 `REVIEW` 탭 및 역할별 pane을 찾거나 생성
2. `docker compose up -d postgres`로 PostgreSQL 준비 및 readiness 확인
3. IMPLEMENT와 REVIEW Codex 세션을 찾거나 시작
4. Git pane에 `git status --short --branch` 출력
5. Frontend와 Backend를 각 server pane에서 시작하고 URL 응답 대기

기본 주소:

| 구성 | 주소 |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend health | `http://localhost:8080/actuator/health` |
| PostgreSQL | `localhost:5432/ongi` |

Frontend는 저장소 루트의 Vite 설정과 `.env`를 사용한다. Backend runner는 `.env`가 있으면 export한 뒤 Gradle을 실행하므로 Compose와 같은 DB 자격 증명을 사용할 수 있다. `.env`가 없으면 애플리케이션과 Compose의 로컬 기본값을 사용한다.

## 평소 명령

```bash
# 개발환경 시작 또는 상태를 유지한 채 재확인
scripts/herdr/ongi-herdr dev

# 구현 후 기본 검증(frontend test + production build)과 diff 리뷰
scripts/herdr/ongi-herdr all

# 상태와 최근 결과
scripts/herdr/ongi-herdr status
scripts/herdr/ongi-herdr results

# 이 자동화가 시작한 frontend/backend만 종료 또는 재시작
scripts/herdr/ongi-herdr stop
scripts/herdr/ongi-herdr restart
```

## 한 번에 배포

운영 배포는 저장소의 기존 경로를 그대로 사용한다. `master` push가 GitHub Actions의 전체 검증과 GitHub Pages 배포를 시작하고, 같은 commit을 Railway가 CI 성공 후 Backend에 자동 배포한다.

```bash
scripts/herdr/ongi-herdr ship
```

`ship`은 현재 변경 snapshot을 고정한 뒤 `all full`(frontend 검증, backend 테스트, reviewer)을 통과해야만 계속한다. 변경 요약과 자동 생성한 한국어 Conventional Commit 제목을 보여 주고 **딱 한 번** 승인받은 후 전체 변경을 commit하고 현재 `master`를 push한다. 이어서 가능한 경우 GitHub Actions를 추적하고 frontend 및 backend readiness를 확인한다.

```bash
# 승인 입력 없이 실행(명시적으로 지정한 경우에만)
scripts/herdr/ongi-herdr ship --yes

# commit/push/deploy 없이 branch, 정책, 변경 요약만 확인
scripts/herdr/ongi-herdr ship --dry-run

# 최근 Actions 실행과 현재 운영 health 확인
scripts/herdr/ongi-herdr deploy-status
```

안전 규칙:

- 실제 배포는 기존 배포 브랜치 `master`에서만 허용한다. 다른 브랜치에서는 push 전에 중단한다.
- `origin/master`를 먼저 갱신하고 local branch가 뒤처졌거나 이미 review 범위 밖의 unpushed commit을 포함하면 commit 전에 중단한다.
- 인증된 GitHub CLI를 사용할 수 있으면 활성 branch rules의 pull request 요구를 확인하고 direct push를 차단한다. CLI를 쓸 수 없을 때는 저장소의 `master` push workflow를 로컬 정책 근거로 사용한다.
- 테스트 실패, reviewer의 식별자 포함 `FAIL` 판정, 판정 누락, 검증 중 파일 변경, staged snapshot 불일치 중 하나라도 있으면 commit 전에 중단한다.
- secret은 읽거나 저장하지 않는다. Frontend는 GitHub repository variables, Backend는 Railway variables를 계속 사용한다.
- `gh`가 없거나 인증되지 않았으면 push 뒤 Actions URL을 출력하는 폴백으로 동작한다. 현재 설치된 `gh`의 인증이 만료된 경우 `gh auth login -h github.com`으로 복구하면 자동 추적이 활성화된다.

실패/복구 전략:

- commit 전 실패: working tree를 그대로 보존하고 아무것도 push하지 않는다.
- commit 성공 후 push 실패: local commit을 보존하고 원인을 해결한 뒤 다시 실행한다. 새 변경이 없다면 `git push origin master`로 이어서 보낼 수 있다.
- GitHub Actions 실패: GitHub Pages는 새 artifact를 배포하지 않으며 Railway의 `Wait for CI`가 Backend 자동 배포를 막는다. Actions 로그를 수정하고 새 commit으로 다시 `ship`한다.
- health check 실패: 배포 트리거는 이미 실행된 상태이므로 자동으로 git을 되돌리지 않는다. GitHub/Railway 로그를 확인하고 수정 commit을 ship한다. Railway는 플랫폼 health check와 restart policy를 적용하며 운영 DB는 변경하거나 삭제하지 않는다.
- 이미 성공한 운영 버전으로 긴급 복구해야 하면 해당 정상 commit을 `git revert`한 새 commit으로 배포한다. history rewrite와 DB rollback은 자동화하지 않는다.

`stop`은 해당 server pane과 상태 파일이 일치할 때만 Ctrl-C를 보낸다. 이미 외부에서 실행 중이던 서버, PostgreSQL, Codex 세션은 종료하지 않는다. 강제 kill도 하지 않으며 정상 종료되지 않으면 pane ID와 함께 오류를 출력한다.

레이아웃이나 리뷰 환경만 준비할 수도 있다.

```bash
scripts/herdr/ongi-herdr dev-layout
scripts/herdr/ongi-herdr setup
```

## 리뷰와 테스트

```bash
scripts/herdr/ongi-herdr review
scripts/herdr/ongi-herdr test
scripts/herdr/ongi-herdr test frontend
scripts/herdr/ongi-herdr test verify
scripts/herdr/ongi-herdr test backend
scripts/herdr/ongi-herdr test e2e
scripts/herdr/ongi-herdr test full
scripts/herdr/ongi-herdr all backend
```

`review`와 `all`은 실행할 때마다 `scripts/herdr/reviewer-prompt.txt`의 지침을 reviewer Codex에 주입한다. `all`은 테스트를 먼저 비동기로 시작하고 리뷰를 진행한 다음 테스트 완료를 기다려 두 결과를 출력한다.

| 프로필 | 실행 명령 | 선행조건 |
| --- | --- | --- |
| `frontend` | `npm test` | Node dependencies |
| `verify` | `npm run verify` | Node dependencies |
| `backend` | `cd backend && ./gradlew test` | 실행 중인 Docker(Testcontainers) |
| `e2e` | `npm run test:e2e` | Docker와 Playwright browser |
| `full` | `npm run verify`, 이후 backend test | Docker; frontend 실패 시 backend 생략 |

## 중복 실행 방지

- tab과 pane은 label로 검색해 재사용한다.
- Codex agent는 고유 이름(`ongi-implementer`, `ongi-reviewer`) 또는 대상 pane의 기존 Codex를 재사용한다.
- 서버 URL이 이미 응답하면 그 프로세스는 소유권을 주장하거나 재시작하지 않는다.
- 자동화가 시작한 서버는 `.herdr/logs/dev-*.pid.log`에 PID와 pane ID를 기록한다.
- 시작 중인 관리 프로세스가 확인되면 새 명령을 보내지 않고 readiness만 기다린다.

## 선행조건과 문제 해결

- 필수: Herdr 0.9.1, `jq`, Codex CLI, Node.js/npm, Java 21, Docker Compose, `curl`
- 최초 설치 후 `npm install`이 한 번 필요하다.
- 반드시 Herdr-managed pane 안에서 실행한다 (`HERDR_ENV=1`).
- Docker daemon이 실행 중이어야 `dev`, backend test, E2E가 동작한다.
- 기본 server 준비 대기는 120초다. 필요하면 `ONGI_HERDR_START_TIMEOUT_SECONDS`를 바꾼다.
- reviewer/test 기본 대기는 15분이다. 필요하면 `ONGI_HERDR_WAIT_TIMEOUT_MS`를 밀리초로 바꾼다.
- server 시작 실패 시 해당 `Frontend Server` 또는 `Backend Server` pane에서 원인을 확인한다.
- 기본 포트를 다른 정상 서버가 사용 중이면 `dev`는 안전을 위해 그 프로세스를 재사용하고 건드리지 않는다.
- reviewer가 approval/question 화면에서 멈추면 자동으로 답하지 않는다. `REVIEW` 탭에서 사람이 확인한다.
- `agent_prompt_stalled`나 timeout이 발생해도 prompt가 전달되지 않았다고 단정하지 말고 `results`에서 화면을 확인한다.

명령 목록은 `scripts/herdr/ongi-herdr help`로 확인할 수 있다.
