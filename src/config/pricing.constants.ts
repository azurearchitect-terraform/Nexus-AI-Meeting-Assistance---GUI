export const USD_TO_INR_RATE = 84.0;

export interface ModelPricing {
  modelId: string;
  pricePer1MInputUSD: number;
  pricePer1MOutputUSD: number;
}

export const API_PRICING: ModelPricing[] = [
  // Gemini 3.x Series (Estimates based on Google's pricing)
  {
    modelId: "gemini-3.8-flash",
    pricePer1MInputUSD: 0.15,
    pricePer1MOutputUSD: 0.60,
  },
  {
    modelId: "gemini-3.7-flash",
    pricePer1MInputUSD: 0.15,
    pricePer1MOutputUSD: 0.60,
  },
  {
    modelId: "gemini-3.5-flash",
    pricePer1MInputUSD: 0.15,
    pricePer1MOutputUSD: 0.60,
  },
  {
    modelId: "gemini-3.6-flash",
    pricePer1MInputUSD: 0.15,
    pricePer1MOutputUSD: 0.60,
  },
  {
    modelId: "gemini-3.5-flash-lite",
    pricePer1MInputUSD: 0.075,
    pricePer1MOutputUSD: 0.30,
  },
  {
    modelId: "gemini-3.1-pro-preview",
    pricePer1MInputUSD: 1.25,
    pricePer1MOutputUSD: 5.00,
  },
  
  // OpenAI Models
  {
    modelId: "gpt-4o",
    pricePer1MInputUSD: 5.00,
    pricePer1MOutputUSD: 15.00,
  },
  {
    modelId: "gpt-4o-mini",
    pricePer1MInputUSD: 0.15,
    pricePer1MOutputUSD: 0.60,
  },
  
  // Fallback defaults if model is unknown
  {
    modelId: "default",
    pricePer1MInputUSD: 0.15,
    pricePer1MOutputUSD: 0.60,
  }
];

export const getPricingForModel = (modelId: string): ModelPricing => {
  return API_PRICING.find(p => p.modelId === modelId) || API_PRICING.find(p => p.modelId === "default")!;
};
