export interface Alert {
  id: string;
  organization_id: string;
  user_id: string;
  source: string;
  type: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string | null;
  relevance_score: number;
  matched_risks: string[];
  country: string | null;
  is_read: boolean;
  ai_generated: boolean;
  is_edited: boolean;
  created_at: string;
}