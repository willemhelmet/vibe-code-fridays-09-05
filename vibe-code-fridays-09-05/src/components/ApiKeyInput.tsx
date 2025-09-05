import React, { useState } from 'react';
import { Eye, EyeOff, Key } from 'lucide-react';

interface ApiKeyInputProps {
  apiKey: string;
  onChange: (value: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, onChange }) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="control-group">
      <label className="control-label">
        Anthropic API Key
      </label>
      <div className="api-key-input-wrapper">
        <Key size={20} className="api-key-icon" />
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-ant-api..."
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="api-key-toggle"
        >
          {showKey ? (
            <EyeOff size={20} />
          ) : (
            <Eye size={20} />
          )}
        </button>
      </div>
    </div>
  );
};

export default ApiKeyInput;