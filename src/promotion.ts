// ─────────────────────────────────────────────────────────
// src/promotion.ts — Promotion plans, gradual rollout, state machine
// ─────────────────────────────────────────────────────────

import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  type ActionInputs,
  type DeploymentLifecycle,
  type LifecycleTracker,
  type PromotionPlan,
  type PromotionResult,
  type PromotionStepResult,
  type ReleaseContext,
} from './types';
import * as cloudflare from './cloudflare';
import { runSmokeTest } from './smoke';
import { timestamp, sleep } from './utils';

/**
 * Create a new lifecycle tracker starting at a given state.
 */
function createLifecycleTracker(initial: DeploymentLifecycle): LifecycleTracker {
  return {
    current: initial,
    history: [{ state: initial, timestamp: timestamp() }],
  };
}

/**
 * Transition the lifecycle tracker to a new state.
 */
function transition(tracker: LifecycleTracker, state: DeploymentLifecycle): void {
  tracker.current = state;
  tracker.history.push({ state, timestamp: timestamp() });
  core.info(`    [lifecycle] ${state}`);
}

/**
 * Build a promotion plan from action inputs.
 */
export function buildPromotionPlan(inputs: ActionInputs): PromotionPlan {
  return {
    steps: inputs.rolloutSteps,
    smokeTestEnabled: !!inputs.smokeTest,
    workerName: inputs.workerName,
    environment: inputs.environment,
  };
}

/**
 * Execute the full promotion flow:
 *
 *  1. Look up current stable version (rollback target)
 *  2. Upload new version
 *  3. For each rollout step:
 *     a. Promote to the step's percentage
 *     b. Run smoke tests (if enabled)
 *     c. On failure → rollback to stable
 *  4. Return the overall result
 */
export async function executePromotion(
  inputs: ActionInputs,
  plan: PromotionPlan,
  releaseContext?: ReleaseContext,
): Promise<PromotionResult> {
  const lifecycle = createLifecycleTracker('context_resolved');
  transition(lifecycle, 'auth_ready');

  const result: PromotionResult = {
    state: 'pending',
    stepResults: [],
    startedAt: timestamp(),
    lifecycle,
  };

  try {
    // ── Step 1: Look up current stable version ──
    result.state = 'deploying';
    core.info('');
    core.info('═══════════════════════════════════════════');
    core.info('  Phase 1: Preparing Deployment');
    core.info('═══════════════════════════════════════════');

    const previousStableVersionId = await cloudflare.lookupCurrentStableVersion(inputs);
    result.previousStableVersionId = previousStableVersionId || undefined;

    // ── Step 2: Deploy / Upload ──
    if (plan.steps.length === 1 && plan.steps[0] === 100) {
      // Simple deployment — no gradual rollout needed
      core.info('');
      core.info('═══════════════════════════════════════════');
      core.info('  Phase 2: Deploying (immediate 100%)');
      core.info('═══════════════════════════════════════════');

      const deployResult = await cloudflare.deployCandidate(inputs, releaseContext);
      result.deploy = deployResult;

      if (!deployResult.success) {
        result.state = 'failed';
        result.error = `Deployment failed: ${deployResult.stderr}`;
        result.completedAt = timestamp();
        transition(lifecycle, 'failed');
        return result;
      }

      transition(lifecycle, 'candidate_deployed');

      // ── Log deployment summary ──
      logCandidateSummary(deployResult, result.previousStableVersionId);

      // Record the step result
      const stepResult: PromotionStepResult = {
        percentage: 100,
        success: true,
        message: `Deployed version ${deployResult.versionId || 'unknown'}`,
      };

      // ── Smoke test at 100% ──
      if (inputs.smokeTest) {
        result.state = 'smoke-testing';
        transition(lifecycle, 'smoke_tests_running');
        core.info('');
        core.info('═══════════════════════════════════════════');
        core.info('  Phase 3: Smoke Testing');
        core.info('═══════════════════════════════════════════');

        // Wait a moment for deployment to propagate
        core.info('⏳ Waiting 5s for deployment propagation…');
        await sleep(5000);

        const smokeResult = await runSmokeTest(inputs.smokeTest);
        stepResult.smokeTest = smokeResult;

        if (!smokeResult.passed) {
          core.error('❌ Smoke test failed — initiating rollback…');
          stepResult.success = false;
          result.stepResults.push(stepResult);

          // Rollback
          if (previousStableVersionId) {
            transition(lifecycle, 'rollback_in_progress');
            const rollbackResult = await cloudflare.rollbackToVersion(
              previousStableVersionId,
              inputs,
            );
            result.rollback = rollbackResult;
            result.state = 'rolled-back';
            transition(lifecycle, 'rolled_back');
          } else {
            core.warning('⚠️ No previous version available for rollback.');
            result.state = 'failed';
            transition(lifecycle, 'failed');
          }

          result.error = `Smoke test failed: ${smokeResult.error || 'Unexpected failure'}`;
          result.completedAt = timestamp();
          return result;
        }
      }

      result.stepResults.push(stepResult);
      result.state = 'complete';
      result.completedAt = timestamp();
      transition(lifecycle, 'promoted');
      return result;
    }

    // ── Gradual rollout ──
    core.info('');
    core.info('═══════════════════════════════════════════');
    core.info('  Phase 2: Uploading Version (Gradual Rollout)');
    core.info('═══════════════════════════════════════════');

    const newVersionId = await cloudflare.uploadVersion(inputs);
    transition(lifecycle, 'candidate_deployed');

    // Give Cloudflare a moment to register the version
    await sleep(2000);

    // ── Step 3: Gradual promotion steps ──
    for (let i = 0; i < plan.steps.length; i++) {
      const pct = plan.steps[i]!;
      result.state = 'promoting';
      transition(lifecycle, 'promotion_in_progress');
      core.info('');
      core.info('═══════════════════════════════════════════');
      core.info(`  Phase ${3 + i}: Promoting to ${pct}% (step ${i + 1}/${plan.steps.length})`);
      core.info('═══════════════════════════════════════════');

      const stepResult = await cloudflare.promoteVersion(
        newVersionId,
        pct,
        inputs,
        previousStableVersionId,
      );

      // Smoke test after each step (if enabled and not the last step,
      // or always on the last step)
      if (inputs.smokeTest) {
        result.state = 'smoke-testing';
        transition(lifecycle, 'smoke_tests_running');
        core.info('⏳ Waiting 5s for traffic shift to propagate…');
        await sleep(5000);

        const smokeResult = await runSmokeTest(inputs.smokeTest);
        stepResult.smokeTest = smokeResult;

        if (!smokeResult.passed) {
          core.error(`❌ Smoke test failed at ${pct}% — initiating rollback…`);
          stepResult.success = false;
          result.stepResults.push(stepResult);

          // Rollback
          if (previousStableVersionId) {
            transition(lifecycle, 'rollback_in_progress');
            const rollbackResult = await cloudflare.rollbackToVersion(
              previousStableVersionId,
              inputs,
            );
            result.rollback = rollbackResult;
            result.state = 'rolled-back';
            transition(lifecycle, 'rolled_back');
          } else {
            core.warning('⚠️ No previous version available for rollback.');
            result.state = 'failed';
            transition(lifecycle, 'failed');
          }

          result.error = `Smoke test failed at ${pct}%: ${smokeResult.error || 'Unexpected failure'}`;
          result.completedAt = timestamp();
          return result;
        }
      }

      if (!stepResult.success) {
        core.error(`❌ Promotion to ${pct}% failed — initiating rollback…`);
        result.stepResults.push(stepResult);

        if (previousStableVersionId) {
          transition(lifecycle, 'rollback_in_progress');
          const rollbackResult = await cloudflare.rollbackToVersion(
            previousStableVersionId,
            inputs,
          );
          result.rollback = rollbackResult;
          result.state = 'rolled-back';
          transition(lifecycle, 'rolled_back');
        } else {
          result.state = 'failed';
          transition(lifecycle, 'failed');
        }

        result.error = `Promotion failed at ${pct}%: ${stepResult.message}`;
        result.completedAt = timestamp();
        return result;
      }

      result.stepResults.push(stepResult);
      core.info(`✅ Step ${i + 1}/${plan.steps.length} complete: ${pct}%`);
    }

    result.deploy = {
      success: true,
      versionId: newVersionId,
      workerName: inputs.workerName,
      releaseTag: releaseContext?.tagName,
      sourceTrigger: github.context.eventName,
      gitSha: github.context.sha,
      gitRef: github.context.ref,
      deployedAt: timestamp(),
      stdout: '',
      stderr: '',
    };

    result.state = 'complete';
    result.completedAt = timestamp();
    transition(lifecycle, 'promoted');
    return result;
  } catch (err) {
    result.state = 'failed';
    result.error = err instanceof Error ? err.message : String(err);
    result.completedAt = timestamp();

    // Attempt emergency rollback
    if (result.previousStableVersionId) {
      core.warning('⚠️ Unexpected error — attempting emergency rollback…');
      transition(lifecycle, 'rollback_in_progress');
      try {
        const rollbackResult = await cloudflare.rollbackToVersion(
          result.previousStableVersionId,
          inputs,
        );
        result.rollback = rollbackResult;
        result.state = 'rolled-back';
        transition(lifecycle, 'rolled_back');
      } catch (rollbackErr) {
        core.error(
          `❌ Emergency rollback also failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
        );
        transition(lifecycle, 'failed');
      }
    } else {
      transition(lifecycle, 'failed');
    }

    return result;
  }
}

// ─── Internal Helpers ────────────────────────────────────

import { type DeployResult } from './types';

/**
 * Log concise deployment summary for operator visibility.
 * Appears in both CI logs and job summary.
 */
function logCandidateSummary(
  deploy: DeployResult,
  previousStableVersionId?: string,
): void {
  core.info('');
  core.info('─── Candidate Deployment Summary ──────────────');
  core.info(`  Worker:            ${deploy.workerName || '(from config)'}`);
  core.info(`  Release Tag:       ${deploy.releaseTag || '(none)'}`);
  core.info(`  Version ID:        ${deploy.versionId || '(unknown)'}`);
  core.info(`  Deployment ID:     ${deploy.deploymentId || '(unknown)'}`);
  if (deploy.stagingUrl)    core.info(`  Staging URL:       ${deploy.stagingUrl}`);
  if (deploy.productionUrl) core.info(`  Production URL:    ${deploy.productionUrl}`);
  core.info(`  Git SHA:           ${deploy.gitSha || '(unknown)'}`);
  core.info(`  Git Ref:           ${deploy.gitRef || '(unknown)'}`);
  core.info(`  Source Trigger:    ${deploy.sourceTrigger || '(unknown)'}`);
  core.info(`  Deployed At:       ${deploy.deployedAt || '(unknown)'}`);
  if (previousStableVersionId) {
    core.info(`  Previous Stable:   ${previousStableVersionId}`);
  } else {
    core.info(`  Previous Stable:   (none — first deployment)`);
  }
  core.info('─────────────────────────────────────────────');
  core.info('');
}
