import {
  ArchitectureEdgeType,
  ArchitectureEntityType,
  ArchitectureNodeLinkType,
  ArchitectureNodeType,
  MemoryEntryType,
  PhaseStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from '@roadboard/domain';


export type DemoLocale = 'it' | 'en';

export type DecisionStatusLiteral = 'open' | 'accepted' | 'rejected' | 'superseded';

export type ImpactLevelLiteral = 'low' | 'medium' | 'high';


export interface DemoPhaseTemplate {
  key: string;
  title: string;
  description: string;
  orderIndex: number;
  status: PhaseStatus;
}


export interface DemoTaskTemplate {
  phaseKey: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
}


export interface DemoDecisionTemplate {
  key: string;
  title: string;
  summary: string;
  rationale: string;
  status: DecisionStatusLiteral;
  impactLevel: ImpactLevelLiteral;
  outcome?: string;
}


export interface DemoMemoryTemplate {
  type: MemoryEntryType;
  title: string;
  body: string;
}


export interface DemoNodeTemplate {
  key: string;
  name: string;
  type: ArchitectureNodeType;
  path?: string;
  description: string;
  domainGroup: string;
}


export interface DemoEdgeTemplate {
  from: string;
  to: string;
  edgeType: ArchitectureEdgeType;
}


export interface DemoLinkTemplate {
  nodeKey: string;
  target: 'task' | 'decision';
  targetKey: string;
  linkType: ArchitectureNodeLinkType;
  note: string;
}


export interface DemoContent {
  project: {
    name: string;
    slugBase: string;
    description: string;
    status: ProjectStatus;
  };
  phases: DemoPhaseTemplate[];
  tasks: DemoTaskTemplate[];
  decisions: DemoDecisionTemplate[];
  memories: DemoMemoryTemplate[];
  nodes: DemoNodeTemplate[];
  edges: DemoEdgeTemplate[];
  links: DemoLinkTemplate[];
}


const itContent: DemoContent = {
  project: {
    name: 'Tour Roadboard',
    slugBase: 'tour-roadboard',
    description: 'Progetto di esempio generato alla registrazione. Esplora tasks, decisioni, memoria e la mappa Atlas per capire come funziona Roadboard.',
    status: ProjectStatus.ACTIVE,
  },
  phases: [
    { key: 'onboarding', title: 'Onboarding', description: 'Setup iniziale e familiarizzazione con gli strumenti.', orderIndex: 0, status: PhaseStatus.COMPLETED },
    { key: 'sviluppo', title: 'Sviluppo', description: 'Implementazione della funzionalità core.', orderIndex: 1, status: PhaseStatus.IN_PROGRESS },
    { key: 'release', title: 'Release', description: 'Rilascio e monitoraggio in produzione.', orderIndex: 2, status: PhaseStatus.PLANNED },
  ],
  tasks: [
    { phaseKey: 'onboarding', title: 'Configurare ambiente di sviluppo', description: 'Clona il repo, installa dipendenze, avvia i container Docker.', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM },
    { phaseKey: 'onboarding', title: 'Creare il primo progetto', description: 'Hai finito l’onboarding — ora puoi creare un tuo progetto dalla dashboard.', status: TaskStatus.DONE, priority: TaskPriority.LOW },
    { phaseKey: 'sviluppo', title: 'Implementare la feature X', description: 'Task principale in corso. Sblocca la phase di release.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH },
    { phaseKey: 'sviluppo', title: 'Scrivere test integration', description: 'Copertura end-to-end delle API critiche.', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM },
    { phaseKey: 'sviluppo', title: 'Aspettare review di sicurezza', description: 'Bloccato in attesa del team security.', status: TaskStatus.BLOCKED, priority: TaskPriority.HIGH },
    { phaseKey: 'release', title: 'Deploy in staging', description: 'Prima verifica manuale in staging prima del rollout in prod.', status: TaskStatus.TODO, priority: TaskPriority.CRITICAL },
  ],
  decisions: [
    { key: 'db-choice', title: 'PostgreSQL come database principale', summary: 'Usiamo PostgreSQL 16 come store primario di tutti i dati applicativi.', rationale: 'Supporto maturo per JSON, transazioni forti, esperienza del team, ottimo ecosistema di tooling.', status: 'accepted', impactLevel: 'high', outcome: 'Decisione applicata, team produttivo dopo 2 settimane.' },
    { key: 'auth-strategy', title: 'Session token vs JWT', summary: 'Valutare se passare da session token stateful a JWT stateless per ridurre la latenza delle API.', rationale: 'JWT eliminerebbero lookup sul DB, ma perderemmo invalidation immediata e dovremmo gestire rotation più complessa.', status: 'open', impactLevel: 'medium' },
  ],
  memories: [
    { type: MemoryEntryType.LEARNING, title: 'Prisma migrate vs db push', body: 'In team usiamo sempre `migrate dev` — `db push` salta la history e rende impossibile il rollback pulito.' },
    { type: MemoryEntryType.ARCHITECTURE, title: 'Topologia servizi Roadboard', body: 'core-api gestisce dominio (project/task/memory), auth-access gestisce identità e sessioni, mcp-service espone 17 tool agli agenti AI.' },
    { type: MemoryEntryType.OPERATIONAL_NOTE, title: 'Redis volatile', body: 'I dati su Redis (code BullMQ, cache) non sono persistenti. Ogni restart azzera le code in attesa — non salvare nulla di critico solo lì.' },
    { type: MemoryEntryType.OPEN_QUESTION, title: 'Rate limit sugli endpoint pubblici?', body: 'Al momento non c’ un rate limit sul login. Valutare se mettere express-rate-limit o passare dietro un reverse proxy che lo gestisca.' },
  ],
  nodes: [
    { key: 'web-app', name: 'web-app', type: ArchitectureNodeType.APP, path: 'apps/web-app', description: 'Frontend Next.js 15', domainGroup: 'frontend' },
    { key: 'core-api', name: 'core-api', type: ArchitectureNodeType.APP, path: 'apps/core-api', description: 'NestJS API progetti/task/memory', domainGroup: 'backend' },
    { key: 'auth-access', name: 'auth-access', type: ArchitectureNodeType.APP, path: 'apps/auth-access', description: 'NestJS auth + sessioni', domainGroup: 'backend' },
    { key: 'domain', name: 'domain', type: ArchitectureNodeType.PACKAGE, path: 'packages/domain', description: 'Enum e tipi di dominio condivisi', domainGroup: 'shared' },
    { key: 'redis', name: 'redis', type: ArchitectureNodeType.SERVICE, description: 'Redis 7 per BullMQ e cache', domainGroup: 'infra' },
  ],
  edges: [
    { from: 'web-app', to: 'core-api', edgeType: ArchitectureEdgeType.DEPENDS_ON },
    { from: 'web-app', to: 'auth-access', edgeType: ArchitectureEdgeType.DEPENDS_ON },
    { from: 'core-api', to: 'domain', edgeType: ArchitectureEdgeType.DEPENDS_ON },
    { from: 'auth-access', to: 'redis', edgeType: ArchitectureEdgeType.DEPENDS_ON },
  ],
  links: [
    { nodeKey: 'core-api', target: 'task', targetKey: 'Implementare la feature X', linkType: ArchitectureNodeLinkType.MODIFIES, note: 'La feature X tocca principalmente core-api.' },
    { nodeKey: 'core-api', target: 'decision', targetKey: 'db-choice', linkType: ArchitectureNodeLinkType.ADDRESSES, note: 'core-api consuma direttamente PostgreSQL.' },
  ],
};


const enContent: DemoContent = {
  project: {
    name: 'Tour Roadboard',
    slugBase: 'tour-roadboard',
    description: 'Demo project created at sign-up. Browse tasks, decisions, memory and the Atlas map to see how Roadboard works.',
    status: ProjectStatus.ACTIVE,
  },
  phases: [
    { key: 'onboarding', title: 'Onboarding', description: 'Initial setup and familiarization with the tools.', orderIndex: 0, status: PhaseStatus.COMPLETED },
    { key: 'sviluppo', title: 'Development', description: 'Core feature implementation.', orderIndex: 1, status: PhaseStatus.IN_PROGRESS },
    { key: 'release', title: 'Release', description: 'Ship to production and monitor.', orderIndex: 2, status: PhaseStatus.PLANNED },
  ],
  tasks: [
    { phaseKey: 'onboarding', title: 'Set up development environment', description: 'Clone the repo, install dependencies, start Docker containers.', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM },
    { phaseKey: 'onboarding', title: 'Create your first project', description: 'Onboarding complete — you can now create a project from the dashboard.', status: TaskStatus.DONE, priority: TaskPriority.LOW },
    { phaseKey: 'sviluppo', title: 'Build feature X', description: 'Main task in progress. Unblocks the release phase.', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH },
    { phaseKey: 'sviluppo', title: 'Write integration tests', description: 'End-to-end coverage for critical APIs.', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM },
    { phaseKey: 'sviluppo', title: 'Wait for security review', description: 'Blocked waiting on security team.', status: TaskStatus.BLOCKED, priority: TaskPriority.HIGH },
    { phaseKey: 'release', title: 'Deploy to staging', description: 'Manual QA pass on staging before production rollout.', status: TaskStatus.TODO, priority: TaskPriority.CRITICAL },
  ],
  decisions: [
    { key: 'db-choice', title: 'PostgreSQL as primary database', summary: 'We use PostgreSQL 16 as the primary store for all application data.', rationale: 'Mature JSON support, strong transactions, team familiarity, excellent tooling ecosystem.', status: 'accepted', impactLevel: 'high', outcome: 'Decision applied, team productive within 2 weeks.' },
    { key: 'auth-strategy', title: 'Session token vs JWT', summary: 'Evaluating whether to move from stateful session tokens to stateless JWT to reduce API latency.', rationale: 'JWT would avoid DB lookups but we would lose instant invalidation and need to manage rotation.', status: 'open', impactLevel: 'medium' },
  ],
  memories: [
    { type: MemoryEntryType.LEARNING, title: 'Prisma migrate vs db push', body: 'We always use `migrate dev` — `db push` skips the history and makes clean rollbacks impossible.' },
    { type: MemoryEntryType.ARCHITECTURE, title: 'Roadboard service topology', body: 'core-api owns the domain (project/task/memory), auth-access owns identity and sessions, mcp-service exposes 17 tools to AI agents.' },
    { type: MemoryEntryType.OPERATIONAL_NOTE, title: 'Redis is volatile', body: 'Data on Redis (BullMQ queues, cache) is not persistent. Every restart wipes queued jobs — do not store anything critical only there.' },
    { type: MemoryEntryType.OPEN_QUESTION, title: 'Rate limit on public endpoints?', body: 'No rate limit on login today. Consider express-rate-limit or a reverse proxy that handles it.' },
  ],
  nodes: [
    { key: 'web-app', name: 'web-app', type: ArchitectureNodeType.APP, path: 'apps/web-app', description: 'Next.js 15 frontend', domainGroup: 'frontend' },
    { key: 'core-api', name: 'core-api', type: ArchitectureNodeType.APP, path: 'apps/core-api', description: 'NestJS API for projects/tasks/memory', domainGroup: 'backend' },
    { key: 'auth-access', name: 'auth-access', type: ArchitectureNodeType.APP, path: 'apps/auth-access', description: 'NestJS auth + sessions', domainGroup: 'backend' },
    { key: 'domain', name: 'domain', type: ArchitectureNodeType.PACKAGE, path: 'packages/domain', description: 'Shared domain enums and types', domainGroup: 'shared' },
    { key: 'redis', name: 'redis', type: ArchitectureNodeType.SERVICE, description: 'Redis 7 for BullMQ and cache', domainGroup: 'infra' },
  ],
  edges: [
    { from: 'web-app', to: 'core-api', edgeType: ArchitectureEdgeType.DEPENDS_ON },
    { from: 'web-app', to: 'auth-access', edgeType: ArchitectureEdgeType.DEPENDS_ON },
    { from: 'core-api', to: 'domain', edgeType: ArchitectureEdgeType.DEPENDS_ON },
    { from: 'auth-access', to: 'redis', edgeType: ArchitectureEdgeType.DEPENDS_ON },
  ],
  links: [
    { nodeKey: 'core-api', target: 'task', targetKey: 'Build feature X', linkType: ArchitectureNodeLinkType.MODIFIES, note: 'Feature X primarily touches core-api.' },
    { nodeKey: 'core-api', target: 'decision', targetKey: 'db-choice', linkType: ArchitectureNodeLinkType.ADDRESSES, note: 'core-api talks to PostgreSQL directly.' },
  ],
};


export function getDemoContent(locale: DemoLocale = 'it'): DemoContent {

  return locale === 'en' ? enContent : itContent;
}


export { ArchitectureEntityType };
