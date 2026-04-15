export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum PhaseStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
}

export enum MilestoneStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  MISSED = 'missed',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum MemoryEntryType {
  DONE = 'done',
  NEXT = 'next',
  DECISION = 'decision',
  HANDOFF = 'handoff',
  ARCHITECTURE = 'architecture',
  ISSUE = 'issue',
  LEARNING = 'learning',
  OPERATIONAL_NOTE = 'operational_note',
  OPEN_QUESTION = 'open_question',
}

export enum GrantType {
  PROJECT_READ = 'project.read',
  PROJECT_WRITE = 'project.write',
  TASK_WRITE = 'task.write',
  MEMORY_WRITE = 'memory.write',
  DECISION_WRITE = 'decision.write',
  DASHBOARD_READ = 'dashboard.read',
  TOKEN_MANAGE = 'token.manage',
  PROJECT_ADMIN = 'project.admin',
  CODEFLOW_READ = 'codeflow.read',
  CODEFLOW_WRITE = 'codeflow.write',
  CODEFLOW_SCAN = 'codeflow.scan',
}

export enum GrantSubjectType {
  USER = 'user',
  TEAM = 'team',
}

export enum TeamMembershipRole {
  MEMBER = 'member',
  ADMIN = 'admin',
}

export enum TeamMembershipStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum McpTokenStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}


export enum ArchitectureNodeType {
  REPOSITORY = 'repository',
  APP = 'app',
  PACKAGE = 'package',
  MODULE = 'module',
  SERVICE = 'service',
  FILE = 'file',
}


export enum ArchitectureEdgeType {
  CONTAINS = 'contains',
  DEPENDS_ON = 'depends_on',
  IMPORTS = 'imports',
  OWNS = 'owns',
  RELATES_TO = 'relates_to',
}


export enum ArchitectureNodeLinkType {
  IMPLEMENTS = 'implements',
  MODIFIES = 'modifies',
  FIXES = 'fixes',
  ADDRESSES = 'addresses',
  MOTIVATES = 'motivates',
  CONSTRAINS = 'constrains',
  DELIVERS = 'delivers',
  DESCRIBES = 'describes',
  WARNS_ABOUT = 'warns_about',
}


export enum ArchitectureEntityType {
  TASK = 'task',
  DECISION = 'decision',
  MILESTONE = 'milestone',
  MEMORY_ENTRY = 'memory_entry',
}


export enum CodeRepositoryProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  LOCAL = 'local',
  MANUAL = 'manual',
}


export enum ArchitectureScanStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum UserRole {
  ADMIN = 'admin',
  TEAM_LEADER = 'team_leader',
  DEVELOPER = 'developer',
  GUEST = 'guest',
}
