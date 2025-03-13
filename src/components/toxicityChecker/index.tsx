import React, { useState } from 'react';

// API types and client
interface ToxicityPrediction {
  prediction: boolean;
  probability: number;
}

interface ToxicityResult {
  TOXICITY: ToxicityPrediction;
  SEVERE_TOXICITY: ToxicityPrediction;
  INSULT: ToxicityPrediction;
  PROFANITY: ToxicityPrediction;
  IDENTITY_ATTACK: ToxicityPrediction;
  THREAT: ToxicityPrediction;
  NOT_TOXIC: ToxicityPrediction;
}

// Simple API client
const checkToxicity = async (text: string): Promise<ToxicityResult> => {
  const response = await fetch('http://localhost:8000/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
};

// React component
const ToxicityChecker: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [result, setResult] = useState<ToxicityResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const toxicityResult = await checkToxicity(inputText);
      setResult(toxicityResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate toxicity level for styling
  const getToxicityLevel = (probability: number): string => {
    if (probability < 0.3) return 'low';
    if (probability < 0.7) return 'medium';
    return 'high';
  };

  return (
    <div className="toxicity-checker">
      <h2>Text Toxicity Checker</h2>
      
      <div className="input-section">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter text to check for toxicity..."
          rows={5}
          className="text-input"
        />
        
        <button 
          onClick={handleCheck} 
          disabled={isLoading || !inputText.trim()}
          className="check-button"
        >
          {isLoading ? 'Checking...' : 'Check Toxicity'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      {result && (
        <div className="results-section">
          <h3>Results:</h3>
          
          <div className="categories">
            {Object.entries(result).map(([category, data]) => (
              <div 
                key={category}
                className={`category ${getToxicityLevel(data.probability)}`}
              >
                <span className="category-name">{category}:</span>
                <span className="probability">
                  {(data.probability * 100).toFixed(1)}%
                </span>
                {data.prediction && (
                  <span className="alert-indicator">⚠️</span>
                )}
              </div>
            ))}
          </div>
          
          <div className="summary">
            {result.NOT_TOXIC.prediction ? (
              <p className="safe-text">This text appears to be safe.</p>
            ) : (
              <p className="warning-text">
                This text contains potentially harmful content.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToxicityChecker;