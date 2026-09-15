# 구르미 테스트 캐릭터 이미지

구르미 테스트의 홈 카드와 결과 화면에 쓰는 캐릭터 원본 이미지를 보관합니다.

## 현재 사용하는 파일

### `teaser.png`

- 과거 사전 공개 포스터. 현재 홈의 테스트 목록과 README는 기존 `sunny.png` 캐릭터를 사용
- 실제 테스트 화면의 문구와 버튼은 접근성과 반응형 처리를 위해 HTML/CSS로 구현

### 캐릭터 원본

- `arong.png`
- `chokchok.png`
- `dalmong.png`
- `electric.png`
- `hoowoo.png`
- `mongsil.png`
- `pogeun.png`
- `sunny.png`
- 결과 화면에서 유형별 캐릭터로 사용하며 원본 파일은 변경하지 않음

## 선택 파일

결과별 저장 이미지는 `public/images/results/gureumi`, 공통 소셜 미리보기는
`public/images/share/gureumi-v1.png`에서 관리합니다.

- 결과 저장 이미지: `1080 × 1920`
- 소셜 미리보기: `1200 × 630`

## 파일 최적화

- 홈 미리보기는 가능하면 `500 KB` 이하
- 공유 이미지는 가능하면 `1 MB` 이하
- 색 공간은 `sRGB`
- 투명 배경이 필요하지 않으면 알파 채널 제거
