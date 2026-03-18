import { type ReleaseNotesSection, type PromotionResult } from './types';
export interface ReleaseNotesContext {
    environment: string;
    promotionStrategy: string;
    rolloutSteps?: number[];
    releaseTag?: string;
    releaseId?: number;
    workerName?: string;
    workflowRunUrl?: string;
}
/**
 * Build a ReleaseNotesSection from a PromotionResult and deployment context.
 */
export declare function buildReleaseNotesSection(result: PromotionResult, context: ReleaseNotesContext): ReleaseNotesSection;
/**
 * Build the deployment summary markdown for the GitHub Actions job summary.
 */
export declare function buildJobSummary(result: PromotionResult, environment: string, tagName?: string, strategy?: string): string;
