interface ToxicityResponse {
    results: Record<string, {
      probability: number;
      is_detected: boolean;
    }>;
    summary: {
      is_toxic: boolean;
      detected_categories: string[];
    };
    censored_text: string | null;
  }
  
  interface CensorResponse {
    original_text: string;
    censored_text: string;
  }
  
  export const checkToxicity = async (text: string): Promise<ToxicityResponse> => {
    try {
      const response = await fetch('https://thesis-api-wh7g.onrender.com/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          min_probability: 0.0,
          apply_censoring: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Toxicity check failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error checking toxicity:', error);
      // Return default values in case of error
      return {
        results: {},
        summary: {
          is_toxic: false,
          detected_categories: []
        },
        censored_text: null
      };
    }
  };
  
  export const censorText = async (text: string): Promise<CensorResponse> => {
    try {
      const response = await fetch('https://thesis-api-wh7g.onrender.com/censor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          apply_censoring: true
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to censor text');
      }
  
      return await response.json();
    } catch (error) {
      console.error('Error censoring text:', error);
      // Return original text if censoring fails
      return {
        original_text: text,
        censored_text: text
      };
    }
  };