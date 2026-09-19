// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App';

vi.mock('../src/components/GameCanvas', () => ({
  GameCanvas: ({ onCanvasReady }: { onCanvasReady: (canvas: HTMLCanvasElement) => void }) => {
    const canvas = document.createElement('canvas');
    queueMicrotask(() => onCanvasReady(canvas));
    return <div data-testid="game-canvas" />;
  },
}));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi
      .fn()
      .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  Object.defineProperty(navigator, 'languages', { configurable: true, value: ['ko-KR'] });
});

test('React menu configures a run and switches locale without imperative DOM updates', async () => {
  render(<App />);
  expect(screen.getByTestId('game-canvas')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /오토바이/ }));
  expect(screen.getByRole('button', { name: /오토바이/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByLabelText('언어 선택'), { target: { value: 'en' } });
  expect(await screen.findByRole('button', { name: /Motorcycle/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(localStorage.getItem('evade45.locale')).toBe('en');
  fireEvent.click(screen.getByRole('button', { name: /^Start game/ }));
  expect(screen.getByLabelText('Game status')).toBeInTheDocument();
  expect(screen.queryByText('Choose your transport')).not.toBeInTheDocument();
});
