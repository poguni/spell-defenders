import { useEffect, useMemo, useState } from 'react';
import { Stage } from './components/Stage';
import { ALL_PROBLEMS } from './data/problems';
import { availableProblems, readPlayOptions } from './game/pool';
import { buildStageProblems, noteProblems, recordReview, recordStage } from './game/progress';
import { setSoundEnabled } from './game/sound';
import { STAGE_PROBLEM_COUNT, shuffle, stageOutcomes, summarize, type GameState, type StageSummary } from './game/stage';
import { findStage, isUnlocked, stagePool, stagesOf, type StageDef } from './game/stages';
import { TAGS, type Level, type Problem } from './judge/types';
import { BattleScreen } from './screens/BattleScreen';
import { ClassBattleScreen } from './screens/ClassBattleScreen';
import { ClassSetupScreen, type ClassSettings } from './screens/ClassSetupScreen';
import { DexScreen } from './screens/DexScreen';
import { GenerateScreen } from './screens/GenerateScreen';
import { KeySettingsScreen } from './screens/KeySettingsScreen';
import { LevelSelectScreen } from './screens/LevelSelectScreen';
import { MapScreen } from './screens/MapScreen';
import { NotesScreen } from './screens/NotesScreen';
import { ProblemSetScreen } from './screens/ProblemSetScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { StartScreen } from './screens/StartScreen';
import { TeacherGateScreen } from './screens/TeacherGateScreen';
import { TeacherMenuScreen } from './screens/TeacherMenuScreen';
import { cleanNickname, clearSave, emptySave, loadSave, writeSave } from './storage/save';
import {
  activeProblems,
  emptyTeacher,
  loadTeacher,
  resetTeacher,
  writeTeacher,
  type ProblemSet,
} from './storage/teacher';

const PLAY = readPlayOptions(window.location.search, import.meta.env.DEV);

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
  | { name: 'dex' }
  | { name: 'classSetup' }
  | { name: 'classBattle'; problems: Problem[] }
  | { name: 'teacherGate' }
  | { name: 'teacher' }
  | { name: 'teacherKey' }
  | { name: 'teacherGenerate' }
  | { name: 'teacherSet'; setId: string };

export function App() {
  const [save, setSave] = useState(loadSave);
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [round, setRound] = useState(0);
  // 학급 수비전에서 마지막으로 고른 값. 기록이 아니라서 저장하지 않는다
  const [classSettings, setClassSettings] = useState<ClassSettings | null>(null);
  const [teacher, setTeacher] = useState(loadTeacher);
  // PIN을 한 번 맞히면 페이지를 새로 열 때까지 교사 메뉴가 열려 있다
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);

  useEffect(() => writeTeacher(teacher), [teacher]);

  // 출제할 문제: 내장 문제 + 출제가 켜진 교사 세트의 승인한 문제
  const AVAILABLE = useMemo(() => availableProblems([...ALL_PROBLEMS, ...activeProblems(teacher)], PLAY), [teacher]);

  /** 스테이지에서 낼 수 있는 문제. 개발 스위치로 문제를 골랐으면 그 문제만 */
  const poolOf = (stage: StageDef): Problem[] => (PLAY.problemIds ? AVAILABLE : stagePool(stage, AVAILABLE));
  const levelProblems = (level: Level) => AVAILABLE.filter((p) => p.level === level);
  const OPEN_LEVELS = ([1, 2, 3] as Level[]).filter((level) => levelProblems(level).length > 0);
  const levelTags = (level: Level) => TAGS[level].filter((tag) => levelProblems(level).some((p) => p.tag === tag));
  const classPool = ({ level, tags }: Pick<ClassSettings, 'level' | 'tags'>) =>
    levelProblems(level).filter((p) => tags.includes(p.tag));

  const updateSets = (change: (sets: ProblemSet[]) => ProblemSet[]) =>
    setTeacher((t) => ({ ...t, sets: change(t.sets) }));

  /** 생성한 문제를 새 세트(setId null)나 기존 세트에 더하고, 그 세트 id를 돌려준다 */
  const saveGenerated = (setId: string | null, name: string, problems: Problem[]) => {
    const id = setId ?? `set-${Date.now().toString(36)}`;
    updateSets((sets) =>
      setId
        ? sets.map((s) => (s.id === setId ? { ...s, problems: [...s.problems, ...problems] } : s))
        : [...sets, { id, name, active: true, problems }],
    );
    return id;
  };

  useEffect(() => writeSave(save), [save]);
  useEffect(() => setSoundEnabled(save.soundOn), [save.soundOn]);
  const toggleSound = () => setSave((s) => ({ ...s, soundOn: !s.soundOn }));

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

  // 학급 수비전은 save를 바꾸지 않는다(기획서 5.2: 기록 없음)
  const startClass = (settings: ClassSettings) => {
    setClassSettings(settings);
    setRound((r) => r + 1);
    setScreen({ name: 'classBattle', problems: shuffle(classPool(settings)).slice(0, settings.count) });
  };

  const goMap = () => setScreen(level ? { name: 'map' } : { name: 'level' });

  return (
    <Stage>
      {screen.name === 'start' && (
        <StartScreen
          nickname={save.nickname}
          onStart={goMap}
          onClassMode={() => setScreen({ name: 'classSetup' })}
          onTeacher={() => setScreen(teacherUnlocked ? { name: 'teacher' } : { name: 'teacherGate' })}
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
          soundOn={save.soundOn}
          onToggleSound={toggleSound}
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
          soundOn={save.soundOn}
          onToggleSound={toggleSound}
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
          tags={levelTags(level)}
          dex={save.dex}
          onBack={goMap}
        />
      )}

      {screen.name === 'classSetup' && (
        <ClassSetupScreen
          openLevels={OPEN_LEVELS}
          tagsOf={levelTags}
          poolSize={(level, tags) => classPool({ level, tags }).length}
          settings={classSettings}
          onStart={startClass}
          onBack={() => setScreen({ name: 'start' })}
        />
      )}

      {screen.name === 'classBattle' && classSettings && (
        <ClassBattleScreen
          key={round}
          problems={screen.problems}
          soundOn={save.soundOn}
          onToggleSound={toggleSound}
          onAgain={() => startClass(classSettings)}
          onSetup={() => setScreen({ name: 'classSetup' })}
          onHome={() => setScreen({ name: 'start' })}
        />
      )}

      {screen.name === 'teacherGate' && (
        <TeacherGateScreen
          pinHash={teacher.pinHash}
          onSetPin={(pinHash) => setTeacher((t) => ({ ...t, pinHash }))}
          onUnlock={() => {
            setTeacherUnlocked(true);
            setScreen({ name: 'teacher' });
          }}
          onReset={() => {
            resetTeacher();
            setTeacher(emptyTeacher());
          }}
          onBack={() => setScreen({ name: 'start' })}
        />
      )}

      {screen.name === 'teacher' && (
        <TeacherMenuScreen
          sets={teacher.sets}
          onToggleSet={(setId) => updateSets((sets) => sets.map((s) => (s.id === setId ? { ...s, active: !s.active } : s)))}
          onOpenSet={(setId) => setScreen({ name: 'teacherSet', setId })}
          onDeleteSet={(setId) => updateSets((sets) => sets.filter((s) => s.id !== setId))}
          onGenerate={() => setScreen({ name: 'teacherGenerate' })}
          onKeySettings={() => setScreen({ name: 'teacherKey' })}
          onBack={() => setScreen({ name: 'start' })}
        />
      )}

      {screen.name === 'teacherKey' && (
        <KeySettingsScreen
          model={teacher.model}
          onModel={(model) => setTeacher((t) => ({ ...t, model }))}
          onBack={() => setScreen({ name: 'teacher' })}
        />
      )}

      {screen.name === 'teacherGenerate' && (
        <GenerateScreen
          model={teacher.model}
          sets={teacher.sets}
          onSave={saveGenerated}
          onOpenSet={(setId) => setScreen({ name: 'teacherSet', setId })}
          onKeySettings={() => setScreen({ name: 'teacherKey' })}
          onBack={() => setScreen({ name: 'teacher' })}
        />
      )}

      {screen.name === 'teacherSet' &&
        (() => {
          const set = teacher.sets.find((s) => s.id === screen.setId);
          return set ? (
            <ProblemSetScreen
              set={set}
              onChange={(problems) => updateSets((sets) => sets.map((s) => (s.id === set.id ? { ...s, problems } : s)))}
              onBack={() => setScreen({ name: 'teacher' })}
            />
          ) : null;
        })()}
    </Stage>
  );
}
