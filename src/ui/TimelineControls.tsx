// ==============================================================
// TimelineControls — trajectory replay scrubber and controls
// ==============================================================

import React, { useCallback, useRef, useEffect } from 'react';
import { useSimContextStore } from '../store/SimulationContext';
import { useUIStore } from '../store/uiStore';
import type { ReactionEvent, SimulationEvent } from '../data/types';

/** Playback speed presets */
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4] as const;

/**
 * Map reaction/event steps to pixel positions on the timeline for markers.
 * Returns unique step values within the frame range.
 */
function getEventSteps(
  reactionLog: ReactionEvent[],
  eventLog: SimulationEvent[],
  firstStep: number,
  lastStep: number,
): { reactions: number[]; events: number[] } {
  const reactions = [
    ...new Set(
      reactionLog
        .filter((r) => r.step >= firstStep && r.step <= lastStep)
        .map((r) => r.step),
    ),
  ];
  const events = [
    ...new Set(
      eventLog
        .filter(
          (e) =>
            e.step >= firstStep &&
            e.step <= lastStep &&
            e.type !== 'bond-formed' &&
            e.type !== 'bond-broken',
        )
        .map((e) => e.step),
    ),
  ];
  return { reactions, events };
}

export const TimelineControls: React.FC = () => {
  const showTimeline = useUIStore((s) => s.showTimeline);
  const trajectory = useSimContextStore((s) => s.trajectory);
  const startPlayback = useSimContextStore((s) => s.startPlayback);
  const stopPlayback = useSimContextStore((s) => s.stopPlayback);
  const seekToFrame = useSimContextStore((s) => s.seekToFrame);
  const stepPlayback = useSimContextStore((s) => s.stepPlayback);
  const setPlaybackSpeed = useSimContextStore((s) => s.setPlaybackSpeed);
  const clearTrajectory = useSimContextStore((s) => s.clearTrajectory);
  const toggleRecording = useSimContextStore((s) => s.toggleRecording);
  const reactionLog = useSimContextStore((s) => s.reactionLog);
  const eventLog = useSimContextStore((s) => s.eventLog);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const frameCount = trajectory.frames.length;
  const currentIndex = trajectory.currentFrameIndex;

  // Derive step range for event markers
  const firstStep = frameCount > 0 ? trajectory.frames[0].step : 0;
  const lastStep = frameCount > 0 ? trajectory.frames[frameCount - 1].step : 0;

  // Draw event markers on the canvas timeline bar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frameCount === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 0, width, height);

    // Progress fill
    if (currentIndex >= 0) {
      const progress = currentIndex / Math.max(1, frameCount - 1);
      ctx.fillStyle = 'rgba(100, 170, 255, 0.3)';
      ctx.fillRect(0, 0, width * progress, height);
    }

    // Event markers
    const { reactions, events } = getEventSteps(
      reactionLog,
      eventLog,
      firstStep,
      lastStep,
    );
    const stepRange = lastStep - firstStep;
    if (stepRange > 0) {
      // Reaction markers (green)
      ctx.fillStyle = '#66ff88';
      for (const step of reactions) {
        const x = ((step - firstStep) / stepRange) * width;
        ctx.fillRect(x - 1, 0, 2, height);
      }

      // Other event markers (yellow)
      ctx.fillStyle = '#ffcc44';
      for (const step of events) {
        const x = ((step - firstStep) / stepRange) * width;
        ctx.fillRect(x - 1, 0, 2, height);
      }
    }

    // Playhead
    if (currentIndex >= 0) {
      const x = (currentIndex / Math.max(1, frameCount - 1)) * width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, 0, 3, height);
    }
  }, [frameCount, currentIndex, reactionLog, eventLog, firstStep, lastStep]);

  // Handle clicking on the timeline canvas to seek
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || frameCount === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const fraction = x / rect.width;
      const targetIndex = Math.round(fraction * (frameCount - 1));
      seekToFrame(Math.max(0, Math.min(frameCount - 1, targetIndex)));
    },
    [frameCount, seekToFrame],
  );

  // Keyboard shortcuts for timeline (when visible)
  useEffect(() => {
    if (!showTimeline) return;

    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      switch (e.key) {
        case 'ArrowLeft':
          if (e.shiftKey) {
            seekToFrame(Math.max(0, currentIndex - 10));
          } else {
            stepPlayback(-1);
          }
          e.preventDefault();
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            seekToFrame(Math.min(frameCount - 1, currentIndex + 10));
          } else {
            stepPlayback(1);
          }
          e.preventDefault();
          break;
        case ' ':
          if (trajectory.playing) {
            stopPlayback();
          } else if (frameCount > 0) {
            startPlayback();
          }
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    showTimeline,
    trajectory.playing,
    currentIndex,
    frameCount,
    stepPlayback,
    seekToFrame,
    startPlayback,
    stopPlayback,
  ]);

  if (!showTimeline) return null;

  // Current frame info
  const currentFrame =
    currentIndex >= 0 && currentIndex < frameCount
      ? trajectory.frames[currentIndex]
      : null;

  const buttonStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 3,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(40, 40, 60, 0.9)',
    color: '#ccc',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 11,
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: '1px solid #aaccff',
    background: 'rgba(100, 150, 255, 0.3)',
    color: '#fff',
  };

  return (
    <div
      data-testid="timeline-controls"
      style={{
        position: 'absolute',
        bottom: 22, // above the status bar
        left: 60, // right of toolbar
        right: 10,
        background: 'rgba(20, 20, 40, 0.95)',
        borderRadius: 8,
        padding: '8px 12px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        color: '#ddd',
        fontFamily: 'monospace',
        fontSize: 11,
        zIndex: 90,
      }}
    >
      {/* Top row: controls and info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        {/* Recording toggle */}
        <button
          data-testid="toggle-recording"
          onClick={toggleRecording}
          title={trajectory.recording ? 'Pause Recording' : 'Resume Recording'}
          style={{
            ...buttonStyle,
            color: trajectory.recording ? '#ff4444' : '#888',
            fontSize: 14,
            padding: '2px 6px',
          }}
        >
          {trajectory.recording ? '\u23FA' : '\u23FA'}
        </button>

        {/* Playback controls */}
        <button
          data-testid="seek-start"
          onClick={() => seekToFrame(0)}
          disabled={frameCount === 0}
          title="Go to start"
          style={buttonStyle}
        >
          |&lt;
        </button>
        <button
          data-testid="step-back"
          onClick={() => stepPlayback(-1)}
          disabled={frameCount === 0 || currentIndex <= 0}
          title="Step backward"
          style={buttonStyle}
        >
          &lt;
        </button>
        <button
          data-testid="play-pause-replay"
          onClick={() => {
            if (trajectory.playing) {
              stopPlayback();
            } else {
              startPlayback();
            }
          }}
          disabled={frameCount === 0}
          title={trajectory.playing ? 'Pause replay' : 'Play replay'}
          style={trajectory.playing ? activeButtonStyle : buttonStyle}
        >
          {trajectory.playing ? '\u23F8' : '\u25B6'}
        </button>
        <button
          data-testid="step-forward"
          onClick={() => stepPlayback(1)}
          disabled={frameCount === 0 || currentIndex >= frameCount - 1}
          title="Step forward"
          style={buttonStyle}
        >
          &gt;
        </button>
        <button
          data-testid="seek-end"
          onClick={() => seekToFrame(frameCount - 1)}
          disabled={frameCount === 0}
          title="Go to end"
          style={buttonStyle}
        >
          &gt;|
        </button>

        {/* Speed selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#888', fontSize: 10 }}>Speed:</span>
          <select
            data-testid="playback-speed"
            value={trajectory.playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            style={{
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(30, 30, 50, 0.9)',
              color: '#ddd',
              fontFamily: 'monospace',
              fontSize: 10,
            }}
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Frame counter */}
        <span style={{ color: '#aaccff', minWidth: 100, textAlign: 'center' }}>
          {currentIndex >= 0 ? currentIndex + 1 : '-'} / {frameCount}
        </span>

        {/* Step display */}
        {currentFrame && (
          <span style={{ color: '#888', fontSize: 10 }}>
            Step {currentFrame.step}
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Clear trajectory */}
        <button
          data-testid="clear-trajectory"
          onClick={clearTrajectory}
          title="Clear recorded trajectory"
          style={{ ...buttonStyle, color: '#ff8888' }}
        >
          Clear
        </button>
      </div>

      {/* Timeline scrubber bar (canvas) */}
      <canvas
        ref={canvasRef}
        data-testid="timeline-canvas"
        width={800}
        height={20}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: 20,
          cursor: frameCount > 0 ? 'pointer' : 'default',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 4,
          fontSize: 9,
          color: '#888',
        }}
      >
        <span>
          <span style={{ color: '#66ff88' }}>{'\u25A0'}</span> Reactions
        </span>
        <span>
          <span style={{ color: '#ffcc44' }}>{'\u25A0'}</span> Events
        </span>
        <span>
          <span style={{ color: '#ffffff' }}>{'\u25A0'}</span> Playhead
        </span>
        <span style={{ flex: 1 }} />
        <span>Arrow keys: step | Shift+Arrow: skip 10 | Space: play/pause</span>
      </div>
    </div>
  );
};
