# Chapter 8: Advanced AI Techniques - Mastering Intelligent Analysis

*"The art of being wise is knowing what to overlook." - William James*

---

Now that we have our AI foundation, it's time to level up! This chapter reveals the advanced techniques that separate amateur AI integrations from professional-grade systems. We'll explore sophisticated prompt engineering, multi-step reasoning chains, cost optimization strategies, and specialized analysis workflows.

By the end of this chapter, you'll have an AI system that doesn't just analyze content—it **understands context**, **reasons through complex scenarios**, and **adapts its analysis style** based on content type and business needs.

## 🎯 What We're Building

Advanced AI capabilities including:
- **Dynamic prompt templates** that adapt to content types
- **Multi-step reasoning chains** for complex analysis
- **Content-aware processing** with specialized workflows
- **Cost optimization algorithms** that maximize insight per dollar
- **Quality assurance systems** that validate AI outputs
- **Contextual memory** that improves analysis over time

## 🧠 Advanced Prompt Engineering Patterns

Let's start with sophisticated prompt templates that dramatically improve output quality:

```typescript
// lib/ai/prompt-templates.ts

export interface PromptTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema: any;
  costTier: 'low' | 'medium' | 'high';
  recommendedModels: string[];
}

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize all prompt templates
   */
  private initializeTemplates(): void {
    // Market Intelligence Template
    this.registerTemplate({
      name: 'market_intelligence',
      description: 'Deep market analysis with trend prediction',
      systemPrompt: `You are a senior market intelligence analyst with 15+ years of experience in technology and finance sectors. Your analysis directly influences multi-million dollar investment decisions.

CORE COMPETENCIES:
- Pattern recognition across market cycles
- Signal vs noise differentiation in news flow
- Risk assessment and opportunity identification
- Cross-sector trend correlation analysis
- Regulatory and competitive landscape awareness

ANALYSIS FRAMEWORK:
1. MARKET CONTEXT: Current macro environment and sector positioning
2. SIGNAL DETECTION: Identify genuine market-moving information
3. TREND ANALYSIS: Short-term momentum vs long-term structural shifts
4. RISK ASSESSMENT: Downside scenarios and mitigation strategies
5. OPPORTUNITY MAPPING: Actionable insights for decision-makers
6. CONFIDENCE SCORING: Probabilistic assessment of predictions

OUTPUT REQUIREMENTS:
- Executive-level clarity and conciseness
- Quantified confidence levels (0.0-1.0)
- Specific, actionable recommendations
- Risk-adjusted opportunity sizing
- Timeline-specific predictions (1W, 1M, 3M, 1Y)`,

      userPromptTemplate: `MARKET INTELLIGENCE REQUEST

TIME PERIOD: {timeframe}
CONTENT SOURCES: {source_count} sources ({source_breakdown})
FOCUS SECTORS: {sectors}

CONTENT FOR ANALYSIS:
{formatted_content}

SPECIFIC ANALYSIS REQUIREMENTS:
{custom_instructions}

Please provide a comprehensive market intelligence report following our analysis framework.`,

      outputSchema: {
        market_overview: {
          current_sentiment: 'string',
          key_drivers: 'array',
          market_phase: 'string',
          volatility_assessment: 'number'
        },
        trend_analysis: {
          emerging_trends: 'array',
          declining_trends: 'array',
          trend_convergence: 'array'
        },
        opportunity_map: {
          short_term: 'array',
          medium_term: 'array',
          long_term: 'array'
        },
        risk_matrix: {
          high_probability_risks: 'array',
          black_swan_scenarios: 'array',
          mitigation_strategies: 'array'
        },
        predictions: {
          one_week: 'object',
          one_month: 'object',
          three_months: 'object',
          one_year: 'object'
        }
      },
      costTier: 'high',
      recommendedModels: ['claude-3-5-sonnet-20241022', 'gpt-4o']
    });

    // Technical Analysis Template
    this.registerTemplate({
      name: 'technical_analysis',
      description: 'Deep-dive technical content analysis',
      systemPrompt: `You are a principal technical analyst at a leading technology research firm. You specialize in evaluating emerging technologies, architectural decisions, and technical market trends.

EXPERTISE AREAS:
- Software architecture and system design patterns
- Emerging technology assessment and adoption curves
- Technical risk evaluation and mitigation
- Developer ecosystem analysis
- Infrastructure and scalability considerations
- Security and compliance implications

ANALYSIS METHODOLOGY:
1. TECHNICAL MERIT: Objective assessment of technological advancement
2. ADOPTION FEASIBILITY: Real-world implementation challenges and opportunities
3. ECOSYSTEM IMPACT: Effects on existing technology stacks and workflows
4. COMPETITIVE LANDSCAPE: Technical differentiation and market positioning
5. RISK-REWARD PROFILE: Technical debt vs innovation benefits
6. TIMELINE ASSESSMENT: Development and deployment practicalities`,

      userPromptTemplate: `TECHNICAL ANALYSIS REQUEST

ANALYSIS FOCUS: {analysis_focus}
TECHNICAL DOMAINS: {technical_domains}
TIMEFRAME: {timeframe}

CONTENT FOR ANALYSIS:
{formatted_content}

SPECIFIC TECHNICAL QUESTIONS:
{technical_questions}

Please provide a comprehensive technical analysis following our methodology.`,

      outputSchema: {
        technical_assessment: {
          innovation_score: 'number',
          complexity_rating: 'number',
          maturity_level: 'string',
          technical_feasibility: 'number'
        },
        adoption_analysis: {
          adoption_barriers: 'array',
          enabling_factors: 'array',
          timeline_estimate: 'string',
          adoption_curve_position: 'string'
        },
        competitive_implications: {
          market_differentiators: 'array',
          threat_assessment: 'array',
          opportunity_windows: 'array'
        }
      },
      costTier: 'medium',
      recommendedModels: ['claude-3-5-sonnet-20241022', 'gpt-4o']
    });

    // News Synthesis Template
    this.registerTemplate({
      name: 'news_synthesis',
      description: 'Fast, cost-effective news summarization',
      systemPrompt: `You are an experienced news editor who specializes in creating concise, accurate summaries for executive briefings. Your summaries are read by C-level executives who need the essential information quickly.

EDITORIAL PRINCIPLES:
- Lead with the most newsworthy and impactful information
- Maintain objectivity and factual accuracy
- Highlight business and market implications
- Connect related stories across sources
- Identify emerging themes and patterns
- Flag breaking news and significant developments

SUMMARY STRUCTURE:
1. HEADLINE SYNTHESIS: Capture the core story in one compelling headline
2. KEY DEVELOPMENTS: 3-5 most important factual updates
3. BUSINESS IMPACT: Immediate and potential future implications
4. STAKEHOLDER EFFECTS: Who wins, who loses, who should pay attention
5. FOLLOW-UP ITEMS: What to watch for next`,

      userPromptTemplate: `NEWS SYNTHESIS REQUEST

TIME PERIOD: {timeframe}
CONTENT VOLUME: {content_count} items
PRIORITY FOCUS: {priority_topics}

CONTENT FOR SYNTHESIS:
{formatted_content}

Please provide a concise executive news synthesis.`,

      outputSchema: {
        headline: 'string',
        key_developments: 'array',
        business_impact: {
          immediate: 'array',
          potential: 'array'
        },
        stakeholder_effects: 'array',
        follow_up_items: 'array',
        urgency_level: 'string'
      },
      costTier: 'low',
      recommendedModels: ['gpt-4o-mini', 'claude-3-haiku-20240307']
    });
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): PromptTemplate | null {
    return this.templates.get(name) || null;
  }

  /**
   * Get templates by cost tier
   */
  getTemplatesByCostTier(tier: 'low' | 'medium' | 'high'): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.costTier === tier);
  }

  /**
   * Get recommended template based on content and budget
   */
  getRecommendedTemplate(contentType: string, budget: 'low' | 'medium' | 'high'): PromptTemplate | null {
    const templates = Array.from(this.templates.values()).filter(t => {
      return t.costTier === budget || (budget === 'high' && t.costTier !== 'low');
    });

    // Simple matching logic - can be enhanced with ML
    if (contentType.includes('market') || contentType.includes('financial')) {
      return templates.find(t => t.name === 'market_intelligence') || templates[0];
    }
    if (contentType.includes('technical') || contentType.includes('technology')) {
      return templates.find(t => t.name === 'technical_analysis') || templates[0];
    }
    
    return templates.find(t => t.name === 'news_synthesis') || templates[0];
  }

  /**
   * Build prompt from template
   */
  buildPrompt(templateName: string, variables: Record<string, any>): { systemPrompt: string; userPrompt: string } | null {
    const template = this.getTemplate(templateName);
    if (!template) return null;

    let userPrompt = template.userPromptTemplate;
    
    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return {
      systemPrompt: template.systemPrompt,
      userPrompt
    };
  }
}
```

## 🔗 Multi-Step Reasoning Chains

For complex analysis, we'll implement reasoning chains that break down problems:

```typescript
// lib/ai/reasoning-chains.ts

import { AIService } from './ai-service';
import { PromptTemplateManager } from './prompt-templates';

export interface ReasoningStep {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  estimatedTokens: number;
  dependencies?: string[];
}

export interface ReasoningChain {
  name: string;
  description: string;
  steps: ReasoningStep[];
  totalEstimatedCost: number;
}

export class ReasoningChainManager {
  private aiService: AIService;
  private promptManager: PromptTemplateManager;
  private chains: Map<string, ReasoningChain> = new Map();

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.promptManager = new PromptTemplateManager();
    this.initializeChains();
  }

  /**
   * Initialize reasoning chains
   */
  private initializeChains(): void {
    // Market Intelligence Chain
    this.registerChain({
      name: 'comprehensive_market_analysis',
      description: 'Multi-step market intelligence with cross-validation',
      steps: [
        {
          name: 'initial_assessment',
          description: 'Quick content categorization and priority scoring',
          inputSchema: { content: 'array', timeframe: 'string' },
          outputSchema: { categories: 'array', priorities: 'array', signals: 'array' },
          estimatedTokens: 500
        },
        {
          name: 'trend_extraction',
          description: 'Identify and analyze emerging trends',
          inputSchema: { prioritized_content: 'array', context: 'object' },
          outputSchema: { trends: 'array', confidence_scores: 'array' },
          estimatedTokens: 1000,
          dependencies: ['initial_assessment']
        },
        {
          name: 'risk_modeling',
          description: 'Assess risks and opportunities',
          inputSchema: { trends: 'array', market_context: 'object' },
          outputSchema: { risks: 'array', opportunities: 'array', scenarios: 'array' },
          estimatedTokens: 800,
          dependencies: ['trend_extraction']
        },
        {
          name: 'synthesis',
          description: 'Synthesize insights into actionable intelligence',
          inputSchema: { assessments: 'array', trends: 'array', risks: 'array' },
          outputSchema: { final_report: 'object', recommendations: 'array' },
          estimatedTokens: 1200,
          dependencies: ['initial_assessment', 'trend_extraction', 'risk_modeling']
        }
      ],
      totalEstimatedCost: 0.15 // USD estimate
    });

    // Content Quality Enhancement Chain
    this.registerChain({
      name: 'content_quality_enhancement',
      description: 'Multi-pass content filtering and enhancement',
      steps: [
        {
          name: 'quality_scoring',
          description: 'Score content quality across multiple dimensions',
          inputSchema: { content: 'array' },
          outputSchema: { scores: 'array', filtered_content: 'array' },
          estimatedTokens: 300
        },
        {
          name: 'duplicate_detection',
          description: 'Identify and handle duplicate/similar content',
          inputSchema: { content: 'array', similarity_threshold: 'number' },
          outputSchema: { unique_content: 'array', duplicate_clusters: 'array' },
          estimatedTokens: 400,
          dependencies: ['quality_scoring']
        },
        {
          name: 'content_enhancement',
          description: 'Enhance and standardize content format',
          inputSchema: { filtered_content: 'array' },
          outputSchema: { enhanced_content: 'array', metadata: 'object' },
          estimatedTokens: 600,
          dependencies: ['duplicate_detection']
        }
      ],
      totalEstimatedCost: 0.08
    });
  }

  /**
   * Register a reasoning chain
   */
  registerChain(chain: ReasoningChain): void {
    this.chains.set(chain.name, chain);
  }

  /**
   * Execute a reasoning chain
   */
  async executeChain(chainName: string, initialInput: any): Promise<any> {
    const chain = this.chains.get(chainName);
    if (!chain) {
      throw new Error(`Reasoning chain '${chainName}' not found`);
    }

    const stepResults: Map<string, any> = new Map();
    const executionLog: any[] = [];

    console.log(`🔗 Executing reasoning chain: ${chain.name}`);
    console.log(`   Steps: ${chain.steps.length}, Estimated cost: $${chain.totalEstimatedCost}`);

    for (const step of chain.steps) {
      console.log(`   Executing step: ${step.name}`);
      
      // Check dependencies
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepResults.has(dep)) {
            throw new Error(`Step '${step.name}' depends on '${dep}' which hasn't been executed`);
          }
        }
      }

      // Prepare input for this step
      const stepInput = this.prepareStepInput(step, initialInput, stepResults);
      
      // Execute step
      const startTime = Date.now();
      const stepResult = await this.executeStep(step, stepInput);
      const executionTime = Date.now() - startTime;

      // Store result
      stepResults.set(step.name, stepResult);
      
      executionLog.push({
        step: step.name,
        execution_time_ms: executionTime,
        tokens_used: stepResult.token_usage?.total_tokens || 0,
        success: true
      });

      console.log(`   ✅ Step completed: ${step.name} (${executionTime}ms)`);
    }

    // Return final result
    const finalStep = chain.steps[chain.steps.length - 1];
    const finalResult = stepResults.get(finalStep.name);

    return {
      result: finalResult,
      execution_log: executionLog,
      total_steps: chain.steps.length,
      total_time_ms: executionLog.reduce((sum, log) => sum + log.execution_time_ms, 0),
      total_tokens: executionLog.reduce((sum, log) => sum + log.tokens_used, 0)
    };
  }

  /**
   * Prepare input for a specific step
   */
  private prepareStepInput(step: ReasoningStep, initialInput: any, previousResults: Map<string, any>): any {
    const stepInput: any = { ...initialInput };

    // Add results from dependency steps
    if (step.dependencies) {
      for (const dep of step.dependencies) {
        const depResult = previousResults.get(dep);
        if (depResult) {
          stepInput[`${dep}_result`] = depResult.analysis || depResult;
        }
      }
    }

    return stepInput;
  }

  /**
   * Execute a single reasoning step
   */
  private async executeStep(step: ReasoningStep, input: any): Promise<any> {
    // Build specialized prompt for this step
    const prompt = this.buildStepPrompt(step, input);
    
    // Execute with AI service
    const response = await this.aiService.analyzeContent({
      content: input,
      analysisType: 'summary', // Could be more specific
      instructions: prompt
    });

    return response;
  }

  /**
   * Build prompt for a reasoning step
   */
  private buildStepPrompt(step: ReasoningStep, input: any): string {
    return `REASONING STEP: ${step.name}

OBJECTIVE: ${step.description}

INPUT DATA: ${JSON.stringify(input, null, 2)}

REQUIREMENTS:
- Focus specifically on ${step.name}
- Output must match the expected schema
- Be concise but thorough in your analysis
- Build upon any previous step results provided

Please provide your analysis for this step.`;
  }

  /**
   * Get available chains
   */
  getAvailableChains(): string[] {
    return Array.from(this.chains.keys());
  }

  /**
   * Get chain details
   */
  getChainDetails(chainName: string): ReasoningChain | null {
    return this.chains.get(chainName) || null;
  }
}
```

## 💰 Advanced Cost Optimization

Let's implement smart cost management that maximizes insight per dollar:

```typescript
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
```

## 🔍 Quality Assurance System

Let's add a system that validates AI outputs and improves quality over time:

```typescript
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
```

## 🧪 Advanced AI Testing Suite

Let's create comprehensive tests for our advanced AI features:

```typescript
// scripts/test/test-advanced-ai.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { AIService } from '../../lib/ai/ai-service';
import { PromptTemplateManager } from '../../lib/ai/prompt-templates';
import { ReasoningChainManager } from '../../lib/ai/reasoning-chains';
import { CostOptimizer } from '../../lib/ai/cost-optimizer';
import { QualityAssurance } from '../../lib/ai/quality-assurance';
import logger from '../../lib/logger';

async function testAdvancedAI() {
  console.log('🧠 Testing Advanced AI Techniques...\n');

  try {
    // Test 1: Prompt Templates
    console.log('1. Testing Prompt Templates:');
    const promptManager = new PromptTemplateManager();
    
    const marketTemplate = promptManager.getTemplate('market_intelligence');
    console.log(`✅ Market intelligence template loaded: ${marketTemplate?.name}`);
    
    const techTemplate = promptManager.getTemplate('technical_analysis');
    console.log(`✅ Technical analysis template loaded: ${techTemplate?.name}`);
    
    const newsTemplate = promptManager.getTemplate('news_synthesis');
    console.log(`✅ News synthesis template loaded: ${newsTemplate?.name}`);

    // Test template building
    const builtPrompt = promptManager.buildPrompt('news_synthesis', {
      timeframe: '24 hours',
      content_count: '15',
      priority_topics: 'AI, Technology',
      formatted_content: 'Sample content for testing...'
    });
    
    if (builtPrompt) {
      console.log('✅ Prompt template building successful');
      console.log(`   System prompt length: ${builtPrompt.systemPrompt.length} chars`);
      console.log(`   User prompt length: ${builtPrompt.userPrompt.length} chars`);
    }

    // Test 2: Cost Optimization
    console.log('\n2. Testing Cost Optimization:');
    const costOptimizer = new CostOptimizer({
      maxDailyCost: 10.0,
      maxPerAnalysisCost: 2.0,
      priorityLevels: {
        critical: 1.5,
        important: 0.8,
        routine: 0.3
      },
      modelPreferences: {
        low_cost: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
        balanced: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        premium: ['claude-3-5-sonnet-20241022', 'gpt-4o']
      }
    });

    const recommendation = costOptimizer.getOptimizationRecommendation(
      5000, // content size
      'important', // priority
      'gpt-4o' // current model
    );

    console.log(`✅ Cost optimization recommendation:`);
    console.log(`   Recommended model: ${recommendation.recommendedModel.modelName}`);
    console.log(`   Estimated cost: $${recommendation.estimatedCost.toFixed(4)}`);
    console.log(`   Cost savings: $${recommendation.costSavings.toFixed(4)}`);
    console.log(`   Quality impact: ${recommendation.qualityImpact}`);

    // Test 3: Quality Assurance
    console.log('\n3. Testing Quality Assurance:');
    const qa = new QualityAssurance();
    
    const mockAnalysis = {
      title: 'AI Market Analysis',
      executive_summary: 'AI market shows strong growth with emerging opportunities in enterprise automation',
      key_insights: [
        'Enterprise AI adoption accelerating',
        'New investment in AI infrastructure',
        'Regulatory frameworks developing'
      ],
      trending_topics: [
        { topic: 'AI Automation', relevance_score: 0.9 }
      ],
      content_analysis: {
        sentiment: { overall: 'positive', confidence: 0.8 }
      },
      recommendations: [
        'Invest in AI infrastructure companies',
        'Monitor regulatory developments'
      ],
      confidence_score: 0.75
    };

    const qualityEval = qa.evaluateAnalysis(mockAnalysis, {});
    console.log(`✅ Quality evaluation completed:`);
    console.log(`   Completeness: ${qualityEval.metrics.completeness_score.toFixed(2)}`);
    console.log(`   Coherence: ${qualityEval.metrics.coherence_score.toFixed(2)}`);
    console.log(`   Actionability: ${qualityEval.metrics.actionability_score.toFixed(2)}`);
    console.log(`   Issues found: ${qualityEval.issues.length}`);

    // Test 4: Real AI Analysis with Templates
    console.log('\n4. Testing Template-Based Analysis:');
    const aiService = AIService.getInstance();
    aiService.useClaude('claude-3-5-sonnet-20241022');

    const testContent = {
      tweets: [{
        id: 'test1',
        text: 'Major breakthrough in AI reasoning capabilities announced by leading research lab',
        author: 'AI_Research',
        created_at: new Date().toISOString(),
        engagement_score: 200,
        quality_score: 0.9,
        url: 'https://twitter.com/test'
      }],
      rss_articles: [{
        id: 'article1',
        title: 'The Future of Artificial Intelligence: Trends and Predictions',
        description: 'Comprehensive analysis of AI development trends',
        content: 'Artificial intelligence continues to evolve rapidly...',
        author: 'Tech Expert',
        published_at: new Date().toISOString(),
        source: 'Tech Journal',
        quality_score: 0.85,
        url: 'https://example.com/article'
      }],
      timeframe: {
        from: new Date(Date.now() - 24*60*60*1000).toISOString(),
        to: new Date().toISOString()
      },
      metadata: {
        total_sources: 2,
        source_breakdown: { twitter: 1, telegram: 0, rss: 1 }
      }
    };

    // Test with news synthesis (cost-effective)
    const newsAnalysis = await aiService.analyzeContent({
      content: testContent,
      analysisType: 'summary',
      instructions: 'Use news synthesis approach for cost-effective analysis'
    });

    console.log(`✅ News synthesis analysis completed:`);
    console.log(`   Title: "${newsAnalysis.analysis.title}"`);
    console.log(`   Insights: ${newsAnalysis.analysis.key_insights.length}`);
    console.log(`   Tokens used: ${newsAnalysis.token_usage.total_tokens}`);
    console.log(`   Processing time: ${(newsAnalysis.processing_time_ms / 1000).toFixed(2)}s`);

    // Test 5: Reasoning Chain (if time permits)
    console.log('\n5. Testing Reasoning Chains:');
    const chainManager = new ReasoningChainManager(aiService);
    const availableChains = chainManager.getAvailableChains();
    
    console.log(`✅ Available reasoning chains: ${availableChains.join(', ')}`);
    
    // Get chain details
    const chainDetails = chainManager.getChainDetails('content_quality_enhancement');
    if (chainDetails) {
      console.log(`✅ Content quality enhancement chain:`);
      console.log(`   Steps: ${chainDetails.steps.length}`);
      console.log(`   Estimated cost: $${chainDetails.totalEstimatedCost}`);
    }

    console.log('\n🎉 Advanced AI techniques test completed successfully!');
    console.log('\n💡 Key capabilities now available:');
    console.log('   ✅ Template-based prompt engineering');
    console.log('   ✅ Cost optimization and budget management');
    console.log('   ✅ Quality assurance and validation');
    console.log('   ✅ Multi-step reasoning chains');
    console.log('   ✅ Advanced analysis workflows');

  } catch (error: any) {
    logger.error('Advanced AI test failed', error);
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('API_KEY')) {
      console.log('\n💡 Make sure you have valid API keys in .env.local');
    }
    
    process.exit(1);
  }
}

testAdvancedAI();
```



**Package.json scripts to add:**
```json
{
  "scripts": {
    "test:advanced-ai": "npm run script scripts/test/test-advanced-ai.ts"
  }
}
```

**Test your advanced AI system:**
```bash
npm run test:advanced-ai
```

## 🎯 What We've Accomplished

You now have a professional-grade AI system with advanced capabilities:

✅ **Dynamic Prompt Templates** - Specialized prompts for different analysis types  
✅ **Multi-Step Reasoning Chains** - Complex analysis broken into logical steps  
✅ **Intelligent Cost Optimization** - Maximize insight per dollar spent  
✅ **Quality Assurance System** - Validate outputs and improve over time  
✅ **Template-Based Analysis** - Consistent, high-quality results  
✅ **Budget Management** - Control costs while maintaining quality  

### 🔍 Pro Tips & Common Pitfalls

**💡 Pro Tip:** Use reasoning chains for complex analysis, templates for consistency, and cost optimization for scale.

**⚠️ Common Pitfall:** Don't over-engineer prompts. Start simple and iterate based on actual results.

**🔧 Performance Tip:** Cache template-generated prompts and reuse optimization recommendations for similar content.

**💰 Cost Optimization:** Use news synthesis templates for routine analysis, market intelligence for critical decisions.

---

### 📋 Complete Code Summary - Chapter 8

**Advanced AI Components:**
```typescript
// lib/ai/prompt-templates.ts - Dynamic prompt template system
// lib/ai/reasoning-chains.ts - Multi-step reasoning implementation
// lib/ai/cost-optimizer.ts - Intelligent cost management
// lib/ai/quality-assurance.ts - Output validation and improvement
```

**Testing:**
```typescript
// scripts/test/test-advanced-ai.ts - Comprehensive advanced AI testing
```

## 🎉 **AI Integration Complete!**

With Chapters 7-8 finished, you now have a **world-class AI analysis system** that rivals enterprise solutions. Your system can:

- **Analyze any content type** with specialized templates
- **Optimize costs automatically** while maintaining quality  
- **Chain complex reasoning** for sophisticated analysis
- **Validate output quality** and improve over time
- **Scale efficiently** with budget controls

**Tutorial Progress: ~85% Complete!** 🚀

**Next up:** Chapters 9-11 will focus on **automation and distribution** - turning your intelligent analysis system into a fully automated content operation that runs itself and distributes insights across multiple channels.

---

*Ready to automate everything? The next chapters will show you how to schedule your AI system, distribute content across social media, and build team collaboration workflows! ⚙️*