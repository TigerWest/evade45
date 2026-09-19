// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
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
  // jsdom does not implement the native dialog lifecycle or browser top layer.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    },
    close: {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      }),
    },
  });
});

afterEach(cleanup);

test.each(['속도 기준과 게임 설정', '조작 방법 열기'])(
  '%s opens a native modal and can reopen after closing',
  async (name) => {
    render(<App />);
    const trigger = screen.getByRole('button', { name });
    fireEvent.click(trigger);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole('dialog', { name: '45초 동안 드론을 피하세요.' });
    expect(dialog).toHaveAttribute('open');

    fireEvent.click(screen.getByRole('button', { name: '설명 닫기' }));
    expect(dialog).not.toHaveAttribute('open');

    fireEvent.click(trigger);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(2);
    // Escape closes a native dialog and then emits close; React must follow it.
    act(() => (dialog as HTMLDialogElement).close());
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    fireEvent.click(trigger);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: /^닫기\s*→$/ }));
    expect(dialog).not.toHaveAttribute('open');
  },
);

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
