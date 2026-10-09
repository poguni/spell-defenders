import { useEffect, useState } from 'react';
import { Stage } from './components/Stage';
import { ALL_PROBLEMS } from './data/problems';
import { availableProblems, readPlayOptions } from './game/pool';
import { buildStageProblems, noteProblems, recordReview, recordStage } from './game/progress';
import { STAGE_PROBLEM_COUNT, stageOutcomes, summarize, type GameState, type StageSummary } from './game/stage';
import { findStage, isUnlocked, stagePool, stagesOf, type StageDef } from './game/stages';
import { TAGS, type Level, type Problem } from './judge/types';
import { BattleScreen } from './screens/BattleScreen';
import { DexScreen } from './screens/DexScreen';
import { LevelSelectScreen } from './screens/LevelSelectScreen';
import { MapScreen } from './screens/MapScreen';
import { NotesScreen } from './screens/NotesScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { StartScreen } from './screens/StartScreen';
import { cleanNickname, clearSave, emptySave, loadSave, writeSave } from './storage/save';

const PLAY = readPlayOptions(window.location.search, import.meta.env.DEV);
const AVAILABLE = availableProblems(ALL_PROBLEMS, PLAY);

/** 스테이지에서 낼 수 있는 문제. 개발 스위치로 문제를 골랐으면 그 문제만 */
function poolOf(stage: StageDef): Problem[] {
  return PLAY.problemIds ? AVAILABLE : stagePool(stage, AVAILABLE);
}

const levelProblems = (level: Level) => AVAILABLE.filter((p) => p.level === level);
const OPEN_LEVELS = ([1, 2, 3] as Level[]).filter((level) => levelProblems(level).length > 0);

type Screen =
  | { name: 'start' }
  | { name: 'level' }
  | { name: 'map' }
  | { name: 'battle'; stageId: string; problems: Problem[] }
  | {
      name: 'result';
      stageId: string;
      summary: StageSummary;
      review: Problem[];
      mastered: string[];
      newDex: string[];
    }
  | { name: 'review'; problems: Problem[] }
  | { name: 'notes' }
  | { name: 'dex' };

export function App() {
  const [save, setSave] = useState(loadSave);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [round, setRound] = useState(0);

  useEffect(() => writeSave(save), [save]);

  const level = save.level;

  const startStage = (stageId: string) => {
    const stage = findStage(stageId)!;
    // 간격 반복: 같은 단계 오답 노트 문제를 섞는다
    const notes = noteProblems(save, PLAY.problemIds ? AVAILABLE : levelProblems(stage.level));
    const problems = buildStageProblems(poolOf(stage), notes, STAGE_PROBLEM_COUNT);
    setRound((r) => r + 1); // round가 바뀌면 BattleScreen을 새로 만든다
    setScreen({ name: 'battle', stageId, problems });
  };

  const finishStage = (stageId: string, state: GameState) => {
    const summary = summarize(state);
    const outcomes = stageOutcomes(state);
    const record = recordStage(save, outcomes);
    const best = Math.max(save.stars[stageId] ?? 0, summary.stars);
    setSave({ ...record.save, stars: { ...record.save.stars, [stageId]: best } });
    setScreen({
      name: 'result',
      stageId,
      summary,
      review: outcomes.filter((o) => o.outcome !== 'correct').map((o) => o.problem),
      mastered: record.mastered,
      newDex: record.newDex,
    });
  };

  const goMap = () => setScreen(level ? { name: 'map' } : { name: 'level' });

  return (
    <Stage>
      {screen.name === 'start' && (
        <StartScreen
          nickname={save.nickname}
          onStart={goMap}
          onClearRecords={() => {
            clearSave();
            setSave(emptySave());
          }}
        />
      )}

      {screen.name === 'level' && (
        <LevelSelectScreen
          level={level}
          nickname={save.nickname}
          openLevels={OPEN_LEVELS}
          onConfirm={(chosen, nickname) => {
            setSave((s) => ({ ...s, level: chosen, nickname: cleanNickname(nickname) }));
            setScreen({ name: 'map' });
          }}
        />
      )}

      {screen.name === 'map' && level && (
        <MapScreen
          level={level}
          stages={stagesOf(level).map((stage) => ({
            stage,
            stars: save.stars[stage.id] ?? 0,
            unlocked: isUnlocked(stage, save.stars),
            ready: poolOf(stage).length > 0,
          }))}
          noteCount={noteProblems(save, levelProblems(level)).length}
          onPlay={startStage}
          onNotes={() => setScreen({ name: 'notes' })}
          onDex={() => setScreen({ name: 'dex' })}
          onChangeLevel={() => setScreen({ name: 'level' })}
          onHome={() => setScreen({ name: 'start' })}
        />
      )}

      {screen.name === 'battle' && (
        <BattleScreen
          key={round}
          problems={screen.problems}
          onFinish={(state) => finishStage(screen.stageId, state)}
        />
      )}

      {screen.name === 'result' && (
        <ResultScreen
          summary={screen.summary}
          reviewCount={screen.review.length}
          mastered={screen.mastered}
          newDex={screen.newDex}
          onReview={() => setScreen({ name: 'review', problems: screen.review })}
          onRetry={() => startStage(screen.stageId)}
          onMap={goMap}
        />
      )}

      {screen.name === 'review' && (
        <ReviewScreen
          problems={screen.problems}
          onAnswer={(problem, correct) => setSave((s) => recordReview(s, problem, correct))}
          onDone={goMap}
        />
      )}

      {screen.name === 'notes' && level && (
        <NotesScreen
          problems={noteProblems(save, levelProblems(level))}
          tagStreaks={save.tagStreaks}
          onBack={goMap}
        />
      )}

      {screen.name === 'dex' && level && (
        <DexScreen
          level={level}
          tags={TAGS[level].filter((tag) => levelProblems(level).some((p) => p.tag === tag))}
          dex={save.dex}
          onBack={goMap}
        />
      )}
    </Stage>
  );
}
