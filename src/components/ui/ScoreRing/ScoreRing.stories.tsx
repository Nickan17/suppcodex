import type { Meta, StoryObj } from '@storybook/react';
import { ScoreRing } from './ScoreRing';

const meta: Meta<typeof ScoreRing> = {
  title: 'UI/ScoreRing',
  component: ScoreRing,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
    size: {
      control: { type: 'range', min: 100, max: 300, step: 10 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 200,
    value: 95,
  },
};

export const WithLabel: Story = {
  args: {
    size: 200,
    value: 88,
    label: 'Overall Score',
  },
};

export const Small: Story = {
  args: {
    size: 120,
    value: 75,
  },
};

export const Large: Story = {
  args: {
    size: 250,
    value: 92,
    label: 'Supplement Quality',
  },
};

export const LowScore: Story = {
  args: {
    size: 200,
    value: 45,
    label: 'Needs Improvement',
  },
};