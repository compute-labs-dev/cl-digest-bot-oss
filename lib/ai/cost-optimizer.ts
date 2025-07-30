// lib/ai/cost-optimizer.ts

import { AIModelConfig, TokenUsage } from '../../types/ai';

export interface CostOptimizationConfig {
  maxDailyCost: number;
  maxPerAnalysisCost: number;
  priorityLevels: {
    critical: number;    // Spend up to this much on critical analysis
    important: number;   // Normal analysis budget
    routine: number;     // Routine analysis budget
  };
  modelPreferences: {
    low_cost: string[];    // Models for cost-conscious analysis
    balanced: string[];    // Balanced cost/performance
    premium: string[];     // Best performance regardless of cost
  };
}

export interface OptimizationRecommendation {
  recommendedModel: AIModelConfig;
  estimatedCost: number;
  costSavings: number;
  qualityImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  explanation: string;
}

export class CostOptimizer {
  private config: CostOptimizationConfig;
  private dailySpend: number = 0;
  private costHistory: { date: string; amount: number; tokens: number }[] = [];

  // Model pricing (per 1K tokens)
  private readonly MODEL_COSTS = {
    'gpt-4o': { input: 0.0025, output: 0.010 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
  };

  constructor(config: CostOptimizationConfig) {
    this.config = config;
    this.loadCostHistory();
  }

  /**
   * Get optimization recommendation for analysis
   */
  getOptimizationRecommendation(
    contentSize: number,
    priority: 'critical' | 'important' | 'routine',
    currentModel: string
  ): OptimizationRecommendation {
    const estimatedTokens = this.estimateTokenUsage(contentSize);
    const availableBudget = this.getAvailableBudget(priority);
    
    // Calculate costs for different models
    const costComparisons = Object.entries(this.MODEL_COSTS).map(([model, pricing]) => {
      const inputCost = (estimatedTokens.input / 1000) * pricing.input;
      const outputCost = (estimatedTokens.output / 1000) * pricing.output;
      const totalCost = inputCost + outputCost;
      
      return {
        model,
        cost: totalCost,
        withinBudget: totalCost <= availableBudget,
        performance: this.getModelPerformanceScore(model)
      };
    });

    // Sort by cost-effectiveness (performance per dollar)
    costComparisons.sort((a, b) => {
      const aRatio = a.performance / a.cost;
      const bRatio = b.performance / b.cost;
      return bRatio - aRatio;
    });

    // Find best option within budget
    const bestOption = costComparisons.find(option => option.withinBudget) || costComparisons[costComparisons.length - 1];
    const currentCost = costComparisons.find(option => option.model === currentModel)?.cost || 0;
    
    return {
      recommendedModel: {
        provider: bestOption.model.includes('gpt') ? 'openai' : 'anthropic',
        modelName: bestOption.model,
        options: this.getOptimalModelOptions(bestOption.model, priority)
      },
      estimatedCost: bestOption.cost,
      costSavings: Math.max(0, currentCost - bestOption.cost),
      qualityImpact: this.assessQualityImpact(currentModel, bestOption.model),
      explanation: this.generateOptimizationExplanation(bestOption, availableBudget, priority)
    };
  }

  /**
   * Estimate token usage based on content size
   */
  private estimateTokenUsage(contentSize: number): { input: number; output: number } {
    // Rough estimates based on content characteristics
    const baseInputTokens = Math.ceil(contentSize / 4); // ~4 chars per token
    const systemPromptTokens = 800; // Average system prompt size
    const inputTokens = baseInputTokens + systemPromptTokens;
    
    // Output typically 15-25% of input for analysis tasks
    const outputTokens = Math.ceil(inputTokens * 0.2);
    
    return { input: inputTokens, output: outputTokens };
  }

  /**
   * Get available budget for priority level
   */
  private getAvailableBudget(priority: 'critical' | 'important' | 'routine'): number {
    const remainingDaily = this.config.maxDailyCost - this.dailySpend;
    const priorityBudget = this.config.priorityLevels[priority];
    const maxPerAnalysis = this.config.maxPerAnalysisCost;
    
    return Math.min(remainingDaily, priorityBudget, maxPerAnalysis);
  }

  /**
   * Get model performance score (0-1 scale)
   */
  private getModelPerformanceScore(model: string): number {
    const scores: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 0.95,
      'gpt-4o': 0.90,
      'gpt-4o-mini': 0.75,
      'claude-3-haiku-20240307': 0.70
    };
    return scores[model] || 0.5;
  }

  /**
   * Get optimal model options for priority level
   */
  private getOptimalModelOptions(model: string, priority: 'critical' | 'important' | 'routine'): any {
    const baseOptions = {
      temperature: 0.7,
      max_tokens: 2000
    };

    switch (priority) {
      case 'critical':
        return {
          ...baseOptions,
          temperature: 0.3, // More conservative for critical analysis
          max_tokens: 3000,
          thinking: model.includes('claude') ? { type: 'enabled', budgetTokens: 30000 } : undefined
        };
      
      case 'important':
        return {
          ...baseOptions,
          max_tokens: 2500,
          thinking: model.includes('claude') ? { type: 'enabled', budgetTokens: 20000 } : undefined
        };
      
      case 'routine':
        return {
          ...baseOptions,
          max_tokens: 1500,
          temperature: 0.8, // Slightly more creative for routine tasks
          thinking: model.includes('claude') ? { type: 'enabled', budgetTokens: 10000 } : undefined
        };
    }
  }

  /**
   * Assess quality impact of model change
   */
  private assessQualityImpact(currentModel: string, recommendedModel: string): 'none' | 'minimal' | 'moderate' | 'significant' {
    const currentScore = this.getModelPerformanceScore(currentModel);
    const recommendedScore = this.getModelPerformanceScore(recommendedModel);
    const difference = currentScore - recommendedScore;

    if (difference <= 0) return 'none';
    if (difference <= 0.05) return 'minimal';
    if (difference <= 0.15) return 'moderate';
    return 'significant';
  }

  /**
   * Generate optimization explanation
   */
  private generateOptimizationExplanation(
    option: any, 
    budget: number, 
    priority: string
  ): string {
    const explanations = [];
    
    if (option.cost <= budget * 0.5) {
      explanations.push('Significant cost savings possible while maintaining quality');
    } else if (option.cost <= budget * 0.8) {
      explanations.push('Moderate cost optimization with minimal quality impact');
    } else {
      explanations.push('Operating near budget limits - consider reducing scope');
    }

    if (priority === 'critical') {
      explanations.push('Using premium settings for critical analysis');
    } else if (priority === 'routine') {
      explanations.push('Cost-optimized settings for routine analysis');
    }

    return explanations.join('. ') + '.';
  }

  /**
   * Record actual cost after analysis
   */
  recordActualCost(tokenUsage: TokenUsage, model: string): void {
    const pricing = this.MODEL_COSTS[model as keyof typeof this.MODEL_COSTS];
    if (!pricing) return;

    const inputCost = (tokenUsage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (tokenUsage.completion_tokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    this.dailySpend += totalCost;
    this.costHistory.push({
      date: new Date().toISOString().split('T')[0],
      amount: totalCost,
      tokens: tokenUsage.total_tokens
    });

    // Keep only last 30 days
    this.costHistory = this.costHistory.slice(-30);
    this.saveCostHistory();
  }

  /**
   * Get cost analytics
   */
  getCostAnalytics(): any {
    const last7Days = this.costHistory.slice(-7);
    const last30Days = this.costHistory;

    return {
      daily_spend: this.dailySpend,
      remaining_budget: this.config.maxDailyCost - this.dailySpend,
      last_7_days: {
        total_cost: last7Days.reduce((sum, entry) => sum + entry.amount, 0),
        total_tokens: last7Days.reduce((sum, entry) => sum + entry.tokens, 0),
        average_daily: last7Days.reduce((sum, entry) => sum + entry.amount, 0) / 7
      },
      last_30_days: {
        total_cost: last30Days.reduce((sum, entry) => sum + entry.amount, 0),
        total_tokens: last30Days.reduce((sum, entry) => sum + entry.tokens, 0),
        average_daily: last30Days.reduce((sum, entry) => sum + entry.amount, 0) / 30
      },
      budget_utilization: (this.dailySpend / this.config.maxDailyCost) * 100
    };
  }

  /**
   * Load cost history from storage
   */
  private loadCostHistory(): void {
    try {
      const stored = localStorage.getItem('ai_cost_history');
      if (stored) {
        this.costHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load cost history:', error);
    }
  }

  /**
   * Save cost history to storage
   */
  private saveCostHistory(): void {
    try {
      localStorage.setItem('ai_cost_history', JSON.stringify(this.costHistory));
    } catch (error) {
      console.warn('Failed to save cost history:', error);
    }
  }

  /**
   * Reset daily spending (call at midnight)
   */
  resetDailySpend(): void {
    this.dailySpend = 0;
  }
}