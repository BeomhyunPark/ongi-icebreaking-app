# Herdr 개발 자동화

온기 자동화는 Herdr 0.9.1에서 확인된 `tab`, `pane`, `agent`, `worktree`, `--remote`, `--session` 명령만 사용한다. 버전 관리되는 구현은 `scripts/herdr/herdr-dev`, 프로젝트 정보는 `.herdr/project.conf`에 있다. `scripts/herdr/ongi`와 `ongi-herdr`는 저장소 구현을 호출하는 호환 wrapper다.

## 일상 흐름

```bash
h dev
# 작업
h ship --autofix
h status
h task login-fix
h remote ongi
```

`ship`은 full test와 별도 reviewer를 통과한 뒤 한 번 승인받아 commit/push하고 배포 링크와 production health를 확인한다. `h ship --dry-run --autofix`는 계획만 검사하며 commit, push, deploy를 실행하지 않는다. 이번 CLI 설치 자체도 commit/push/deploy하지 않는다.

Herdr pane 밖에서도 `h init`, `h status`, `h ship --dry-run --autofix`, `h remote-info`를 쓸 수 있다. pane/agent/worktree를 제어하는 `dev`, `review`, `all`, `task`, `stop`은 Herdr-managed pane에서 실행한다.

## 설치와 PATH

저장소 명령은 별도 설치 없이 동작한다.

```bash
scripts/herdr/ongi doctor
scripts/herdr/run-tests verify
```

선택적으로 전역 `h`를 설치한 환경에서는 같은 명령을 짧게 실행할 수 있다. 저장소 wrapper는 전역 설치에 의존하지 않으며, 호환되는 다른 코어를 명시적으로 시험할 때만 `HERDR_DEV_CORE=/absolute/path/to/herdr-dev`를 지정한다. `~/.local/bin`이 PATH에 없다면 사용자가 직접 다음 한 줄을 shell 설정에 추가한다.

```bash
export PATH="$HOME/.local/bin:$PATH"
```

자동화는 `.zshrc`, Remote Login, Tailscale, sleep 설정을 직접 바꾸지 않는다.

## 프로젝트 설정과 초기화

새 Git 프로젝트 루트에서 `h init`을 실행한다. `package.json`, `gradlew`, `backend/gradlew`, `pom.xml`, Compose 파일을 감지하고 확인 후 `.herdr/project.conf`와 reviewer prompt를 만든다. 기존 파일은 확인 없이 덮어쓰지 않는다.

설정에는 프로젝트 이름, frontend/backend 디렉터리와 dev/test/build 명령, DB start/stop/readiness, deploy 방식, health URL, reviewer prompt, task worktree 경로를 둘 수 있다. frontend/backend dev 명령이 비어 있으면 해당 pane과 process는 생략된다. 설정 파일은 source하지 않고 허용 키만 파싱한다.

온기 기본 layout:

- `DEV`: IMPLEMENT Codex, Git / Diff, Frontend Server, Backend Server
- `REVIEW`: REVIEW Codex, Test / Logs
- 로그: `.herdr/logs/`
- task: 형제 `heart-trace-test-worktrees/<name>`

`h stop`은 h가 시작했고 pane ID가 맞는 frontend/backend만 Ctrl-C로 중지한다. DB와 Codex는 보존한다. `task-clean`은 clean하고 현재 branch에 merge된 task만 제거한다.

## 원격

`~/.config/herdr-dev/hosts.conf.example`을 `hosts.conf`로 복사하고 값을 채운다.

```text
# project|ssh-alias|absolute-project-path|herdr-session|mode
ongi|macbook-ongi|/Users/hyunee/Developer/greengroove/heart-trace-test|ongi|ssh
```

`ssh` mode는 원격 경로로 이동한 뒤 `herdr --session`을 실행한다. `herdr` mode는 0.9.1에서 확인된 `herdr --remote <alias> --session <name>`을 쓴다. 실제 접속 전 `h remote ongi --dry-run`으로 검증한다.

사용자가 수동으로 해야 하는 준비:

1. macOS Remote Login 활성화
2. `~/.ssh/config`에 SSH alias 및 키 설정
3. 필요하면 양쪽 장비에 Tailscale 연결
4. MacBook이 잠들지 않도록 전원/sleep 정책 확인

`h remote-info`는 위 상태를 읽기만 한다.

## 명령

```bash
h doctor
h dev
h status
h stop
h restart
h review
h test [frontend|verify|backend|e2e|full]
h all [profile] [--autofix]
h autofix [profile]
h ship [--yes] [--autofix] [--dry-run]
h deploy-status
h results
h watch
h task <name>
h task-clean <name>
h remote <project-or-host> [--dry-run]
h remote-info
```

필수 도구는 Herdr 0.9.1, jq, Codex CLI, curl이며 온기는 추가로 Node/npm, Java, Docker Compose가 필요하다.
