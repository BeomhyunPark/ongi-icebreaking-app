# OnGi 소그룹 익명 자기소개 나눔 MVP

## 목표

6~7명이 한 Room에서 자신의 답변을 작성하고, 한 사람씩 익명 프로필을 읽은 뒤 실제 작성자가 직접 자신을 공개하며 대화하는 전체 경험을 지원한다. 점수, 순위, 정답, 제한시간은 제공하지 않는다.

## 사용자 흐름

### Host

```text
Room 생성
→ QR 공유
→ 필요하면 진행자도 이름을 입력하고 참여
→ 참여 현황 확인
→ 입장 마감(LOCKED, 나눔 시작 전 다시 열기 가능)
→ 전원 작성 완료 확인
→ 나눔 시작
→ 작성자 reveal 확인
→ 다음 이야기
→ 마지막 이야기 완료
→ Room 종료 및 개인정보 즉시 삭제
```

### Participant

```text
QR 스캔
→ 이름 입력 및 session 발급
→ 한 질문씩 작성/중간 저장
→ 작성 완료
→ 대기
→ 익명 프로필 확인
→ 자신의 차례에 "이거 저예요"
→ 대화
→ 다음 프로필
→ 종료
```

## Room 상태 머신

```text
CREATED ──첫 join──> WRITING ──Host lock──> LOCKED
                                               │
                                      전원 작성 완료
                                               ▼
                                           SHARING
                                               │
                                     모든 round 완료
                                               ▼
                                          COMPLETED
```

LOCKED 이후 신규 join은 실패한다. Host는 나눔 시작 전 Room을 다시 `WRITING`으로 열 수 있다. 이미 발급된 Participant Session을 가진 사용자의 refresh, 상태 조회, 답변 저장과 SSE 재연결은 계속 허용한다.

Host가 실수로 만든 Room은 `CREATED`, `WRITING`, `LOCKED` 상태에서만 확인 후 취소할 수 있다. 취소하면 Room에 속한 session, 참여자 이름과 작성 중 답변을 즉시 hard delete하고 브라우저의 Room 참조와 cookie도 제거한다. `SHARING`이 시작된 뒤에는 취소 API를 허용하지 않는다.

Host가 이름을 입력해 참여하면 Host cookie와 Participant cookie가 같은 브라우저에 함께 저장된다. 서버는 Host 진행 권한을 유지하면서 해당 Room의 Participant identity도 함께 복구하므로, Host도 답변 작성과 자신의 차례 reveal을 할 수 있다.

SharingRound는 `ANONYMOUS → REVEALED → COMPLETED` 순서로만 전환한다.

## Backend architecture

```text
Controller / explicit DTO
           │
RoomAuthorizationService ── session hash + room boundary 검증
           │
Transactional application service
           │
Spring Data JPA repository
           │
PostgreSQL + Flyway
```

package는 기술 계층 전체를 한 폴더에 모으기보다 `room`, `participant`, `response`, `sharing`, `session`, `realtime`, `retention` 책임으로 나눈다.

## 데이터 모델

- `question_sets`: 재사용 가능한 최소 질문 묶음
- `questions`: 질문 순서와 문구
- `rooms`: 상태, public ID, random code, 현재 round, optimistic version
- `participants`: Room 내부 이름과 작성 완료 여부
- `room_sessions`: Host/Participant 역할과 token hash
- `responses`: Room, Participant, Question 경계를 포함한 답변
- `sharing_rounds`: 나눔 시작 시 고정한 random 순서

`responses`와 `sharing_rounds`는 composite foreign key와 Room 조건 query로 cross-room 연결을 방지한다.

## Authorization boundary

- Room Code는 최초 join용 locator다.
- public Room ID는 URL routing용 locator다.
- 둘 중 하나만 알아서는 Room 상태나 콘텐츠를 읽을 수 없다.
- 모든 Room API는 cookie token hash와 session의 Room ID가 URL Room과 같은지 검증한다.
- Host endpoint는 `HOST`, 답변/reveal endpoint는 `PARTICIPANT` role을 검증한다.
- Participant session을 잃은 사용자를 이름만으로 복구하지 않는다.

QR에는 `#join=ROOM_CODE` fragment를 사용한다. fragment는 최초 HTML request와 Referrer로 전송되지 않는다. Join 성공 후 URL은 `#room=PUBLIC_ROOM_ID`로 교체된다.

## Privacy boundary

Anonymous DTO는 Entity를 사용하지 않고 명시적으로 조립한다.

```json
{
  "state": "ANONYMOUS",
  "sequence": 0,
  "total": 7,
  "answers": [
    {
      "question": "최근 감사하거나 기뻤던 일은 무엇인가요?",
      "answer": "오래 고민하던 일이 조금 풀렸다."
    }
  ],
  "canReveal": false,
  "roomVersion": 3
}
```

Anonymous 응답에는 participant ID, 이름, session token, 내부 round ID를 넣지 않는다. 실제 작성자 session에만 `canReveal=true`가 전달되고, 이름은 reveal 이후에만 포함된다.

답변 request body와 답변 본문은 application log에 기록하지 않는다. 예상하지 못한 exception도 안전한 Problem Detail로 변환한다.

## 동시성

- Room에는 JPA `@Version`을 사용한다.
- Host mutation은 현재 `expectedVersion`을 전달한다.
- `next`는 `expectedRound`도 함께 전달한다.
- state transition은 Room row를 transaction 동안 잠근다.
- reveal은 `participant_id`, 현재 sequence, `ANONYMOUS` 조건을 포함한 conditional update다.

따라서 빠른 double click이나 두 개의 Host tab에서 같은 요청이 들어와도 round가 두 칸 이동하지 않는다.

## SSE 흐름

```text
DB transaction commit
        │
        ▼
room별 SSE trigger
        │
        ▼
browser가 /state 또는 /sharing/current 재조회
        │
        ▼
서버 상태 기준으로 화면 복원
```

SSE payload에는 이벤트 종류, Room version, 발생 시각만 담는다. 답변과 이름은 담지 않는다. heartbeat는 기본 20초, server emitter timeout은 10분이다. timeout, network 변경, browser background 복귀 후 자동 재연결한다.

MVP는 단일 Backend instance를 전제로 room별 `SseEmitter`를 메모리에 관리한다.

## 삭제 정책

`POST /complete` transaction은 Room을 `COMPLETED`로 바꾸고 Participant 연결을 끊은 뒤 Participant를 삭제한다. FK cascade로 Response와 SharingRound도 함께 삭제한다.

종료 후 남는 것은 다음뿐이다.

- Room public ID와 code
- `COMPLETED` 상태와 종료 시각
- 이름과 연결되지 않은 session token hash

이 tombstone은 기본 24시간 후 삭제한다. 활성 Room은 기본 12시간 뒤 만료되며 cleanup job이 전체 데이터를 삭제한다.

## 운영 제약과 확장 조건

- 한 instance에서 최대 1,000 SSE connection을 부하 테스트한다.
- 두 instance 이상으로 확장하기 전 cross-instance event propagation이 필요하다.
- DB backup에는 삭제 데이터가 backup retention 동안 남을 수 있다.
- 실제 운영 전 iOS Safari의 cookie, background, SSE reconnect를 확인한다.
- application-level rate limiter는 단일 instance 기준이다. 다중 instance에서는 edge/shared limiter로 교체한다.
