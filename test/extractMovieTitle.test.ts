import { describe, it, expect } from 'vitest';
import { extractMovieTitle } from '../lib/extractMovieTitle';

describe('extractMovieTitle', () => {
  it('extracts from Japanese quotes', () => {
    expect(extractMovieTitle('今日は「君の名は。」を観た')).toBe('君の名は。');
  });

  it('extracts from parentheses', () => {
    expect(extractMovieTitle('（スター・ウォーズ）最高だった')).toBe('スター・ウォーズ');
  });

  it('returns null for unrelated comment', () => {
    expect(extractMovieTitle('友達と飲み会')).toBeNull();
  });
});
