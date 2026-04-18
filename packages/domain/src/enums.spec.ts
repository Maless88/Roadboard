import { describe, it, expect } from 'vitest';

import {
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  GrantType,
  GrantSubjectType,
  TeamMembershipRole,
  TeamMembershipStatus,
  McpTokenStatus,
  UserStatus,
  PhaseStatus,
  MemoryEntryType,
} from './enums';


describe('ProjectStatus', () => {

  it('has the expected values', () => {
    expect(ProjectStatus.DRAFT).toBe('draft');
    expect(ProjectStatus.ACTIVE).toBe('active');
    expect(ProjectStatus.PAUSED).toBe('paused');
    expect(ProjectStatus.COMPLETED).toBe('completed');
    expect(ProjectStatus.ARCHIVED).toBe('archived');
  });
});


describe('TaskStatus', () => {

  it('has the expected values', () => {
    expect(TaskStatus.TODO).toBe('todo');
    expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
    expect(TaskStatus.DONE).toBe('done');
    expect(TaskStatus.BLOCKED).toBe('blocked');
    expect(TaskStatus.CANCELLED).toBe('cancelled');
  });
});


describe('TaskPriority', () => {

  it('has the expected values', () => {
    expect(TaskPriority.LOW).toBe('low');
    expect(TaskPriority.MEDIUM).toBe('medium');
    expect(TaskPriority.HIGH).toBe('high');
    expect(TaskPriority.CRITICAL).toBe('critical');
  });
});


describe('GrantType', () => {

  it('has the expected values', () => {
    expect(GrantType.PROJECT_READ).toBe('project.read');
    expect(GrantType.PROJECT_WRITE).toBe('project.write');
    expect(GrantType.TASK_WRITE).toBe('task.write');
    expect(GrantType.MEMORY_WRITE).toBe('memory.write');
    expect(GrantType.PROJECT_ADMIN).toBe('project.admin');
  });

  it('covers 11 grant types', () => {
    expect(Object.values(GrantType)).toHaveLength(11);
  });
});


describe('GrantSubjectType', () => {

  it('has user and team', () => {
    expect(GrantSubjectType.USER).toBe('user');
    expect(GrantSubjectType.TEAM).toBe('team');
  });
});


describe('TeamMembershipRole', () => {

  it('has member and admin', () => {
    expect(TeamMembershipRole.MEMBER).toBe('member');
    expect(TeamMembershipRole.ADMIN).toBe('admin');
  });
});


describe('TeamMembershipStatus', () => {

  it('has active and inactive', () => {
    expect(TeamMembershipStatus.ACTIVE).toBe('active');
    expect(TeamMembershipStatus.INACTIVE).toBe('inactive');
  });
});


describe('McpTokenStatus', () => {

  it('has active, revoked, expired', () => {
    expect(McpTokenStatus.ACTIVE).toBe('active');
    expect(McpTokenStatus.REVOKED).toBe('revoked');
    expect(McpTokenStatus.EXPIRED).toBe('expired');
  });
});


describe('UserStatus', () => {

  it('has active and inactive', () => {
    expect(UserStatus.ACTIVE).toBe('active');
    expect(UserStatus.INACTIVE).toBe('inactive');
  });
});


describe('PhaseStatus', () => {

  it('has the expected values', () => {
    expect(PhaseStatus.PLANNED).toBe('planned');
    expect(PhaseStatus.IN_PROGRESS).toBe('in_progress');
    expect(PhaseStatus.COMPLETED).toBe('completed');
    expect(PhaseStatus.BLOCKED).toBe('blocked');
  });
});


describe('MemoryEntryType', () => {

  it('has done and next', () => {
    expect(MemoryEntryType.DONE).toBe('done');
    expect(MemoryEntryType.NEXT).toBe('next');
  });
});
