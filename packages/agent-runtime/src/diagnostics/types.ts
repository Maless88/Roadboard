import type { CostClass, LatencyClass, LlmCapabilities, PrivacyClass } from '../capability/contract';
import type { RegistryDeps, RegistryProviderId, RuntimeProfile } from '../registry/types';


export interface ProviderDiagnosticsModel {
  readonly id: string;
  readonly capabilities: LlmCapabilities;
  readonly costClass: CostClass;
  readonly latencyClass: LatencyClass;
}


export interface ProviderDiagnostics {
  readonly id: RegistryProviderId;
  readonly privacyClass: PrivacyClass;
  readonly modelCount: number;
  readonly models: readonly ProviderDiagnosticsModel[];
  readonly configured: true;
}


export interface DegradedFeature {
  readonly feature: string;
  readonly reason: string;
}


export interface RuntimeDiagnostics {
  readonly profile: RuntimeProfile;
  readonly providers: readonly ProviderDiagnostics[];
  readonly degradedFeatures: readonly DegradedFeature[];
  readonly summary: string;
}


export type DiagnosticsOptions = Record<string, never>;


export type ReadRuntimeDiagnosticsDeps = RegistryDeps;
