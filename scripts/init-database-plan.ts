export interface InitDatabasePlanOptions {
  force?: boolean;
  openSafe?: boolean;
}

export interface InitModulePlan {
  mode: 'schema-only' | 'legacy-force-reset';
  dropExisting: boolean;
  createsDefaultAdmin: boolean;
}

export interface ProcessorInitPlan {
  dropExisting: boolean;
  onlyMissing: boolean;
  force: boolean;
  ensuresDefaultOpenMerchant: boolean;
}

export interface InitDatabasePlan {
  auth: InitModulePlan;
  manager: InitModulePlan;
  processor: ProcessorInitPlan;
}

export function buildInitDatabasePlan(options: InitDatabasePlanOptions = {}): InitDatabasePlan {
  const force = Boolean(options.force);
  const openSafe = Boolean(options.openSafe);
  const useSafeModuleInit = openSafe || !force;

  return {
    auth: {
      mode: useSafeModuleInit ? 'schema-only' : 'legacy-force-reset',
      dropExisting: force,
      createsDefaultAdmin: !useSafeModuleInit,
    },
    manager: {
      mode: useSafeModuleInit ? 'schema-only' : 'legacy-force-reset',
      dropExisting: force,
      createsDefaultAdmin: false,
    },
    processor: {
      dropExisting: force,
      onlyMissing: !force,
      force,
      ensuresDefaultOpenMerchant: true,
    },
  };
}
