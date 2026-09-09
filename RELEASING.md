# 온기 버전 관리

## 버전 기준

- 패치 (`v0.0.1`): 버그, 호환성, 문구와 작은 UI 수정
- 마이너 (`v0.1.0`): 새 기능 또는 여러 화면에 걸친 사용자 경험 개선
- 메이저 (`v1.0.0`): 제품 정체성, 데이터 구조 또는 서비스 아키텍처의 큰 전환

## 릴리즈 체크리스트

1. 변경 크기에 맞는 버전을 결정한다.
2. `package.json`, `package-lock.json`, `backend/build.gradle`을 같은 버전으로 맞춘다.
3. `releaseHistory.ts`의 첫 항목에 새 버전을 추가하고 `current` 표시는 하나만 둔다.
4. `CHANGELOG.md` 첫 항목에 같은 버전과 사용자 관점의 변경 내용을 기록한다.
5. `npm run verify`, 백엔드 테스트, `npm run test:e2e`를 통과시킨다. 브라우저 테스트 환경은 `docs/BROWSER_TESTS.md`를 따른다.
6. 릴리즈 커밋 뒤 같은 번호의 `vX.Y.Z` 태그를 만든다.
7. 원격 배포가 끝나면 운영 화면의 버전과 업데이트 내역을 확인한다.

버전 파일과 현재 업데이트 기록이 어긋나면 `tests/versionConsistency.test.ts`가 검증 단계에서 실패한다.
