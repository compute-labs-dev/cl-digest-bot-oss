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