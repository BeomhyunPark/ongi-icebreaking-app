import { ScreenLayout } from '../../../components/ScreenLayout';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { WorldCupController } from '../hooks/useWorldCup';
import { WORLD_CUP_CATEGORIES } from '../data/categories';
import { findCategory, SIZE_OPTIONS, SIZE_COPY } from '../data/catalog';
import { getRoundLabel } from '../domain/tournament';

export function WorldCupSetupScreen({
  savedSession,
  selectedCategoryId,
  selectedSize,
  setSelectedSize,
  selectCategory,
  resumeTournament,
  clearSavedTournament,
  startNewTournament,
  onBackHome,
}: Pick<
  WorldCupController,
  | 'savedSession'
  | 'selectedCategoryId'
  | 'selectedSize'
  | 'setSelectedSize'
  | 'selectCategory'
  | 'resumeTournament'
  | 'clearSavedTournament'
  | 'startNewTournament'
> & { onBackHome: () => void }) {
  const savedState = savedSession?.current;
  const savedCategory = savedSession ? findCategory(savedSession.categoryId) : null;
  const selectedCategory = findCategory(selectedCategoryId);
  const availableSizes = SIZE_OPTIONS.filter(
    (size) => size <= selectedCategory.candidateIds.length,
  );

  return (
    <ScreenLayout className="world-cup-screen world-cup-setup">
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>

      <header className="world-cup-hero">
        <p className="eyebrow">온기 · 토너먼트</p>
        <h1 aria-label="최애 월드컵">
          최애
          <br />
          월드컵
        </h1>
        <p className="world-cup-hero__subtitle">오늘 가장 끌리는 하나를 남겨보세요.</p>
      </header>

      {savedState ? (
        <section className="world-cup-resume" aria-labelledby="resume-title">
          <span>진행 중인 대진</span>
          <h2 id="resume-title">
            {savedCategory?.title} · {savedState.tournamentSize}강
          </h2>
          <p>
            {getRoundLabel(savedState.roundCandidateIds.length)} · 선택 {savedState.history.length}
            개 저장
          </p>
          <div>
            <PrimaryButton onClick={resumeTournament}>이어하기</PrimaryButton>
            <button type="button" onClick={clearSavedTournament}>
              저장된 대진 지우기
            </button>
          </div>
        </section>
      ) : null}

      <section className="world-cup-setup__section" aria-labelledby="topic-title">
        <span className="world-cup-step">01</span>
        <h2 id="topic-title">오늘의 주제</h2>
        <div className="world-cup-topic-options">
          {WORLD_CUP_CATEGORIES.map((category) => (
            <button
              className={`world-cup-topic-card${selectedCategoryId === category.id ? ' is-selected' : ''}`}
              type="button"
              aria-pressed={selectedCategoryId === category.id}
              onClick={() => selectCategory(category.id)}
              key={category.id}
            >
              <img src={category.image} alt="" />
              <span>
                <strong>{category.title}</strong>
              </span>
              <b aria-hidden="true">✓</b>
            </button>
          ))}
        </div>
      </section>

      <section className="world-cup-setup__section" aria-labelledby="size-title">
        <span className="world-cup-step">02</span>
        <h2 id="size-title">몇 강부터 시작할까요?</h2>
        <div className="world-cup-size-options">
          {availableSizes.map((size) => (
            <button
              className={selectedSize === size ? 'is-selected' : undefined}
              type="button"
              aria-label={`${size}강, ${SIZE_COPY[size]}`}
              aria-pressed={selectedSize === size}
              onClick={() => setSelectedSize(size)}
              key={size}
            >
              <strong>{size}강</strong>
              <small>{SIZE_COPY[size]}</small>
            </button>
          ))}
        </div>
      </section>

      <PrimaryButton
        className="world-cup-start"
        onClick={() => startNewTournament(selectedCategoryId, selectedSize)}
      >
        {selectedCategory.title} {selectedSize}강 시작하기
      </PrimaryButton>
      <p className="world-cup-credit">창작자 · hyunee</p>
    </ScreenLayout>
  );
}
