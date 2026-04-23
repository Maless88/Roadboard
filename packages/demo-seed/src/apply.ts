import { PrismaClient } from '@roadboard/database';
import { GrantSubjectType, GrantType } from '@roadboard/domain';

import { DemoLocale, getDemoContent } from './content';


type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];


export interface ApplyDemoSeedInput {
  userId: string;
  teamId: string;
  locale?: DemoLocale;
}


export interface ApplyDemoSeedResult {
  projectId: string;
  slug: string;
}


export async function applyDemoSeed(
  tx: PrismaTx,
  input: ApplyDemoSeedInput,
): Promise<ApplyDemoSeedResult> {

  const content = getDemoContent(input.locale ?? 'it');
  const slug = `${content.project.slugBase}-${input.userId.slice(-8)}`;

  const project = await tx.project.create({
    data: {
      name: content.project.name,
      slug,
      description: content.project.description,
      status: content.project.status,
      ownerTeamId: input.teamId,
      ownerUserId: input.userId,
    },
  });

  await tx.projectGrant.create({
    data: {
      projectId: project.id,
      subjectType: GrantSubjectType.TEAM,
      subjectId: input.teamId,
      grantType: GrantType.PROJECT_ADMIN,
      grantedByUserId: input.userId,
    },
  });

  await tx.projectGrant.create({
    data: {
      projectId: project.id,
      subjectType: GrantSubjectType.USER,
      subjectId: input.userId,
      grantType: GrantType.PROJECT_ADMIN,
      grantedByUserId: input.userId,
    },
  });

  const phaseByKey = new Map<string, string>();

  for (const phase of content.phases) {
    const created = await tx.phase.create({
      data: {
        projectId: project.id,
        title: phase.title,
        description: phase.description,
        orderIndex: phase.orderIndex,
        status: phase.status,
      },
    });
    phaseByKey.set(phase.key, created.id);
  }

  const taskByTitle = new Map<string, string>();

  for (const task of content.tasks) {
    const phaseId = phaseByKey.get(task.phaseKey);

    if (!phaseId) {
      throw new Error(`demo-seed: phaseKey "${task.phaseKey}" not found`);
    }

    const completedAt = task.status === 'done' ? new Date() : null;
    const created = await tx.task.create({
      data: {
        projectId: project.id,
        phaseId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        completedAt,
      },
    });
    taskByTitle.set(task.title, created.id);
  }

  const decisionByKey = new Map<string, string>();

  for (const decision of content.decisions) {
    const created = await tx.decision.create({
      data: {
        projectId: project.id,
        title: decision.title,
        summary: decision.summary,
        rationale: decision.rationale,
        status: decision.status,
        impactLevel: decision.impactLevel,
        outcome: decision.outcome,
        resolvedAt: decision.status === 'accepted' ? new Date() : null,
        createdByUserId: input.userId,
      },
    });
    decisionByKey.set(decision.key, created.id);
  }

  for (const memory of content.memories) {
    await tx.memoryEntry.create({
      data: {
        projectId: project.id,
        type: memory.type,
        title: memory.title,
        body: memory.body,
      },
    });
  }

  const repo = await tx.codeRepository.create({
    data: {
      projectId: project.id,
      name: 'demo',
      provider: 'manual',
      defaultBranch: 'main',
    },
  });

  const snapshot = await tx.architectureSnapshot.create({
    data: {
      projectId: project.id,
      repositoryId: repo.id,
      status: 'completed',
      scanType: 'manual',
      nodeCount: content.nodes.length,
      edgeCount: content.edges.length,
      triggeredById: input.userId,
      completedAt: new Date(),
    },
  });

  const nodeByKey = new Map<string, string>();

  for (const node of content.nodes) {
    const created = await tx.architectureNode.create({
      data: {
        projectId: project.id,
        repositoryId: repo.id,
        snapshotId: snapshot.id,
        type: node.type,
        name: node.name,
        path: node.path,
        description: node.description,
        domainGroup: node.domainGroup,
        isManual: true,
        isCurrent: true,
      },
    });
    nodeByKey.set(node.key, created.id);
  }

  for (const edge of content.edges) {
    const fromId = nodeByKey.get(edge.from);
    const toId = nodeByKey.get(edge.to);

    if (!fromId || !toId) {
      throw new Error(`demo-seed: edge references missing node "${edge.from}" or "${edge.to}"`);
    }

    await tx.architectureEdge.create({
      data: {
        projectId: project.id,
        snapshotId: snapshot.id,
        fromNodeId: fromId,
        toNodeId: toId,
        edgeType: edge.edgeType,
        isManual: true,
        isCurrent: true,
      },
    });
  }

  for (const link of content.links) {
    const nodeId = nodeByKey.get(link.nodeKey);

    if (!nodeId) {
      throw new Error(`demo-seed: link references missing node "${link.nodeKey}"`);
    }

    const entityId = link.target === 'task'
      ? taskByTitle.get(link.targetKey)
      : decisionByKey.get(link.targetKey);

    if (!entityId) {
      throw new Error(`demo-seed: link references missing ${link.target} "${link.targetKey}"`);
    }

    await tx.architectureLink.create({
      data: {
        nodeId,
        projectId: project.id,
        entityType: link.target === 'task' ? 'task' : 'decision',
        entityId,
        linkType: link.linkType,
        note: link.note,
        createdByUserId: input.userId,
      },
    });
  }

  return { projectId: project.id, slug };
}
