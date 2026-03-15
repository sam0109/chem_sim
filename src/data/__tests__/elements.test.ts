import { describe, it, expect } from 'vitest';
import elements, {
  getElement,
  getElementBySymbol,
  allElementNumbers,
} from '../elements.ts';

describe('elements data', () => {
  it('contains hydrogen (Z=1)', () => {
    expect(elements[1]).toBeDefined();
    expect(elements[1].symbol).toBe('H');
    expect(elements[1].name).toBe('Hydrogen');
    expect(elements[1].mass).toBeCloseTo(1.008, 3);
  });

  it('contains carbon (Z=6)', () => {
    expect(elements[6]).toBeDefined();
    expect(elements[6].symbol).toBe('C');
    expect(elements[6].mass).toBeCloseTo(12.011, 2);
  });

  it('contains oxygen (Z=8)', () => {
    expect(elements[8]).toBeDefined();
    expect(elements[8].symbol).toBe('O');
    expect(elements[8].mass).toBeCloseTo(15.999, 2);
  });

  it('has correct covalent radius for hydrogen', () => {
    expect(elements[1].covalentRadius).toBeCloseTo(0.31, 2);
  });

  it('has valid data for all entries', () => {
    for (const [, el] of Object.entries(elements)) {
      expect(el.number).toBeGreaterThan(0);
      expect(el.symbol.length).toBeGreaterThan(0);
      expect(el.mass).toBeGreaterThan(0);
      expect(el.covalentRadius).toBeGreaterThan(0);
      expect(el.vdwRadius).toBeGreaterThan(0);
    }
  });
});

describe('getElement', () => {
  it('returns hydrogen for atomic number 1', () => {
    const el = getElement(1);
    expect(el).toBeDefined();
    expect(el!.symbol).toBe('H');
  });

  it('returns undefined for unknown atomic number', () => {
    const el = getElement(999);
    expect(el).toBeUndefined();
  });

  it('returns correct element for all valid numbers', () => {
    for (const num of allElementNumbers()) {
      const el = getElement(num);
      expect(el).toBeDefined();
      expect(el!.number).toBe(num);
    }
  });
});

describe('getElementBySymbol', () => {
  it('returns hydrogen for symbol H', () => {
    const el = getElementBySymbol('H');
    expect(el).toBeDefined();
    expect(el!.number).toBe(1);
  });

  it('returns oxygen for symbol O', () => {
    const el = getElementBySymbol('O');
    expect(el).toBeDefined();
    expect(el!.number).toBe(8);
  });

  it('returns undefined for unknown symbol', () => {
    const el = getElementBySymbol('Xx');
    expect(el).toBeUndefined();
  });
});

describe('allElementNumbers', () => {
  it('returns an array of numbers', () => {
    const nums = allElementNumbers();
    expect(Array.isArray(nums)).toBe(true);
    expect(nums.length).toBeGreaterThan(0);
    for (const n of nums) {
      expect(typeof n).toBe('number');
    }
  });

  it('includes hydrogen (1) and helium (2)', () => {
    const nums = allElementNumbers();
    expect(nums).toContain(1);
    expect(nums).toContain(2);
  });

  it('all numbers have corresponding elements', () => {
    const nums = allElementNumbers();
    for (const n of nums) {
      expect(elements[n]).toBeDefined();
    }
  });
});
