// Enhanced toxicity service with thresholds matching the backend API
// This should be placed in toxicity.service.ts

interface ToxicityPrediction {
  original_text: string;
  censored_text: string;
  predictions: Record<string, number>;
  censored_words: string[];
}

// Standardized API response for our frontend
// Using ToxicityData from types.ts for consistency
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

// Optimized thresholds matching the backend optimal_thresholds.json
const OPTIMIZED_THRESHOLDS: Record<string, number> = {
  'obscenity/profanity': 0.6,
  'insults': 0.5,
  'threatening': 0.4,
  'identity-based negativity': 0.3
};

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

    const response = await fetch(`${API_BASE_URL}predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Toxicity check failed: ${response.status}`);
    }
    
    const data: ToxicityPrediction = await response.json();
    
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
const transformFastAPIResponse = (data: ToxicityPrediction): ToxicityResult => {
  // Get the class labels and probabilities
  const rawProbabilities: Record<string, number> = { ...data.predictions };
  
  // Transform to results format with probability and detection flag
  const results: Record<string, { probability: number; is_detected: boolean }> = {};
  
  Object.entries(rawProbabilities).forEach(([category, probability]) => {
    const mappedCategory = mapCategoryName(category);
    
    // Use the optimized threshold if available, otherwise use the default 0.5
    const threshold = OPTIMIZED_THRESHOLDS[mappedCategory] ?? 0.5;
    
    results[mappedCategory] = {
      probability,
      is_detected: probability >= threshold
    };
  });
  
  // Determine detected categories
  const detectedCategories = Object.entries(results)
    .filter(([_, value]) => value.is_detected)
    .map(([key]) => key);
  
  // Determine overall toxicity level with enhanced logic
  const isToxic = detectedCategories.length > 0;
  let toxicityLevel: 'not toxic' | 'toxic' | 'very toxic' = 'not toxic';
  
  if (isToxic) {
    // Enhanced "very toxic" detection logic:
    // 1. Check if any category exceeds its threshold by a significant margin (20%)
    // 2. Check if multiple categories are detected simultaneously
    const hasHighToxicity = Object.entries(results).some(([key, value]) => {
      if (!value.is_detected) return false;
      
      const threshold = OPTIMIZED_THRESHOLDS[key] ?? 0.5;
      
      return value.probability >= threshold + 0.2; // 20% above threshold
    });
    
    const hasMultipleCategories = detectedCategories.length >= 2;
    
    toxicityLevel = (hasHighToxicity || hasMultipleCategories) ? 'very toxic' : 'toxic';
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

// Map category names from FastAPI to frontend expected format
const mapCategoryName = (category: string): string => {
  // This mapping should match your expected categories in the frontend
  const categoryMapping: Record<string, string> = {
    'class_0': 'obscenity/profanity',
    'class_1': 'insults',
    'class_2': 'threatening',
    'class_3': 'identity-based negativity',
    // Add more mappings as needed based on your model's classes
    
    // If the FastAPI is already using the right names, use these:
    'obscenity/profanity': 'obscenity/profanity',
    'insults': 'insults',
    'threatening': 'threatening',
    'identity-based negativity': 'identity-based negativity'
  };
  
  return categoryMapping[category] || category;
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