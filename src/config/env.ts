/**
 * SceneOS — Environment Configuration & Startup Validator
 * 
 * Enforces security boundaries:
 * 1. Checks that no privileged keys (SERVICE_ROLE) leaked into client VITE_ scope.
 * 2. Determines active data provider ('mock' vs 'supabase').
 * 3. Validates required URL & anon key formats if live Supabase mode is requested.
 */

export type DataProviderType = 'mock' | 'supabase';

export interface AppConfig {
  dataProvider: DataProviderType;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  isMock: boolean;
  appEnv: string;
  appVersion: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  config: AppConfig;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawProvider = (import.meta.env.VITE_DATA_PROVIDER || 'mock').toLowerCase().trim();
  const dataProvider: DataProviderType = rawProvider === 'supabase' ? 'supabase' : 'mock';

  let supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const appEnv = import.meta.env.VITE_APP_ENV || 'development';
  const appVersion = import.meta.env.VITE_APP_VERSION || '0.2.0';

  // 1. Critical Security Boundary Check
  // Inspect import.meta.env for any forbidden privileged keys
  const forbiddenKeys = ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SERVICE_ROLE_KEY'];
  for (const key of forbiddenKeys) {
    if (import.meta.env[key]) {
      errors.push(`CRITICAL SECURITY VIOLATION: Privileged secret "${key}" is exposed in client environment! Remove immediately.`);
    }
  }

  // 2. Provider-Specific Validation
  if (dataProvider === 'supabase') {
    if (!supabaseUrl || supabaseUrl === 'https://your-project-ref.supabase.co') {
      errors.push('VITE_SUPABASE_URL is missing or contains placeholder URL.');
    } else if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://localhost')) {
      errors.push('VITE_SUPABASE_URL must be a valid HTTPS URL (or localhost for local dev).');
    }

    if (!supabaseAnonKey || supabaseAnonKey.includes('your-anon-key-placeholder')) {
      errors.push('VITE_SUPABASE_ANON_KEY is missing or contains placeholder key.');
    }
  } else {
    // In mock mode, warn if credentials exist but mock mode was explicitly forced
    if (supabaseUrl && supabaseAnonKey && rawProvider === 'mock') {
      warnings.push('Supabase credentials detected, but running in Mock Mode because VITE_DATA_PROVIDER=mock.');
    }
  }

  const config: AppConfig = {
    dataProvider,
    supabaseUrl: dataProvider === 'supabase' ? supabaseUrl : undefined,
    supabaseAnonKey: dataProvider === 'supabase' ? supabaseAnonKey : undefined,
    isMock: dataProvider === 'mock',
    appEnv,
    appVersion,
  };

  return {
    isValid: errors.length === 0,
    config,
    errors,
    warnings,
  };
}

export const envValidation = validateEnvironment();
export const config = envValidation.config;
