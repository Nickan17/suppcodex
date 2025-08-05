import type { Meta, StoryObj } from '@storybook/react';
import { PillTab } from './PillTab';

const meta: Meta<typeof PillTab> = {
  title: 'UI/PillTab',
  component: PillTab,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Score',
    onPress: () => console.log('Tab pressed'),
  },
};

export const Selected: Story = {
  args: {
    title: 'Score',
    isSelected: true,
    onPress: () => console.log('Tab pressed'),
  },
};

export const Multiple: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <PillTab title="Score" isSelected onPress={() => {}} />
      <PillTab title="Parsed" onPress={() => {}} />
      <PillTab title="Raw" onPress={() => {}} />
      <PillTab title="Meta" onPress={() => {}} />
    </div>
  ),
};