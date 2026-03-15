// ==============================================================
// ExperimentPanel — guided experiment wizard UI overlay
//
// Handles the full experiment lifecycle:
//   select → running (intro → predict → observe → explain) × N
//   → complete
//
// Matches the existing glassmorphism style used by ChallengePanel.
// ==============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useExperimentStore } from '../store/experimentStore';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';
import type { Experiment, ExperimentStep } from '../experiments/types';
import type { UserPrediction } from '../challenges/types';

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
  maxWidth: 520,
  minWidth: 380,
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

// --------------- Sub-components --------------------------------

const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    data-testid="experiment-close"
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

/** Progress bar showing which step the user is on */
const StepProgress: React.FC<{
  totalSteps: number;
  currentStep: number;
}> = ({ totalSteps, currentStep }) => (
  <div
    data-testid="step-progress"
    style={{
      display: 'flex',
      gap: 4,
      marginBottom: 12,
    }}
  >
    {Array.from({ length: totalSteps }, (_, i) => (
      <div
        key={i}
        style={{
          flex: 1,
          height: 3,
          borderRadius: 2,
          background:
            i < currentStep
              ? '#4ade80'
              : i === currentStep
                ? '#aaccff'
                : 'rgba(255,255,255,0.1)',
          transition: 'background 0.3s',
        }}
      />
    ))}
  </div>
);

// --------------- Select Phase --------------------------------

const SelectPhase: React.FC = () => {
  const allExperiments = useExperimentStore((s) => s.experiments);
  const selectExperiment = useExperimentStore((s) => s.selectExperiment);

  return (
    <div data-testid="experiment-select">
      <div style={headerStyle}>
        <span>Guided Experiments</span>
        <CloseButton
          onClick={() => useUIStore.getState().toggleExperimentPanel()}
        />
      </div>
      <div style={{ fontSize: 10, color: '#999', marginBottom: 12 }}>
        Step-by-step investigations that guide you through predicting,
        observing, and understanding chemistry concepts.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allExperiments.map((exp) => (
          <ExperimentCard
            key={exp.id}
            experiment={exp}
            onSelect={selectExperiment}
          />
        ))}
      </div>
    </div>
  );
};

const ExperimentCard: React.FC<{
  experiment: Experiment;
  onSelect: (id: string) => void;
}> = ({ experiment, onSelect }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      data-testid={`experiment-card-${experiment.id}`}
      onClick={() => onSelect(experiment.id)}
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
          {experiment.title}
        </span>
        <span
          style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 3,
            background: difficultyColors[experiment.difficulty] + '22',
            color: difficultyColors[experiment.difficulty],
          }}
        >
          {experiment.difficulty}
        </span>
      </div>
      <div style={{ color: '#999', fontSize: 10, marginTop: 4 }}>
        {experiment.description}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 9,
        }}
      >
        <span style={{ color: '#666' }}>{experiment.category}</span>
        <span style={{ color: '#888' }}>
          {experiment.steps.length} step
          {experiment.steps.length !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
};

// --------------- Intro Phase --------------------------------

const IntroPhase: React.FC<{
  step: ExperimentStep;
  stepIndex: number;
  totalSteps: number;
  onContinue: () => void;
  onQuit: () => void;
}> = ({ step, stepIndex, totalSteps, onContinue, onQuit }) => (
  <div data-testid="experiment-intro">
    <StepProgress totalSteps={totalSteps} currentStep={stepIndex} />
    <div style={headerStyle}>
      <span>
        Step {stepIndex + 1}: {step.title}
      </span>
      <CloseButton onClick={onQuit} />
    </div>
    <div
      style={{
        fontSize: 11,
        color: '#ccc',
        lineHeight: 1.7,
        margin: '0 0 16px 0',
        whiteSpace: 'pre-line',
      }}
    >
      {step.introText}
    </div>
    <button
      data-testid="experiment-continue"
      onClick={onContinue}
      style={{ ...primaryButton, width: '100%' }}
    >
      {step.question ? 'Make a Prediction' : 'Run Simulation'}
    </button>
  </div>
);

// --------------- Predict Phase --------------------------------

const PredictPhase: React.FC<{
  step: ExperimentStep;
  stepIndex: number;
  totalSteps: number;
  onSubmit: (prediction: UserPrediction) => void;
  onQuit: () => void;
}> = ({ step, stepIndex, totalSteps, onSubmit, onQuit }) => {
  if (!step.question) return null;
  const { question } = step;

  return (
    <div data-testid="experiment-predict">
      <StepProgress totalSteps={totalSteps} currentStep={stepIndex} />
      <div style={headerStyle}>
        <span>
          Step {stepIndex + 1}: {step.title}
        </span>
        <CloseButton onClick={onQuit} />
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
        <MultipleChoiceInput options={question.options} onSubmit={onSubmit} />
      )}
      {question.type === 'numeric-estimate' && (
        <NumericEstimateInput
          unit={question.unit}
          range={question.range}
          onSubmit={onSubmit}
        />
      )}
      {question.type === 'ordering' && (
        <OrderingInput items={question.items} onSubmit={onSubmit} />
      )}
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
          data-testid={`exp-choice-${opt.key}`}
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
        data-testid="experiment-submit-prediction"
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
          data-testid="exp-numeric-input"
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
        data-testid="experiment-submit-prediction"
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
            data-testid={`exp-order-item-${item.key}`}
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
              data-testid={`exp-move-up-${item.key}`}
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
              data-testid={`exp-move-down-${item.key}`}
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
        data-testid="experiment-submit-prediction"
        onClick={() => onSubmit(order.map((item) => item.key))}
        style={{ ...primaryButton, marginTop: 12, width: '100%' }}
      >
        Submit Prediction
      </button>
    </div>
  );
};

// --------------- Observe Phase --------------------------------

const ObservePhase: React.FC<{
  step: ExperimentStep;
  stepIndex: number;
  totalSteps: number;
}> = ({ step, stepIndex, totalSteps }) => {
  const observeStatus = useExperimentStore((s) => s.observeStatus);
  const setObserveStatus = useExperimentStore((s) => s.setObserveStatus);
  const completeObservation = useExperimentStore((s) => s.completeObservation);
  const stepPhase = useExperimentStore((s) => s.stepPhase);

  const initSimulation = useSimulationStore((s) => s.initSimulation);
  const minimize = useSimulationStore((s) => s.minimize);
  const setConfig = useSimulationStore((s) => s.setConfig);

  const startedRef = useRef(false);

  const runObservation = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const { simulation } = step;

    // 1. Load atoms if provided
    if (simulation.atoms) {
      setObserveStatus('Loading molecules...');
      const atoms = simulation.atoms();
      initSimulation(atoms);
    }

    // Apply config overrides
    if (simulation.configOverrides) {
      setConfig(simulation.configOverrides);
    }

    // Ensure simulation is stopped initially
    setConfig({ running: false });

    // Brief delay for worker init
    await new Promise((r) => setTimeout(r, 500));

    // 2. Minimize if requested
    if (simulation.minimizeFirst !== false) {
      setObserveStatus('Minimizing energy...');
      minimize();
      await new Promise((r) => setTimeout(r, 2000));
      setObserveStatus('Energy minimization complete.');
    }

    // 3. Run simulation steps if requested
    if (simulation.stepsToRun && simulation.stepsToRun > 0) {
      setObserveStatus('Running simulation...');
      setConfig({ running: true });
      // ~16ms per frame, 5 steps per frame → each frame ≈ 5 steps
      const waitMs = Math.max(1000, (simulation.stepsToRun / 5) * 16);
      await new Promise((r) => setTimeout(r, waitMs));
      setConfig({ running: false });
    }

    // Brief settle time
    await new Promise((r) => setTimeout(r, 500));

    // 4. Evaluate
    setObserveStatus('Measuring results...');
    const positions = useSimulationStore.getState().positions;
    const currentAtoms = useSimulationStore.getState().atoms;
    const evaluation = step.evaluate(positions, currentAtoms);

    await new Promise((r) => setTimeout(r, 500));

    completeObservation(evaluation);
  }, [
    step,
    initSimulation,
    minimize,
    setConfig,
    setObserveStatus,
    completeObservation,
  ]);

  useEffect(() => {
    if (stepPhase === 'observe') {
      runObservation();
    }
    return () => {
      startedRef.current = false;
    };
  }, [stepPhase, runObservation]);

  return (
    <div data-testid="experiment-observe">
      <StepProgress totalSteps={totalSteps} currentStep={stepIndex} />
      <div style={headerStyle}>
        <span>
          Step {stepIndex + 1}: {step.title}
        </span>
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
            animation: 'experiment-spin 1s linear infinite',
          }}
        />
        <style>
          {`@keyframes experiment-spin { to { transform: rotate(360deg); } }`}
        </style>
        <div style={{ fontSize: 11, color: '#aaccff' }}>{observeStatus}</div>
        <div style={{ fontSize: 9, color: '#666' }}>
          Watch the 3D view — the simulation is running...
        </div>
      </div>
    </div>
  );
};

// --------------- Explain Phase --------------------------------

const ExplainPhase: React.FC<{
  step: ExperimentStep;
  stepIndex: number;
  totalSteps: number;
  prediction: string | number | string[] | null;
  onNext: () => void;
  onQuit: () => void;
}> = ({ step, stepIndex, totalSteps, prediction, onNext, onQuit }) => {
  const stepResults = useExperimentStore((s) => s.stepResults);
  const latestResult = stepResults[stepResults.length - 1];

  if (!latestResult) return null;

  const { evaluation } = latestResult;
  const isLastStep = stepIndex === totalSteps - 1;

  // Check if prediction was correct (simple check for multiple-choice)
  const predictionCorrect =
    prediction !== null && evaluation.correctAnswer === prediction;
  const hasPrediction = prediction !== null && step.question;

  return (
    <div data-testid="experiment-explain">
      <StepProgress totalSteps={totalSteps} currentStep={stepIndex} />
      <div style={headerStyle}>
        <span>Step {stepIndex + 1}: Results</span>
        <CloseButton onClick={onQuit} />
      </div>

      {/* Prediction feedback (if a prediction was made) */}
      {hasPrediction && (
        <div
          style={{
            textAlign: 'center',
            padding: '12px 0',
            borderRadius: 6,
            background: predictionCorrect
              ? 'rgba(74, 222, 128, 0.15)'
              : 'rgba(248, 113, 113, 0.15)',
            border: `1px solid ${predictionCorrect ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: predictionCorrect ? '#4ade80' : '#f87171',
            }}
          >
            {predictionCorrect
              ? 'Great prediction!'
              : "Not quite — let's learn why"}
          </div>
        </div>
      )}

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
        {Object.entries(evaluation.measuredValues).map(([label, value]) => (
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
        ))}
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
        <div
          style={{
            fontSize: 10,
            color: '#ccc',
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}
        >
          {step.explanation}
        </div>
      </div>

      {/* Next button */}
      <button
        data-testid="experiment-next-step"
        onClick={onNext}
        style={{ ...primaryButton, width: '100%' }}
      >
        {isLastStep ? 'Complete Experiment' : 'Next Step'}
      </button>
    </div>
  );
};

// --------------- Complete Phase --------------------------------

const CompletePhase: React.FC = () => {
  const experiment = useExperimentStore((s) => s.activeExperiment);
  const stepResults = useExperimentStore((s) => s.stepResults);
  const resetExperiment = useExperimentStore((s) => s.resetExperiment);

  if (!experiment) return null;

  return (
    <div data-testid="experiment-complete">
      <div style={headerStyle}>
        <span>Experiment Complete</span>
        <CloseButton onClick={resetExperiment} />
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '16px 0',
          borderRadius: 6,
          background: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#4ade80' }}>
          Well Done!
        </div>
        <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>
          You completed: {experiment.title}
        </div>
      </div>

      {/* Summary of all steps */}
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
          Summary:
        </div>
        {experiment.steps.map((step, i) => {
          const result = stepResults.find((r) => r.stepIndex === i);
          return (
            <div
              key={i}
              style={{
                padding: '6px 0',
                borderBottom:
                  i < experiment.steps.length - 1
                    ? '1px solid rgba(255,255,255,0.05)'
                    : 'none',
              }}
            >
              <div style={{ fontSize: 11, color: '#ddd' }}>
                Step {i + 1}: {step.title}
              </div>
              {result && (
                <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
                  {result.evaluation.measurementDescription}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        data-testid="experiment-back-to-list"
        onClick={resetExperiment}
        style={{ ...primaryButton, width: '100%' }}
      >
        More Experiments
      </button>
    </div>
  );
};

// --------------- Running Phase (step router) ------------------

const RunningPhase: React.FC = () => {
  const experiment = useExperimentStore((s) => s.activeExperiment);
  const currentStepIndex = useExperimentStore((s) => s.currentStepIndex);
  const stepPhase = useExperimentStore((s) => s.stepPhase);
  const currentPrediction = useExperimentStore((s) => s.currentPrediction);
  const startPrediction = useExperimentStore((s) => s.startPrediction);
  const submitPrediction = useExperimentStore((s) => s.submitPrediction);
  const nextStep = useExperimentStore((s) => s.nextStep);
  const resetExperiment = useExperimentStore((s) => s.resetExperiment);

  if (!experiment) return null;

  const step = experiment.steps[currentStepIndex];
  const totalSteps = experiment.steps.length;

  return (
    <>
      {stepPhase === 'intro' && (
        <IntroPhase
          step={step}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onContinue={startPrediction}
          onQuit={resetExperiment}
        />
      )}
      {stepPhase === 'predict' && (
        <PredictPhase
          step={step}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onSubmit={submitPrediction}
          onQuit={resetExperiment}
        />
      )}
      {stepPhase === 'observe' && (
        <ObservePhase
          step={step}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
        />
      )}
      {stepPhase === 'explain' && (
        <ExplainPhase
          step={step}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          prediction={currentPrediction}
          onNext={nextStep}
          onQuit={resetExperiment}
        />
      )}
    </>
  );
};

// --------------- Main Component --------------------------------

export const ExperimentPanel: React.FC = () => {
  const showExperimentPanel = useUIStore((s) => s.showExperimentPanel);
  const phase = useExperimentStore((s) => s.phase);

  if (!showExperimentPanel) return null;

  return (
    <div data-testid="experiment-panel" style={panelStyle}>
      {phase === 'select' && <SelectPhase />}
      {phase === 'running' && <RunningPhase />}
      {phase === 'complete' && <CompletePhase />}
    </div>
  );
};
