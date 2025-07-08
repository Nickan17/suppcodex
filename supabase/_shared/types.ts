export interface Ingredient { name: string; dosage?: string; form?: string; }

export interface SupplementData {
  product_id:   string;
  brand:        string;
  product_name: string;
  ingredients:  Ingredient[];
  label_claims?:     string[];
  certifications?:   string[];
  warnings?:         string[];
  reviews?: { positive: number; negative: number };
}

export interface SimplifiedAIResponse {
  pid: string;  // product_id
  t:    number; // Transparency / Label honesty 0-10
  dose: number; // Clinical dosing / bioavailability 0-10
  qual: number; // Quality & certifications 0-10
  risk: number; // Additives & brand risk 0-10
  highlights: string[]; // 1-3 bullets
}

export interface ScoreBreakdownDetail { score: number; reasons: string[]; weight: number; }

export interface SupplementScoreBreakdown {
  ingredient_transparency: ScoreBreakdownDetail;
  label_accuracy:          ScoreBreakdownDetail;
  clinical_doses:          ScoreBreakdownDetail;
  bioavailability:         ScoreBreakdownDetail;
  third_party_testing:     ScoreBreakdownDetail;
  manufacturing_standards: ScoreBreakdownDetail;
  additives_fillers:       ScoreBreakdownDetail;
  brand_history:           ScoreBreakdownDetail;
  consumer_sentiment:      ScoreBreakdownDetail;
}

export interface OverallAssessment {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  safety_rating: string;
  efficacy_rating: string;
  transparency_rating: string;
}

export interface Source { type: string; source: string; url: string; relevance: string; }

export interface FullSupplementScoreResponse {
  product_id: string;
  product_name: string;
  final_score: number;
  score_breakdown: SupplementScoreBreakdown;
  overall_assessment: OverallAssessment;
  sources: Source[];
  timestamp: string;
  confidence_score: number;
  error?: string;
}
