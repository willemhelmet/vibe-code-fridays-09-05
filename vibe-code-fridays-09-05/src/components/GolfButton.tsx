import React from 'react';
import { Zap, Loader2, Sparkles } from 'lucide-react';

interface GolfButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
  mode: 'golf' | 'ungolf';
}

const GolfButton: React.FC<GolfButtonProps> = ({ onClick, isLoading, disabled, mode }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`golf-button ${isLoading ? 'loading' : ''}`}
    >
      {isLoading ? (
        <>
          <Loader2 size={20} />
          <span>{mode === 'golf' ? 'Golfing...' : 'Beautifying...'}</span>
        </>
      ) : (
        <>
          {mode === 'golf' ? <Zap size={20} /> : <Sparkles size={20} />}
          <span>{mode === 'golf' ? 'Golf It!' : 'Beautify It!'}</span>
        </>
      )}
    </button>
  );
};

export default GolfButton;