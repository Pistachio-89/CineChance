import { describe, it, expect } from 'vitest';
import { calculateGenreMatchPercentage } from '../similarity';

describe('calculateGenreMatchPercentage', () => {
  it('should return 0 for empty profiles', () => {
    const result = calculateGenreMatchPercentage({}, {});
    expect(result).toBe(0);
  });

  it('should return 1 when genres perfectly match (difference = 0)', () => {
    const profileA = {
      action: 80,
      comedy: 60,
    };
    const profileB = {
      action: 80,
      comedy: 60,
    };
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(1); // 2 matching / 2 total
  });

  it('should count genres with difference <= 0.4 (40 points on 0-100) as matching', () => {
    const profileA = {
      action: 80,   // 0.8 on 0-1 scale
      comedy: 60,   // 0.6 on 0-1 scale
    };
    const profileB = {
      action: 85,   // 0.85 on 0-1 scale - diff 0.05, should match
      comedy: 30,   // 0.3 on 0-1 scale - diff 0.3, should match (<=0.4)
    };
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(1); // 2 matching / 2 total
  });

  it('should exclude genres with difference > 0.4 from matching', () => {
    const profileA = {
      action: 80,   // 0.8 on 0-1 scale
      comedy: 10,   // 0.1 on 0-1 scale
    };
    const profileB = {
      action: 85,   // 0.85 on 0-1 scale - diff 0.05, should match
      comedy: 60,   // 0.6 on 0-1 scale - diff 0.5, should NOT match (>0.4)
    };
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(0.5); // 1 matching / 2 total
  });

  it('should handle union of genres from both profiles', () => {
    const profileA = {
      action: 80,
      comedy: 60,
    };
    const profileB = {
      action: 85,
      drama: 70,  // Genre only in B
    };
    // Union: action, comedy, drama (3 genres)
    // Matches: action (diff 0.05) = 1
    // comedy in A=60 (0.6), not in B=0 (0), diff=0.6 > 0.4, no match
    // drama in A=0, in B=70 (0.7), diff=0.7 > 0.4, no match
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(1/3); // 1 matching / 3 total
  });

  it('should treat missing genre as 0', () => {
    const profileA = {
      action: 50,  // 0.5 on 0-1 scale
    };
    const profileB = {
      action: 60,  // 0.6 on 0-1 scale - diff 0.1, should match
      comedy: 50,  // 0.5 on 0-1 scale
    };
    // Union: action, comedy (2 genres)
    // action: diff 0.1, match
    // comedy: A has 0, B has 0.5, diff=0.5 > 0.4, no match
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(0.5); // 1 matching / 2 total
  });

  it('should return correct percentage for realistic scenario', () => {
    // User A prefers: action(90), sci-fi(85), comedy(40)
    // User B prefers: action(88), sci-fi(50), comedy(45)
    // action: diff 0.02, match
    // sci-fi: diff 0.35, match (<=0.4)
    // comedy: diff 0.05, match
    const profileA = {
      action: 90,
      'sci-fi': 85,
      comedy: 40,
    };
    const profileB = {
      action: 88,
      'sci-fi': 50,
      comedy: 45,
    };
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(1); // 3 matching / 3 total
  });

  it('should handle edge case: threshold boundary at exactly 0.4', () => {
    const profileA = {
      action: 80, // 0.8 on 0-1 scale
    };
    const profileB = {
      action: 40, // 0.4 on 0-1 scale - diff 0.4, exactly at threshold
    };
    const result = calculateGenreMatchPercentage(profileA, profileB);
    expect(result).toBe(1); // Should include at boundary (<=0.4)
  });
});
