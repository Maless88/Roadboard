import { describe, expect, it } from 'vitest';

import { getDemoContent } from './content';


describe('demo content integrity', () => {

  for (const locale of ['it', 'en'] as const) {

    describe(`locale=${locale}`, () => {

      const content = getDemoContent(locale);

      it('all task phaseKeys refer to defined phases', () => {
        const phaseKeys = new Set(content.phases.map((p) => p.key));

        for (const task of content.tasks) {
          expect(phaseKeys.has(task.phaseKey)).toBe(true);
        }
      });

      it('edges reference defined node keys', () => {
        const nodeKeys = new Set(content.nodes.map((n) => n.key));

        for (const edge of content.edges) {
          expect(nodeKeys.has(edge.from)).toBe(true);
          expect(nodeKeys.has(edge.to)).toBe(true);
        }
      });

      it('links reference defined nodes and existing targets', () => {
        const nodeKeys = new Set(content.nodes.map((n) => n.key));
        const taskTitles = new Set(content.tasks.map((t) => t.title));
        const decisionKeys = new Set(content.decisions.map((d) => d.key));

        for (const link of content.links) {
          expect(nodeKeys.has(link.nodeKey)).toBe(true);

          if (link.target === 'task') {
            expect(taskTitles.has(link.targetKey)).toBe(true);
          } else {
            expect(decisionKeys.has(link.targetKey)).toBe(true);
          }
        }
      });

      it('has the expected counts', () => {
        expect(content.phases).toHaveLength(3);
        expect(content.tasks).toHaveLength(6);
        expect(content.decisions).toHaveLength(2);
        expect(content.memories).toHaveLength(4);
        expect(content.nodes).toHaveLength(5);
        expect(content.edges).toHaveLength(4);
      });
    });
  }
});
