import type { Meta, StoryObj } from "@storybook/react";
import { DataActionCard, ConfirmDangerAction, StatusPill } from "@climate-passport/passport-ui-flows";

const meta: Meta = {
  title: "CP UI Flows/Data Governance",
  parameters: { layout: "padded" },
};
export default meta;

export const Cards: StoryObj = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <DataActionCard title="Export my data" description="Download a copy of materials you are authorized to access.">
        <button type="button">Download data copy</button>
      </DataActionCard>
      <DataActionCard tone="danger" title="Delete account" description="Deletion is separate from export and withdrawal.">
        <ConfirmDangerAction
          label="Permanently delete account"
          confirmLabel="Type DELETE to confirm"
          confirmValue="DELETE"
          confirmationHint="This cannot be undone."
          successMessage="Your account has been deleted."
          onConfirm={() => ({ retentionNotice: ["Audit logs (restricted retention)"] })}
        />
      </DataActionCard>
    </div>
  ),
};

export const Pills: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      <StatusPill tone="success">ACTIVE</StatusPill>
      <StatusPill tone="warning">PENDING</StatusPill>
      <StatusPill tone="danger">REVOKED</StatusPill>
      <StatusPill>WITHDRAWN</StatusPill>
    </div>
  ),
};
