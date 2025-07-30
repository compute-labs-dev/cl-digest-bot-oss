// lib/ai/quality-assurance.ts

export interface QualityMetrics {
    completeness_score: number;      // 0-1: Are all required fields present?
    coherence_score: number;         // 0-1: Does the analysis make logical sense?
    factual_consistency: number;     // 0-1: Are facts consistent across the analysis?
    actionability_score: number;     // 0-1: How actionable are the insights?
    confidence_calibration: number;  // 0-1: How well-calibrated are confidence scores?
  }
  
  export interface QualityIssue {
    type: 'missing_field' | 'inconsistency' | 'low_confidence' | 'poor_actionability';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
  }
  
  export class QualityAssurance {
    
    /**
     * Evaluate analysis quality
     */
    evaluateAnalysis(analysis: any, originalContent: any): { metrics: QualityMetrics; issues: QualityIssue[] } {
      const metrics = this.calculateQualityMetrics(analysis, originalContent);
      const issues = this.identifyQualityIssues(analysis, metrics);
      
      return { metrics, issues };
    }
  
    /**
     * Calculate quality metrics
     */
    private calculateQualityMetrics(analysis: any, originalContent: any): QualityMetrics {
      return {
        completeness_score: this.assessCompleteness(analysis),
        coherence_score: this.assessCoherence(analysis),
        factual_consistency: this.assessFactualConsistency(analysis, originalContent),
        actionability_score: this.assessActionability(analysis),
        confidence_calibration: this.assessConfidenceCalibration(analysis)
      };
    }
  
    /**
     * Assess completeness of analysis
     */
    private assessCompleteness(analysis: any): number {
      const requiredFields = [
        'title', 'executive_summary', 'key_insights', 
        'trending_topics', 'content_analysis', 'recommendations'
      ];
      
      let score = 0;
      for (const field of requiredFields) {
        if (analysis[field]) {
          if (Array.isArray(analysis[field])) {
            score += analysis[field].length > 0 ? 1 : 0.5;
          } else if (typeof analysis[field] === 'string') {
            score += analysis[field].length > 10 ? 1 : 0.5;
          } else {
            score += 1;
          }
        }
      }
      
      return score / requiredFields.length;
    }
  
    /**
     * Assess logical coherence
     */
    private assessCoherence(analysis: any): number {
      let score = 0.5; // Base score
      
      // Check if key insights align with executive summary
      if (analysis.key_insights && analysis.executive_summary) {
        const summaryKeywords = this.extractKeywords(analysis.executive_summary);
        const insightKeywords = analysis.key_insights.join(' ');
        const overlap = this.calculateKeywordOverlap(summaryKeywords, insightKeywords);
        score += overlap * 0.3;
      }
      
      // Check if recommendations align with identified issues
      if (analysis.recommendations && analysis.trending_topics) {
        // Simple heuristic: recommendations should relate to trending topics
        score += 0.2;
      }
      
      return Math.min(1.0, score);
    }
  
    /**
     * Assess factual consistency
     */
    private assessFactualConsistency(analysis: any, originalContent: any): number {
      // This is a simplified implementation
      // In practice, you'd want more sophisticated fact-checking
      
      let score = 0.7; // Assume decent consistency by default
      
      // Check if numbers mentioned in analysis appear in original content
      const analysisNumbers = this.extractNumbers(JSON.stringify(analysis));
      const contentNumbers = this.extractNumbers(JSON.stringify(originalContent));
      
      for (const num of analysisNumbers) {
        if (contentNumbers.includes(num)) {
          score += 0.1;
        }
      }
      
      return Math.min(1.0, score);
    }
  
    /**
     * Assess actionability of insights
     */
    private assessActionability(analysis: any): number {
      let score = 0;
      
      if (analysis.recommendations) {
        for (const rec of analysis.recommendations) {
          // Look for action verbs and specific suggestions
          if (this.containsActionVerbs(rec)) score += 0.2;
          if (this.containsSpecificDetails(rec)) score += 0.2;
        }
      }
      
      return Math.min(1.0, score);
    }
  
    /**
     * Assess confidence calibration
     */
    private assessConfidenceCalibration(analysis: any): number {
      // Check if confidence scores are reasonable and consistent
      let score = 0.5;
      
      if (analysis.confidence_score) {
        if (analysis.confidence_score > 0.3 && analysis.confidence_score < 0.95) {
          score += 0.3; // Reasonable confidence range
        }
      }
      
      if (analysis.content_analysis?.sentiment?.confidence) {
        const sentimentConfidence = analysis.content_analysis.sentiment.confidence;
        if (sentimentConfidence > 0.5) {
          score += 0.2;
        }
      }
      
      return Math.min(1.0, score);
    }
  
    /**
     * Identify quality issues
     */
    private identifyQualityIssues(analysis: any, metrics: QualityMetrics): QualityIssue[] {
      const issues: QualityIssue[] = [];
      
      if (metrics.completeness_score < 0.8) {
        issues.push({
          type: 'missing_field',
          severity: 'high',
          description: 'Analysis is missing required fields or has incomplete data',
          suggestion: 'Ensure all required analysis sections are populated with meaningful content'
        });
      }
      
      if (metrics.coherence_score < 0.6) {
        issues.push({
          type: 'inconsistency',
          severity: 'medium',
          description: 'Analysis lacks logical coherence between sections',
          suggestion: 'Review prompt design to ensure better alignment between analysis components'
        });
      }
      
      if (analysis.confidence_score && analysis.confidence_score < 0.4) {
        issues.push({
          type: 'low_confidence',
          severity: 'medium',
          description: 'AI model expressed low confidence in analysis',
          suggestion: 'Consider providing more context or using a different analysis approach'
        });
      }
      
      if (metrics.actionability_score < 0.5) {
        issues.push({
          type: 'poor_actionability',
          severity: 'low',
          description: 'Analysis lacks specific, actionable recommendations',
          suggestion: 'Enhance prompts to request more specific and actionable insights'
        });
      }
      
      return issues;
    }
  
    // Helper methods
    private extractKeywords(text: string): string[] {
      return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);
    }
  
    private calculateKeywordOverlap(keywords1: string[], keywords2: string): number {
      const words2 = keywords2.toLowerCase().split(/\s+/);
      const matches = keywords1.filter(word => words2.includes(word));
      return matches.length / Math.max(keywords1.length, 1);
    }
  
    private extractNumbers(text: string): number[] {
      const matches = text.match(/\d+(?:\.\d+)?/g);
      return matches ? matches.map(Number) : [];
    }
  
    private containsActionVerbs(text: string): boolean {
      const actionVerbs = ['implement', 'develop', 'create', 'establish', 'build', 'design', 'optimize', 'improve', 'focus', 'invest', 'consider', 'evaluate'];
      return actionVerbs.some(verb => text.toLowerCase().includes(verb));
    }
  
    private containsSpecificDetails(text: string): boolean {
      // Look for specific timeframes, numbers, or concrete nouns
      return /\d+/.test(text) || 
             /(within|by|before|after)/.test(text.toLowerCase()) ||
             /(specific|particular|detailed)/.test(text.toLowerCase());
    }
  }