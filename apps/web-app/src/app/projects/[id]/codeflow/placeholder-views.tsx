import type { Dictionary } from '@/lib/i18n';
import { EmptyState } from './empty-state';


export function ChangeImpactView({ dict }: { dict: Dictionary }) {

  return (
    <EmptyState
      badge={dict.codeflow.comingSoon}
      title={dict.codeflow.subNav.impact}
      hint={dict.codeflow.impactComingSoon}
    />
  );
}


export function DecisionGraphView({ dict }: { dict: Dictionary }) {

  return (
    <EmptyState
      badge={dict.codeflow.comingSoon}
      title={dict.codeflow.subNav.decisionGraph}
      hint={dict.codeflow.decisionGraphComingSoon}
    />
  );
}


export function AgentContextView({ dict }: { dict: Dictionary }) {

  return (
    <EmptyState
      badge={dict.codeflow.comingSoon}
      title={dict.codeflow.subNav.agentContext}
      hint={dict.codeflow.agentContextComingSoon}
    />
  );
}
