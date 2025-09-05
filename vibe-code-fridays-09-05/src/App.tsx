import { useState } from 'react';
import CodeEditor from './components/CodeEditor';
import ApiKeyInput from './components/ApiKeyInput';
import GolfButton from './components/GolfButton';
import { golfCode, ungolfCode } from './services/anthropicService';
import type { CodeGolfState } from './types/index';
import { Code2, Maximize2, Minimize2 } from 'lucide-react';

function App() {
  const [state, setState] = useState<CodeGolfState>({
    originalCode: '',
    processedCode: '',
    isLoading: false,
    error: null,
    apiKey: localStorage.getItem('anthropic_api_key') || '',
    language: 'javascript',
    mode: 'golf'
  });

  const handleCodeChange = (code: string) => {
    setState(prev => ({ ...prev, originalCode: code }));
  };

  const handleProcessedCodeChange = (code: string) => {
    setState(prev => ({ ...prev, processedCode: code }));
  };

  const handleApiKeyChange = (apiKey: string) => {
    setState(prev => ({ ...prev, apiKey }));
    localStorage.setItem('anthropic_api_key', apiKey);
  };

  const handleLanguageChange = (language: string) => {
    setState(prev => ({ ...prev, language }));
  };

  const handleModeChange = (mode: 'golf' | 'ungolf') => {
    setState(prev => ({ ...prev, mode, processedCode: '', error: null }));
  };

  const handleProcess = async () => {
    if (!state.apiKey) {
      setState(prev => ({ ...prev, error: 'Please enter your Anthropic API key' }));
      return;
    }

    if (!state.originalCode) {
      setState(prev => ({ ...prev, error: `Please enter some code to ${state.mode}` }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const processedCode = state.mode === 'golf' 
        ? await golfCode(state.originalCode, state.language, state.apiKey)
        : await ungolfCode(state.originalCode, state.language, state.apiKey);
      setState(prev => ({ ...prev, processedCode, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  };

  const originalCharCount = state.originalCode.length;
  const processedCharCount = state.processedCode.length;
  const difference = processedCharCount - originalCharCount;
  const percentChange = originalCharCount > 0 
    ? Math.round((Math.abs(difference) / originalCharCount) * 100) 
    : 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <Code2 size={32} color="#4a9eff" />
            <h1>Code Golf Studio</h1>
          </div>
          <div className="header-subtitle">
            Powered by Claude AI
          </div>
        </div>
      </header>

      <main className="main">
        <div className="controls">
          <div className="mode-toggle">
            <button
              className={`mode-button ${state.mode === 'golf' ? 'active' : ''}`}
              onClick={() => handleModeChange('golf')}
            >
              <Minimize2 size={20} />
              Golf Mode
            </button>
            <button
              className={`mode-button ${state.mode === 'ungolf' ? 'active' : ''}`}
              onClick={() => handleModeChange('ungolf')}
            >
              <Maximize2 size={20} />
              Ungolf Mode
            </button>
          </div>
          <div className="controls-grid">
            <ApiKeyInput
              apiKey={state.apiKey}
              onChange={handleApiKeyChange}
            />
            <div className="control-group">
              <label className="control-label">
                Language
              </label>
              <select
                value={state.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="select"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="ruby">Ruby</option>
              </select>
            </div>
            <div className="control-group">
              <GolfButton
                onClick={handleProcess}
                isLoading={state.isLoading}
                disabled={!state.apiKey || !state.originalCode}
                mode={state.mode}
              />
            </div>
          </div>
        </div>

        {state.error && (
          <div className="error-message">
            {state.error}
          </div>
        )}

        {processedCharCount > 0 && (
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Original</div>
              <div className="stat-value">{originalCharCount} chars</div>
            </div>
            <div className="stat">
              <div className="stat-label">
                {state.mode === 'golf' ? 'Golfed' : 'Ungolfed'}
              </div>
              <div className={`stat-value ${state.mode === 'golf' ? 'green' : 'blue'}`}>
                {processedCharCount} chars
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">
                {state.mode === 'golf' ? 'Reduction' : 'Expansion'}
              </div>
              <div className={`stat-value ${state.mode === 'golf' ? 'blue' : 'orange'}`}>
                {state.mode === 'golf' ? '-' : '+'}{percentChange}%
              </div>
            </div>
          </div>
        )}

        <div className="editors">
          <div className="editor-section">
            <h2 className="editor-title">
              <Code2 size={20} />
              {state.mode === 'golf' ? 'Original Code' : 'Minified Code'}
            </h2>
            <div className="editor-container">
              <CodeEditor
                value={state.originalCode}
                onChange={handleCodeChange}
                language={state.language}
                readOnly={false}
              />
            </div>
          </div>

          <div className="editor-section">
            <h2 className="editor-title">
              {state.mode === 'golf' ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              {state.mode === 'golf' ? 'Golfed Code' : 'Readable Code'}
            </h2>
            <div className="editor-container">
              <CodeEditor
                value={state.processedCode}
                onChange={handleProcessedCodeChange}
                language={state.language}
                readOnly={false}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;