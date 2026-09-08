import { PrimaryButton } from '../../../components/PrimaryButton';
import { ScreenLayout } from '../../../components/ScreenLayout';
import { ShareNotice } from '../../../components/ShareNotice';
import { resolveLadder } from '../domain/draw';
import { getPickerModeDefinition } from '../domain/modeCatalog';
import { getSpecialOutcomeValues } from '../domain/outcomes';
import type { DrawResult } from '../domain/types';
import { LadderBoard } from '../components/LadderBoard';
import { usePickerShare } from '../hooks/usePickerShare';
import type { PickerController } from '../hooks/useGroupPicker';

export function PickerResultScreen({
  result,
  activeLadderStart,
  revealedLadderStarts,
  revealAllQueue,
  setActiveLadderStart,
  revealAllLadderResults,
  prepareDraw,
  resetToSetup,
  onBackHome,
}: Pick<
  PickerController,
  | 'activeLadderStart'
  | 'revealedLadderStarts'
  | 'revealAllQueue'
  | 'setActiveLadderStart'
  | 'revealAllLadderResults'
  | 'prepareDraw'
  | 'resetToSetup'
> & { onBackHome: () => void } & { result: DrawResult }) {
  const resultMode = getPickerModeDefinition(result.mode);
  const destinations = result.mode === 'ladder' ? resolveLadder(result.ladder) : [];
  const specialOutcomeValues = getSpecialOutcomeValues(
    result.mode === 'ladder' ? result.outcomes : [],
  );
  const allLadderResultsRevealed =
    result.mode === 'ladder' && revealedLadderStarts.size === result.orderedNames.length;
  const { message, isSharing, shareResult } = usePickerShare(result);
  return (
    <ScreenLayout className={`group-picker-screen group-picker-result is-${result.mode}`}>
      <ShareNotice message={message} />
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>
      <header className="group-picker-result__header">
        <p className="eyebrow">오늘은 누구? · {resultMode.title}</p>
        <h1>
          {result.mode === 'sharing'
            ? '이 순서로 시작해요'
            : result.mode === 'groups'
              ? '나눔 조가 정해졌어요'
              : result.mode === 'pairs'
                ? '원투원 짝이 정해졌어요'
                : result.mode === 'supporter'
                  ? '이번 주 내 기도 후원자는'
                  : result.mode === 'ladder'
                    ? allLadderResultsRevealed
                      ? '사다리 결과'
                      : '누구부터 내려갈까요?'
                    : '오늘은 바로'}
        </h1>
      </header>

      {result.mode === 'ladder' && result.ladder ? (
        <>
          <LadderBoard
            names={result.orderedNames}
            outcomes={result.outcomes}
            ladder={result.ladder}
            activeStart={activeLadderStart}
            revealedStarts={revealedLadderStarts}
            onSelectStart={setActiveLadderStart}
          />
          {!allLadderResultsRevealed ? (
            <button
              className="group-picker-reveal-all"
              type="button"
              disabled={activeLadderStart !== null}
              onClick={revealAllLadderResults}
            >
              {revealAllQueue ? '특별 결과 찾는 중…' : '결과 한 번에 보기'}
            </button>
          ) : null}
          {revealedLadderStarts.size > 0 ? (
            <ol className="group-picker-ladder-results">
              {result.orderedNames.map((name, index) =>
                revealedLadderStarts.has(index) ? (
                  <li
                    className={
                      specialOutcomeValues.has(result.outcomes[destinations[index]])
                        ? 'is-special'
                        : undefined
                    }
                    key={name}
                  >
                    <strong>{name}</strong>
                    <span>→</span>
                    <b>{result.outcomes[destinations[index]]}</b>
                  </li>
                ) : null,
              )}
            </ol>
          ) : null}
        </>
      ) : result.mode === 'groups' || result.mode === 'pairs' ? (
        <div className="group-picker-groups">
          {result.groups.map((group, groupIndex) => (
            <section aria-labelledby={`group-${groupIndex + 1}`} key={`group-${groupIndex + 1}`}>
              <h2 id={`group-${groupIndex + 1}`}>
                {groupIndex + 1}
                {result.mode === 'groups' ? '조' : '팀'}
              </h2>
              <div>
                {group.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : result.mode === 'supporter' ? (
        <ol className="group-picker-supporters">
          {result.supportAssignments.map(({ supporter, recipient }) => (
            <li key={supporter}>
              <strong>{supporter}</strong>
              <span aria-hidden="true">→</span>
              <b>{recipient}</b>
            </li>
          ))}
        </ol>
      ) : result.mode === 'prayer' ? (
        <div className="group-picker-prayer-result">
          <span aria-hidden="true">✦</span>
          <strong>{result.orderedNames[0]}</strong>
        </div>
      ) : result.mode === 'lottery' ? (
        <div className="group-picker-winners">
          {result.orderedNames.slice(0, result.winnerCount).map((name, index) => (
            <div className="group-picker-winner" key={name}>
              <span>{index + 1}</span>
              <strong>{name}</strong>
            </div>
          ))}
        </div>
      ) : (
        <ol className="group-picker-order">
          {result.orderedNames.map((name, index) => (
            <li className={index === 0 ? 'is-first' : undefined} key={name}>
              <span>{index + 1}</span>
              <strong>{name}</strong>
              {index === 0 && result.mode === 'sharing' ? <b>먼저</b> : null}
            </li>
          ))}
        </ol>
      )}

      <div className="group-picker-result__actions">
        {result.mode !== 'ladder' || allLadderResultsRevealed ? (
          <PrimaryButton disabled={isSharing} onClick={shareResult}>
            {isSharing ? '이미지 만드는 중…' : '결과 이미지 공유하기'}
          </PrimaryButton>
        ) : null}
        {result.mode !== 'ladder' || allLadderResultsRevealed ? (
          <button className="group-picker-redraw" type="button" onClick={prepareDraw}>
            다시 뽑기
          </button>
        ) : null}
        <button type="button" onClick={resetToSetup}>
          설정 바꾸기
        </button>
        <button type="button" onClick={onBackHome}>
          홈으로
        </button>
      </div>
    </ScreenLayout>
  );
}
