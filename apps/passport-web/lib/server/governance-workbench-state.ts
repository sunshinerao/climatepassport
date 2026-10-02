export function beginGovernanceProjectSwitch(projectId: string) {
  return {
    selectedProjectId: projectId,
    detail: null,
    loadingDetail: projectId.length > 0,
  };
}

export function canSubmitGovernanceCommand(input: {
  selectedProjectId: string;
  requestedProjectId: string;
  commandProjectId: unknown;
  detailProjectId: string | null;
  loadingDetail: boolean;
}) {
  return input.selectedProjectId === input.requestedProjectId
    && input.commandProjectId === input.requestedProjectId
    && input.detailProjectId === input.requestedProjectId
    && !input.loadingDetail;
}