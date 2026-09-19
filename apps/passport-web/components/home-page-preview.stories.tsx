import type { Meta, StoryObj } from "@storybook/react";
import { HomePagePreview } from "./home-page-preview";

const meta: Meta<typeof HomePagePreview> = {
  title: "Pages/Home Page",
  component: HomePagePreview,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    locale: {
      control: "select",
      options: ["zh", "en"],
      description: "Language locale for the page preview",
    },
  },
};

export default meta;
type Story = StoryObj<typeof HomePagePreview>;

export const Default: Story = {
  args: {
    locale: "zh",
  },
};

export const English: Story = {
  args: {
    locale: "en",
  },
};
