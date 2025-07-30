// config/environment.ts

export interface EnvironmentConfig {
    development: boolean;
    apiTimeouts: {
      twitter: number;
      telegram: number;
      rss: number;
    };
    logging: {
      level: string;
      enableConsole: boolean;
    };
    rateLimit: {
      respectLimits: boolean;
      bufferTimeMs: number;
    };
  }
  
  function getEnvironmentConfig(): EnvironmentConfig {
    const isDev = process.env.NODE_ENV === 'development';
    
    return {
      development: isDev,
      
      apiTimeouts: {
        twitter: isDev ? 10000 : 30000,    // Shorter timeouts in dev
        telegram: isDev ? 15000 : 45000,
        rss: isDev ? 5000 : 15000,
      },
      
      logging: {
        level: isDev ? 'debug' : 'info',
        enableConsole: isDev,
      },
      
      rateLimit: {
        respectLimits: true,
        bufferTimeMs: isDev ? 1000 : 5000,  // Less aggressive in dev
      }
    };
  }
  
  export const envConfig = getEnvironmentConfig();