// ==============================================================
// ChallengePanel — the challenge mode UI overlay
//
// Handles all four phases of a challenge:
//   select → predict → simulate → score
//
// Matches the existing glassmorphism style used by other panels.
// ==============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useChallengeStore } from '../store/challengeStore';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';
import type { Challenge, UserPrediction } from '../challenges/types';
import { getBestScore } from '../challenges/leaderboard';

// --------------- Shared Styles --------------------------------

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 50,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(20, 20, 40, 0.95)',
  backdropFilter: 'blur(10px)',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  padding: 16,
  zIndex: 300,
  fontFamily: 'monospace',
  color: '#ddd',
  maxWidth: 480,
  minWidth: 360,
  maxHeight: 'calc(100vh - 120px)',
  overflowY: 'auto',
};

const headerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 12,
  color: '#aaccff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const buttonBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  transition: 'all 0.15s',
};

const primaryButton: React.CSSProperties = {
  ...buttonBase,
  background: 'rgba(100,150,255,0.3)',
  color: '#aaccff',
  border: '1px solid rgba(100,150,255,0.5)',
};

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  background: 'rgba(40,40,60,0.8)',
  color: '#ccc',
};

const difficultyColors: Record<string, string> = {
  beginner: '#4ade80',
  intermediate: '#fbbf24',
  advanced: '#f87171',
};

// --------------- Sub-components ------------------------------

/** Close button in panel header */
const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    data-testid="challenge-close"
    onClick={onClick}
    style={{
      background: 'none',
      border: 'none',
      color: '#666',
      cursor: 'pointer',
      fontSize: 16,
      padding: '0 4px',
    }}
  >
    ✕
  </button>
);

// --------------- Select Phase --------------------------------

const SelectPhase: React.FC = () => {
  const challenges = useChallengeStore((s) => s.challenges);
  const selectChallenge = useChallengeStore((s) => s.selectChallenge);

  return (
    <div data-testid="challenge-select">
      <div style={headerStyle}>
        <span>Select a Challenge</span>
        <CloseButton
          onClick={() => useUIStore.getState().toggleChallengePanel()}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} onSelect={selectChallenge} />
        ))}
      </div>
    </div>
  );
};

const ChallengeCard: React.FC<{
  challenge: Challenge;
  onSelect: (id: string) => void;
}> = ({ challenge, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const bestScore = getBestScore(challenge.id);

  return (
    <button
      data-testid={`challenge-card-${challenge.id}`}
      onClick={() => onSelect(challenge.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: 12,
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.1)',
        background: hovered ? 'rgba(100,150,255,0.15)' : 'rgba(30,30,50,0.8)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'monospace',
        transition: 'background 0.15s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#ddd', fontSize: 12, fontWeight: 'bold' }}>
          {challenge.title}
        </span>
        <span
          style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 3,
            background: difficultyColors[challenge.difficulty] + '22',
            color: difficultyColors[challenge.difficulty],
          }}
        >
          {challenge.difficulty}
        </span>
      </div>
      <div style={{ color: '#999', fontSize: 10, marginTop: 4 }}>
        {challenge.description}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 9,
        }}
      >
        <span style={{ color: '#666' }}>{challenge.category}</span>
        {bestScore !== null && (
          <span style={{ color: '#aaccff' }}>Best: {bestScore}/100</span>
        )}
      </div>
    </button>
  );
};

// --------------- Predict Phase --------------------------------

const PredictPhase: React.FC = () => {
  const challenge = useChallengeStore((s) => s.activeChallenge);
  const submitPrediction = useChallengeStore((s) => s.submitPrediction);
  const resetChallenge = useChallengeStore((s) => s.resetChallenge);

  if (!challenge) return null;
  const { question } = challenge;

  return (
    <div data-testid="challenge-predict">
      <div style={headerStyle}>
        <span>{challenge.title}</span>
        <CloseButton onClick={resetChallenge} />
      </div>
      <p
        style={{
          fontSize: 12,
          color: '#ccc',
          lineHeight: 1.5,
          margin: '0 0 16px 0',
        }}
      >
        {question.prompt}
      </p>
      {question.type === 'multiple-choice' && (
        <MultipleChoiceInput
          options={question.options}
          onSubmit={submitPrediction}
        />
      )}
      {question.type === 'numeric-estimate' && (
        <NumericEstimateInput
          unit={question.unit}
          range={question.range}
          onSubmit={submitPrediction}
        />
      )}
      {question.type === 'ordering' && (
        <OrderingInput items={question.items} onSubmit={submitPrediction} />
      )}
      <button
        data-testid="challenge-back"
        onClick={resetChallenge}
        style={{ ...secondaryButton, marginTop: 12, width: '100%' }}
      >
        Back to challenges
      </button>
    </div>
  );
};

const MultipleChoiceInput: React.FC<{
  options: Array<{ key: string; label: string }>;
  onSubmit: (prediction: UserPrediction) => void;
}> = ({ options, onSubmit }) => {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          data-testid={`choice-${opt.key}`}
          onClick={() => setSelected(opt.key)}
          style={{
            ...secondaryButton,
            width: '100%',
            textAlign: 'left',
            border:
              selected === opt.key
                ? '2px solid #aaccff'
                : '1px solid rgba(255,255,255,0.15)',
            background:
              selected === opt.key
                ? 'rgba(100,150,255,0.2)'
                : 'rgba(40,40,60,0.8)',
          }}
        >
          {opt.label}
        </button>
      ))}
      <button
        data-testid="challenge-submit"
        onClick={() => selected && onSubmit(selected)}
        disabled={!selected}
        style={{
          ...primaryButton,
          marginTop: 8,
          opacity: selected ? 1 : 0.5,
          cursor: selected ? 'pointer' : 'not-allowed',
        }}
      >
        Submit Prediction
      </button>
    </div>
  );
};

const NumericEstimateInput: React.FC<{
  unit: string;
  range: [number, number];
  onSubmit: (prediction: UserPrediction) => void;
}> = ({ unit, range, onSubmit }) => {
  const [value, setValue] = useState<string>('');
  const numVal = Number(value);
  const isValid =
    value !== '' && !isNaN(numVal) && numVal >= range[0] && numVal <= range[1];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          data-testid="numeric-input"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={range[0]}
          max={range[1]}
          step={0.1}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(30,30,50,0.9)',
            color: '#ddd',
            fontFamily: 'monospace',
            fontSize: 14,
            outline: 'none',
          }}
          placeholder={`${range[0]}–${range[1]}`}
        />
        <span style={{ color: '#999', fontSize: 14 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>
        Range: {range[0]}–{range[1]} {unit}
      </div>
      <button
        data-testid="challenge-submit"
        onClick={() => isValid && onSubmit(numVal)}
        disabled={!isValid}
        style={{
          ...primaryButton,
          marginTop: 12,
          width: '100%',
          opacity: isValid ? 1 : 0.5,
          cursor: isValid ? 'pointer' : 'not-allowed',
        }}
      >
        Submit Prediction
      </button>
    </div>
  );
};

const OrderingInput: React.FC<{
  items: Array<{ key: string; label: string }>;
  onSubmit: (prediction: UserPrediction) => void;
}> = ({ items, onSubmit }) => {
  const [order, setOrder] = useState<Array<{ key: string; label: string }>>(
    () => [...items],
  );

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    setOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    setOrder(newOrder);
  };

  return (
    <div>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
        Use arrows to reorder (top = smallest):
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {order.map((item, i) => (
          <div
            key={item.key}
            data-testid={`order-item-${item.key}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(30,30,50,0.8)',
            }}
          >
            <span style={{ color: '#666', fontSize: 10, width: 16 }}>
              {i + 1}.
            </span>
            <span style={{ flex: 1, fontSize: 11, color: '#ddd' }}>
              {item.label}
            </span>
            <button
              data-testid={`move-up-${item.key}`}
              onClick={() => moveUp(i)}
              disabled={i === 0}
              style={{
                background: 'none',
                border: 'none',
                color: i === 0 ? '#444' : '#aaccff',
                cursor: i === 0 ? 'default' : 'pointer',
                fontSize: 12,
                padding: 2,
              }}
            >
              ▲
            </button>
            <button
              data-testid={`move-down-${item.key}`}
              onClick={() => moveDown(i)}
              disabled={i === order.length - 1}
              style={{
                background: 'none',
                border: 'none',
                color: i === order.length - 1 ? '#444' : '#aaccff',
                cursor: i === order.length - 1 ? 'default' : 'pointer',
                fontSize: 12,
                padding: 2,
              }}
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <button
        data-testid="challenge-submit"
        onClick={() => onSubmit(order.map((item) => item.key))}
        style={{ ...primaryButton, marginTop: 12, width: '100%' }}
      >
        Submit Prediction
      </button>
    </div>
  );
};

// --------------- Simulate Phase --------------------------------

const SimulatePhase: React.FC = () => {
  const challenge = useChallengeStore((s) => s.activeChallenge);
  const simulationStatus = useChallengeStore((s) => s.simulationStatus);
  const setSimulationStatus = useChallengeStore((s) => s.setSimulationStatus);
  const completeEvaluation = useChallengeStore((s) => s.completeEvaluation);
  const phase = useChallengeStore((s) => s.phase);

  const initSimulation = useSimulationStore((s) => s.initSimulation);
  const minimize = useSimulationStore((s) => s.minimize);
  const setConfig = useSimulationStore((s) => s.setConfig);

  // Track whether we've started the simulation to avoid double-triggering
  const startedRef = useRef(false);

  const runChallenge = useCallback(async () => {
    if (!challenge || startedRef.current) return;
    startedRef.current = true;

    // 1. Set up the simulation with challenge atoms
    setSimulationStatus('Loading molecules...');
    const atoms = challenge.setup.atoms();
    initSimulation(atoms);

    // Apply any config overrides
    if (challenge.setup.configOverrides) {
      setConfig(challenge.setup.configOverrides);
    }

    // Ensure simulation is stopped initially
    setConfig({ running: false });

    // Brief delay to let the worker initialize
    await new Promise((r) => setTimeout(r, 500));

    // 2. Minimize if requested
    if (challenge.setup.minimizeFirst !== false) {
      setSimulationStatus('Minimizing energy...');
      minimize();

      // Wait for minimization to complete (watch for energy to stabilize)
      await new Promise((r) => setTimeout(r, 2000));
      setSimulationStatus('Energy minimization complete. Evaluating...');
    }

    // 3. Run additional steps if requested
    if (
      challenge.setup.stepsAfterMinimize &&
      challenge.setup.stepsAfterMinimize > 0
    ) {
      setSimulationStatus('Running simulation...');
      setConfig({ running: true });
      await new Promise((r) =>
        setTimeout(r, challenge.setup.stepsAfterMinimize * 16),
      );
      setConfig({ running: false });
    }

    // Brief settle time
    await new Promise((r) => setTimeout(r, 500));

    // 4. Evaluate
    setSimulationStatus('Measuring results...');
    const positions = useSimulationStore.getState().positions;
    const currentAtoms = useSimulationStore.getState().atoms;
    const evaluation = challenge.evaluate(positions, currentAtoms);

    // Small delay for UX
    await new Promise((r) => setTimeout(r, 500));

    completeEvaluation(evaluation);
  }, [
    challenge,
    initSimulation,
    minimize,
    setConfig,
    setSimulationStatus,
    completeEvaluation,
  ]);

  useEffect(() => {
    if (phase === 'simulate') {
      runChallenge();
    }
    return () => {
      startedRef.current = false;
    };
  }, [phase, runChallenge]);

  return (
    <div data-testid="challenge-simulate">
      <div style={headerStyle}>
        <span>{challenge?.title ?? 'Running...'}</span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: '20px 0',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid rgba(100,150,255,0.3)',
            borderTopColor: '#aaccff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 11, color: '#aaccff' }}>{simulationStatus}</div>
        <div style={{ fontSize: 9, color: '#666' }}>
          The simulation is finding the answer...
        </div>
      </div>
    </div>
  );
};

// --------------- Score Phase ----------------------------------

const ScorePhase: React.FC = () => {
  const challenge = useChallengeStore((s) => s.activeChallenge);
  const result = useChallengeStore((s) => s.result);
  const resetChallenge = useChallengeStore((s) => s.resetChallenge);

  if (!challenge || !result) return null;

  return (
    <div data-testid="challenge-score">
      <div style={headerStyle}>
        <span>Results</span>
        <CloseButton onClick={resetChallenge} />
      </div>

      {/* Score banner */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px 0',
          borderRadius: 6,
          background: result.correct
            ? 'rgba(74, 222, 128, 0.15)'
            : 'rgba(248, 113, 113, 0.15)',
          border: `1px solid ${result.correct ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: result.correct ? '#4ade80' : '#f87171',
          }}
        >
          {result.correct ? 'Correct!' : 'Not quite!'}
        </div>
        <div style={{ fontSize: 14, color: '#ddd', marginTop: 4 }}>
          Score: {result.score}/100
        </div>
      </div>

      {/* Measured values */}
      <div
        style={{
          padding: 12,
          borderRadius: 6,
          background: 'rgba(30,30,50,0.8)',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 10, color: '#aaccff', marginBottom: 8 }}>
          Simulation Measurements:
        </div>
        {Object.entries(result.evaluation.measuredValues).map(
          ([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                padding: '3px 0',
              }}
            >
              <span style={{ color: '#999' }}>{label}</span>
              <span style={{ color: '#ddd', fontWeight: 'bold' }}>{value}</span>
            </div>
          ),
        )}
      </div>

      {/* Explanation */}
      <div
        style={{
          padding: 12,
          borderRadius: 6,
          background: 'rgba(30,50,30,0.4)',
          border: '1px solid rgba(100,200,100,0.15)',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 10, color: '#88cc88', marginBottom: 6 }}>
          Why?
        </div>
        <div style={{ fontSize: 10, color: '#ccc', lineHeight: 1.6 }}>
          {challenge.explanation}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          data-testid="challenge-try-again"
          onClick={() =>
            useChallengeStore.getState().selectChallenge(challenge.id)
          }
          style={{ ...secondaryButton, flex: 1 }}
        >
          Try Again
        </button>
        <button
          data-testid="challenge-next"
          onClick={resetChallenge}
          style={{ ...primaryButton, flex: 1 }}
        >
          More Challenges
        </button>
      </div>
    </div>
  );
};

// --------------- Main Component ------------------------------

export const ChallengePanel: React.FC = () => {
  const showChallengePanel = useUIStore((s) => s.showChallengePanel);
  const phase = useChallengeStore((s) => s.phase);

  if (!showChallengePanel) return null;

  return (
    <div data-testid="challenge-panel" style={panelStyle}>
      {phase === 'select' && <SelectPhase />}
      {phase === 'predict' && <PredictPhase />}
      {phase === 'simulate' && <SimulatePhase />}
      {phase === 'score' && <ScorePhase />}
    </div>
  );
};
