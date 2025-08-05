import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'outline'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    title: 'Primary Button',
    variant: 'primary',
  },
};

export const Outline: Story = {
  args: {
    title: 'Outline Button',
    variant: 'outline',
  },
};

export const Small: Story = {
  args: {
    title: 'Small Button',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    title: 'Large Button',
    size: 'lg',
  },
};

export const Loading: Story = {
  args: {
    title: 'Loading Button',
    isLoading: true,
  },
};

export const FullWidth: Story = {
  args: {
    title: 'Full Width Button',
    fullWidth: true,
  },
};