// Input/Output types that match the FastAPI models
interface TextInput {
  text: string;
}

interface FastAPIPredictionOutput {
  original_text: string;
  censored_text: string;
  probabilities: Record<string, number>;
  predicted_labels: string[];
}

// Standardized API response for our frontend
export interface ToxicityResult {
  results: Record<string, {
    probability: number;
    is_detected: boolean;
  }>;
  summary: {
    is_toxic: boolean;
    toxicity_level: 'not toxic' | 'toxic' | 'very toxic';
    detected_categories: string[];
  };
  raw_probabilities?: Record<string, number> | null;
  censored_text: string | null;
  censored_words?: string[];
}

// Aliases for compatibility with the application's types
export type ToxicityData = ToxicityResult;

// Direct API URL configuration - update with your FastAPI URL
const API_BASE_URL = 'https://redef-model.onrender.com/';

// Define thresholds for very toxic classification 
const VERY_TOXIC_THRESHOLD = 0.7;

/**
 * Enhanced toxicity check with proper error handling, timeouts,
 * and improved response formatting - updated for FastAPI backend
 */
export const checkToxicity = async (text: string): Promise<ToxicityResult> => {
  if (!text || text.trim() === '') {
    return getDefaultToxicityResult();
  }

  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const requestBody: TextInput = {
      text
    };

    const response = await fetch(`${API_BASE_URL}predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Toxicity check failed: ${response.status}`);
    }
    
    const data: FastAPIPredictionOutput = await response.json();
    
    // Transform FastAPI response to our standard format
    return transformFastAPIResponse(data);
  } catch (error) {
    console.error('Error checking toxicity:', error);
    // More detailed error logging
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
    }
    
    return getDefaultToxicityResult();
  }
};

/**
 * Enhanced batch toxicity checking - not implemented in the FastAPI yet,
 * but we can simulate it with multiple single requests
 */
export const batchCheckToxicity = async (texts: string[]): Promise<ToxicityResult[]> => {
  if (!texts || texts.length === 0) {
    return [];
  }
  
  // Limit batch size to prevent overloading the API
  const maxBatchSize = 50;
  const limitedTexts = texts.slice(0, maxBatchSize);
  
  try {
    // Process each text individually in parallel since batch endpoint 
    // isn't available in the provided FastAPI
    const promises = limitedTexts.map(text => checkToxicity(text));
    return await Promise.all(promises);
  } catch (error) {
    console.error('Error in batch toxicity check:', error);
    // Return default results for each text
    return limitedTexts.map(() => getDefaultToxicityResult());
  }
};

/**
 * Enhanced text censoring - directly uses the predict endpoint
 * since FastAPI's response already includes censored text
 */
export const censorText = async (
  text: string, 
): Promise<{
  original_text: string;
  censored_text: string;
  toxicity_level: string;
  is_toxic: boolean;
}> => {
  if (!text || text.trim() === '') {
    return {
      original_text: text,
      censored_text: text,
      toxicity_level: 'not toxic',
      is_toxic: false
    };
  }

  try {
    // Use the regular prediction endpoint since it already includes censoring
    const result = await checkToxicity(text);
    
    return {
      original_text: text,
      censored_text: result.censored_text || text,
      toxicity_level: result.summary.toxicity_level,
      is_toxic: result.summary.is_toxic
    };
  } catch (error) {
    console.error('Error censoring text:', error);
    // Return original text if censoring fails
    return {
      original_text: text,
      censored_text: text,
      toxicity_level: 'not toxic',
      is_toxic: false
    };
  }
};

// Transform the FastAPI response to our standardized format
const transformFastAPIResponse = (data: FastAPIPredictionOutput): ToxicityResult => {
  // Extract probabilities
  const rawProbabilities = data.probabilities;
  
  // Transform to results format with probability and detection flag
  const results: Record<string, { probability: number; is_detected: boolean }> = {};
  
  // Create entries for each prediction category
  Object.entries(rawProbabilities).forEach(([category, probability]) => {
    const isDetected = data.predicted_labels.includes(category);
    
    results[category] = {
      probability,
      is_detected: isDetected
    };
  });
  
  // Determine if any category is detected
  const isToxic = data.predicted_labels.length > 0;
  
  // Determine toxicity level
  let toxicityLevel: 'not toxic' | 'toxic' | 'very toxic' = 'not toxic';
  
  if (isToxic) {
    // Check if 'very_toxic' label is present or any probability is above threshold
    const isVeryToxic = data.predicted_labels.includes('very_toxic') || 
                        Object.values(rawProbabilities).some(prob => prob >= VERY_TOXIC_THRESHOLD);
    
    toxicityLevel = isVeryToxic ? 'very toxic' : 'toxic';
  }
  
  // Extract censored words - not directly provided by the API
  // We can compare original and censored text to identify censored words
  const censoredWords = extractCensoredWords(data.original_text, data.censored_text);
  
  return {
    results,
    summary: {
      is_toxic: isToxic,
      toxicity_level: toxicityLevel,
      detected_categories: data.predicted_labels
    },
    raw_probabilities: rawProbabilities,
    censored_text: data.censored_text,
    censored_words: censoredWords
  };
};

// Helper function to extract censored words by comparing original and censored text
const extractCensoredWords = (original: string, censored: string): string[] => {
  const originalWords = original.split(/\s+/);
  const censoredWords = censored.split(/\s+/);
  
  const result: string[] = [];
  
  // If lengths don't match for some reason, return empty array
  if (originalWords.length !== censoredWords.length) {
    return result;
  }
  
  // Compare each word
  for (let i = 0; i < originalWords.length; i++) {
    const originalWord = originalWords[i];
    const censoredWord = censoredWords[i];
    
    // If word contains asterisks, consider it censored
    if (censoredWord.includes('*') && censoredWord !== originalWord) {
      result.push(originalWord);
    }
  }
  
  return result;
};

// Default toxicity result for error cases
const getDefaultToxicityResult = (): ToxicityResult => ({
  results: {},
  summary: {
    is_toxic: false,
    toxicity_level: 'not toxic',
    detected_categories: []
  },
  raw_probabilities: null,
  censored_text: null,
  censored_words: []
});