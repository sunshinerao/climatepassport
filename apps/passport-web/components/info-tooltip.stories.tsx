import type { Meta, StoryObj } from "@storybook/react";
import { FieldLabelWithInfo, InfoTooltip } from "./info-tooltip";

const meta: Meta<typeof InfoTooltip> = {
  title: "Components/InfoTooltip",
  component: InfoTooltip,
  tags: ["autodocs"],
  argTypes: {
    tooltip: {
      control: "text",
      description: "The tooltip text shown on hover / focus",
    },
  },
};

export default meta;
type Story = StoryObj<typeof InfoTooltip>;

export const Default: Story = {
  args: {
    tooltip: "This is a helpful tooltip that explains something to the user.",
  },
};

export const LongContent: Story = {
  args: {
    tooltip:
      "This tooltip contains a longer explanation. It demonstrates how the component handles multi-line content and stays readable even when the message is more detailed.",
  },
};

export const WithFieldLabel: StoryObj<typeof FieldLabelWithInfo> = {
  render: (args) => (
    <label className="field">
      <FieldLabelWithInfo label={args.label} tooltip={args.tooltip} />
      <input type="text" placeholder="Focus the icon above to see the tooltip" />
    </label>
  ),
  args: {
    label: "Email address",
    tooltip: "We will never share your email with third parties.",
  },
};
