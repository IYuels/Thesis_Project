export interface ToxicityPrediction {
    prediction: boolean;
    probability: number;
  }
  
  export interface ToxicityResult {
    TOXICITY: ToxicityPrediction;
    SEVERE_TOXICITY: ToxicityPrediction;
    INSULT: ToxicityPrediction;
    PROFANITY: ToxicityPrediction;
    IDENTITY_ATTACK: ToxicityPrediction;
    THREAT: ToxicityPrediction;
    NOT_TOXIC: ToxicityPrediction;
  }
  
  export interface BatchToxicityResponse {
    results: {
      [key: string]: ToxicityResult;
    };
  }