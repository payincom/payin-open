export interface OpenInitPlanOptions {
  demoData?: boolean;
  force?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface OpenInitInvocation {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export function buildOpenInitInvocation(options: OpenInitPlanOptions = {}): OpenInitInvocation {
  const sourceEnv = options.env || process.env;
  const env = {
    ...sourceEnv,
    PAYIN_RUNTIME: sourceEnv.PAYIN_RUNTIME || 'open',
  };

  delete env.INIT_DB;

  const args = ['tsx', 'scripts/init-database.ts', '--open-safe'];
  if (options.demoData) args.push('--demo-data');
  if (options.force) args.push('--force');

  return {
    command: 'npx',
    args,
    env,
  };
}
