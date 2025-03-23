// Enhanced toxicity interfaces
interface ToxicityResponse {
  predictions: ToxicityPrediction[];
  model_version: string;
}

interface ToxicityPrediction {
  text: string;
  toxicity_level: 'not toxic' | 'toxic' | 'very toxic';
  toxicity_probability: number;
  category_probabilities: Record<string, number>;
  raw_probabilities: Record<string, number>;
  is_toxic: boolean;
  censored_text: string | null;
}

interface CensorResponse {
  original_text: string;
  censored_text: string;
  toxicity_level: string;
  is_toxic: boolean;
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
}

// Direct API URL configuration - no proxy
const API_BASE_URL = 'https://thesis-api-wh7g.onrender.com';

/**
 * Enhanced toxicity check with proper error handling, timeouts,
 * and improved response formatting
 */
export const checkToxicity = async (text: string): Promise<ToxicityResult> => {
  if (!text || text.trim() === '') {
    return getDefaultToxicityResult();
  }

  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        censor_output: true, // Always request censored version
        toxicity_threshold: 0.5 // Default threshold 
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Toxicity check failed: ${response.status}`);
    }
    
    const data: ToxicityResponse = await response.json();
    
    // Only expecting one prediction for a single text
    if (!data.predictions || data.predictions.length === 0) {
      throw new Error('No predictions returned');
    }
    
    const prediction = data.predictions[0];
    
    // Ensure no undefined values - important for Firebase
    // Fix: Explicitly type the object with Record
    const sanitizedResults: Record<string, { probability: number; is_detected: boolean }> = {};
    
    if (prediction.category_probabilities) {
      Object.entries(prediction.category_probabilities).forEach(([key, value]) => {
        if (value !== undefined) {
          sanitizedResults[key] = {
            probability: Number(value),
            is_detected: Number(value) >= 0.5
          };
        }
      });
    }
    
    // Ensure raw_probabilities has no undefined values
    // Fix: Explicitly type the object with Record
    const sanitizedRawProbs: Record<string, number> = {};
    
    if (prediction.raw_probabilities) {
      Object.entries(prediction.raw_probabilities).forEach(([key, value]) => {
        if (value !== undefined) {
          sanitizedRawProbs[key] = Number(value);
        }
      });
    }
    
    // Transform to our standardized format with properly typed objects
    return {
      results: sanitizedResults,
      summary: {
        is_toxic: prediction.is_toxic,
        toxicity_level: prediction.toxicity_level || 'not toxic',
        detected_categories: getDetectedCategories(prediction.category_probabilities)
      },
      raw_probabilities: Object.keys(sanitizedRawProbs).length > 0 ? sanitizedRawProbs : null,
      censored_text: prediction.censored_text
    };
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
 * Enhanced batch toxicity checking
 * Useful for checking multiple texts at once
 */
export const batchCheckToxicity = async (texts: string[]): Promise<ToxicityResult[]> => {
  if (!texts || texts.length === 0) {
    return [];
  }
  
  // Limit batch size to prevent overloading the API
  const maxBatchSize = 50;
  const limitedTexts = texts.slice(0, maxBatchSize);
  
  try {
    const response = await fetch(`${API_BASE_URL}/batch-predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: limitedTexts,
        censor_output: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Batch toxicity check failed: ${response.status}`);
    }
    
    const data: ToxicityResponse = await response.json();
    
    return data.predictions.map(prediction => {
      // Fix: Explicitly type objects used for string indexing
      const sanitizedResults: Record<string, { probability: number; is_detected: boolean }> = {};
      const sanitizedRawProbs: Record<string, number> = {};
      
      // Process category probabilities
      if (prediction.category_probabilities) {
        Object.entries(prediction.category_probabilities).forEach(([key, value]) => {
          if (value !== undefined) {
            sanitizedResults[key] = {
              probability: Number(value),
              is_detected: Number(value) >= 0.5
            };
          }
        });
      }
      
      // Process raw probabilities
      if (prediction.raw_probabilities) {
        Object.entries(prediction.raw_probabilities).forEach(([key, value]) => {
          if (value !== undefined) {
            sanitizedRawProbs[key] = Number(value);
          }
        });
      }
      
      return {
        results: sanitizedResults,
        summary: {
          is_toxic: prediction.is_toxic,
          toxicity_level: prediction.toxicity_level || 'not toxic',
          detected_categories: getDetectedCategories(prediction.category_probabilities)
        },
        raw_probabilities: Object.keys(sanitizedRawProbs).length > 0 ? sanitizedRawProbs : null,
        censored_text: prediction.censored_text
      };
    });
  } catch (error) {
    console.error('Error in batch toxicity check:', error);
    // Return default results for each text
    return limitedTexts.map(() => getDefaultToxicityResult());
  }
};

/**
 * Enhanced text censoring with configurable severity levels
 */
export const censorText = async (
  text: string, 
  level: 'auto' | 'light' | 'medium' | 'heavy' = 'auto'
): Promise<CensorResponse> => {
  if (!text || text.trim() === '') {
    return {
      original_text: text,
      censored_text: text,
      toxicity_level: 'not toxic',
      is_toxic: false
    };
  }

  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/censor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        level
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('Failed to censor text');
    }
    
    return await response.json();
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

// Helper function to extract detected categories
const getDetectedCategories = (categories: Record<string, number> = {}): string[] => {
  return Object.entries(categories)
    .filter(([_, value]) => value >= 0.5)
    .map(([key]) => key);
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
  censored_text: null
});