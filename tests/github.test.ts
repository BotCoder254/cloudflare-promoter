import { describe, expect, it } from 'vitest';
import { mergeReleaseBody, renderDeploymentMarkdown } from '../src/github';
import { type ReleaseNotesSection } from '../src/types';

const baseSection: ReleaseNotesSection = {
  workerName: 'my-worker',
  releaseTag: 'v1.0.0',
  releaseId: 12345,
  deploymentId: 'dep-abc',
  versionId: 'ver-abc',
  candidateVersionId: 'ver-abc',
  stagingUrl: 'https://my-worker.my-subdomain.workers.dev',
  productionUrl: 'https://api.example.com',
  url: 'https://api.example.com',
  smokeTestPassed: true,
  smokeTestStatus: 'passed',
  promotionResult: 'success',
  promotionStrategy: 'gradual',
  promotionStatus: 'success',
  rollbackTriggered: false,
  rollbackInformation: 'Not triggered',
  timestamp: '2026-03-18T00:00:00.000Z',
  environment: 'production',
  workflowRunUrl: 'https://github.com/BotCoder254/cloudflare-promoter/actions/runs/1',
};

describe('renderDeploymentMarkdown', () => {
  it('renders required deployment fields', () => {
    const markdown = renderDeploymentMarkdown(baseSection, 'Workers Production Promotion');

    expect(markdown).toContain('## Workers Production Promotion');
    expect(markdown).toContain('| Worker name | `my-worker` |');
    expect(markdown).toContain('| Release tag | `v1.0.0` |');
    expect(markdown).toContain('| Release ID | `12345` |');
    expect(markdown).toContain('| Candidate version ID | `ver-abc` |');
    expect(markdown).toContain('| Deployment ID | `dep-abc` |');
    expect(markdown).toContain('| Promotion strategy | `gradual` |');
    expect(markdown).toContain('| Smoke test result | `passed` |');
    expect(markdown).toContain('| Promotion result | `success` |');
    expect(markdown).toContain('| Rollback information | Not triggered |');
  });
});

describe('mergeReleaseBody', () => {
  it('appends sections when mode is append', () => {
    const merged = mergeReleaseBody(
      'Existing release notes',
      '## Workers Production Promotion\n\nNew deployment block',
      'append',
      'Workers Production Promotion',
    );

    expect(merged).toContain('Existing release notes');
    expect(merged).toContain('## Workers Production Promotion');
    expect(merged).toContain('New deployment block');
  });

  it('replaces the same section when mode is replace-section', () => {
    const heading = 'Workers Production Promotion';
    const first = mergeReleaseBody(
      'Initial body',
      '## Workers Production Promotion\n\nfirst block',
      'replace-section',
      heading,
    );

    const second = mergeReleaseBody(
      first,
      '## Workers Production Promotion\n\nsecond block',
      'replace-section',
      heading,
    );

    expect(second).toContain('second block');
    expect(second).not.toContain('first block');
    expect(second.match(/workers-release-promoter:workers-production-promotion:start/g)).toHaveLength(1);
  });

  it('migrates legacy markers to heading-scoped markers', () => {
    const legacyBody = [
      'Before',
      '<!-- workers-release-promoter -->',
      'old section',
      '<!-- /workers-release-promoter -->',
      'After',
    ].join('\n');

    const merged = mergeReleaseBody(
      legacyBody,
      '## Workers Production Promotion\n\nnew section',
      'replace-section',
      'Workers Production Promotion',
    );

    expect(merged).toContain('new section');
    expect(merged).not.toContain('old section');
    expect(merged).toContain('workers-release-promoter:workers-production-promotion:start');
    expect(merged).toContain('workers-release-promoter:workers-production-promotion:end');
  });
});
