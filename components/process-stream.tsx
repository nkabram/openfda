import React, { useState, useEffect, useCallback } from 'react';

interface StreamingTextProps {
  text: string;
  typingSpeed: number;
  onComplete: () => void;
  isActive: boolean;
}

const StreamingText: React.FC<StreamingTextProps> = ({ text, typingSpeed, onComplete, isActive }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isActive || currentIndex >= text.length) {
      if (currentIndex >= text.length && displayText === text) {
        onComplete();
      }
      return;
    }

    const timer = setTimeout(() => {
      setDisplayText(text.slice(0, currentIndex + 1));
      setCurrentIndex(currentIndex + 1);
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, typingSpeed, isActive, onComplete, displayText]);

  useEffect(() => {
    if (isActive) {
      setDisplayText('');
      setCurrentIndex(0);
    }
  }, [isActive, text]);

  return (
    <span className="text-sm text-blue-600 dark:text-blue-400">
      {displayText}
      {isActive && currentIndex < text.length && (
        <span className="animate-pulse text-blue-600 dark:text-blue-400">|</span>
      )}
    </span>
  );
};

interface ProcessStreamProps {
  steps?: string[];
  typingSpeed?: number;
  pauseBetweenSteps?: number;
  loop?: boolean;
  onComplete?: (() => void) | null;
  onStepComplete?: ((stepIndex: number) => void) | null;
  title?: string;
  autoHide?: boolean;
  hideDelay?: number;
  position?: 'fixed' | 'inline';
  autoStart?: boolean;
  maxVisibleSteps?: number;
  lineHeight?: string;
}

const ProcessStream: React.FC<ProcessStreamProps> = ({ 
  steps = [],
  typingSpeed = 50,
  pauseBetweenSteps = 800,
  loop = false,
  onComplete = null,
  onStepComplete = null,
  autoHide = true,
  hideDelay = 2000,
  position = 'fixed',
  autoStart = true,
  maxVisibleSteps = 3
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [visibleSteps, setVisibleSteps] = useState<string[]>([]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart && steps.length > 0 && !isRunning && !isComplete) {
      start();
    }
  }, [autoStart, steps.length, isRunning, isComplete]);

  // Update visible steps when current step changes
  useEffect(() => {
    if (currentStepIndex >= 0) {
      const newVisibleSteps = steps.slice(
        Math.max(0, currentStepIndex - maxVisibleSteps + 1),
        currentStepIndex + 1
      );
      setVisibleSteps(newVisibleSteps);
    }
  }, [currentStepIndex, steps, maxVisibleSteps]);

  // Auto-hide effect
  useEffect(() => {
    if (isComplete && autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, hideDelay);
      return () => clearTimeout(timer);
    }
  }, [isComplete, autoHide, hideDelay]);

  const start = useCallback(() => {
    if (steps.length === 0) return;
    setIsRunning(true);
    setCurrentStepIndex(0);
    setCompletedSteps([]);
    setIsComplete(false);
  }, [steps.length]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setCurrentStepIndex(-1);
    setCompletedSteps([]);
    setIsComplete(false);
    setVisibleSteps([]);
  }, []);

  const handleStepComplete = useCallback(() => {
    const nextStepIndex = currentStepIndex + 1;
    setCompletedSteps(prev => [...prev, currentStepIndex]);
    
    if (onStepComplete) {
      onStepComplete(currentStepIndex);
    }

    if (nextStepIndex >= steps.length) {
      // All steps completed
      setIsComplete(true);
      setIsRunning(false);
      if (onComplete) {
        onComplete();
      }
      
      if (loop) {
        setTimeout(() => {
          reset();
          start();
        }, pauseBetweenSteps);
      }
    } else {
      // Move to next step
      setTimeout(() => {
        setCurrentStepIndex(nextStepIndex);
      }, pauseBetweenSteps);
    }
  }, [currentStepIndex, steps.length, onStepComplete, onComplete, loop, pauseBetweenSteps, reset, start]);

  if (!isVisible) return null;

  const positionClasses = position === 'fixed' 
    ? 'fixed bottom-4 right-4 z-50' 
    : 'relative';

  return (
    <div className={`${positionClasses} max-w-sm`}>
      <div className="space-y-1">
        {visibleSteps.map((step, index) => {
          const actualStepIndex = currentStepIndex - visibleSteps.length + 1 + index;
          const isActive = actualStepIndex === currentStepIndex && isRunning;
          const isCompleted = completedSteps.includes(actualStepIndex);
          
          return (
            <div 
              key={actualStepIndex}
              className={`transition-all duration-500 ease-out transform ${
                isCompleted ? 'translate-y-0 opacity-50' : 
                isActive ? 'translate-y-0 opacity-100' : 
                'translate-y-2 opacity-30'
              }`}
            >
              <div className="text-sm text-blue-600 dark:text-blue-400">
                {isActive ? (
                  <StreamingText
                    text={step}
                    typingSpeed={typingSpeed}
                    onComplete={handleStepComplete}
                    isActive={true}
                  />
                ) : (
                  <span>{step}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessStream;