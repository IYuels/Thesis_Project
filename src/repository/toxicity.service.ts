// Input/Output types that match the FastAPI models
interface TextInput {
  text: string;
  censor?: boolean;
  return_scores?: boolean;
}

interface FastAPIPredictionOutput {
  original_text: string;
  censored_text: string | null;
  predictions: Record<string, boolean>;
  scores?: Record<string, number> | null;
  contains_profanity: boolean;
  censored_words: string[];
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
const API_BASE_URL = 'http://127.0.0.1:8000/';

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
      text,
      censor: true,
      return_scores: true // Always request scores for detailed information
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
  // Extract the scores (probabilities) from the data
  // If scores aren't available, create an empty object
  const rawProbabilities: Record<string, number> = data.scores || {};
  
  // Transform to results format with probability and detection flag
  const results: Record<string, { probability: number; is_detected: boolean }> = {};
  
  // Create entries for each prediction category
  Object.entries(data.predictions).forEach(([category, isDetected]) => {
    const probability = data.scores?.[category] || 0;
    
    results[category] = {
      probability,
      is_detected: isDetected
    };
  });
  
  // Determine detected categories
  const detectedCategories = Object.entries(data.predictions)
    .filter(([_, value]) => value)
    .map(([key]) => key);
  
  // Determine overall toxicity level using the updated logic with specific threshold
  const isToxic = detectedCategories.length > 0 || data.contains_profanity;
  let toxicityLevel: 'not toxic' | 'toxic' | 'very toxic' = 'not toxic';
  
  if (isToxic) {
    // Check for "very toxic" using the specific very_toxic threshold
    // Look for any category with probability above the VERY_TOXIC_THRESHOLD
    const hasVeryHighToxicity = Object.values(rawProbabilities).some(value => 
      value >= VERY_TOXIC_THRESHOLD
    ) || data.predictions['very_toxic'] === true;
    
    toxicityLevel = hasVeryHighToxicity ? 'very toxic' : 'toxic';
  }
  
  return {
    results,
    summary: {
      is_toxic: isToxic,
      toxicity_level: toxicityLevel,
      detected_categories: detectedCategories
    },
    raw_probabilities: rawProbabilities,
    censored_text: data.censored_text,
    censored_words: data.censored_words
  };
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

// Get the currently configured thresholds from the FastAPI server
export const getThresholds = async (): Promise<Record<string, number>> => {
  try {
    const response = await fetch(`${API_BASE_URL}thresholds`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get thresholds: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting thresholds:', error);
    return {};
  }
};

// Update the thresholds on the FastAPI server
export const updateThresholds = async (thresholds: Record<string, number>): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}thresholds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ thresholds })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update thresholds: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating thresholds:', error);
    return false;
  }
};

// Reset thresholds to default values
export const resetThresholds = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}reset_thresholds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to reset thresholds: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error resetting thresholds:', error);
    return false;
  }
};