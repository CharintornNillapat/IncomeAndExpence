import { describe, it, expect } from 'vitest';
import { evaluateAmountInput, safeEvaluateMath } from '../src/utils/mathEvaluator';
import { parseExpressInput } from '../src/utils/expressInput';

/**
 * Phase 105 (ADR 0081): the amount field's arithmetic is the app's own parser,
 * not mathjs. Every value below is what `mathjs/number` returned for the same
 * text, so these pin that nothing a person can type with the operator keys
 * changed; `%` and `^` are the deliberate exceptions.
 */

const value = (text: string) => safeEvaluateMath(text).value;
const error = (text: string) => safeEvaluateMath(text).error;

describe('safeEvaluateMath: the arithmetic mathjs did', () => {
  it.each([
    ['60', 60],
    ['  4 ', 4],
    ['120/4 + 15*2', 60],
    ['500+500', 1000],
    ['1200*0.8', 960],
    ['100 / 3', 33.33],
    ['10-4-3', 3],
    ['100/10/5', 2],
    ['2+3*4', 14],
    ['(2+3)*4', 20],
    ['(((1)))', 1],
    ['.5', 0.5],
    ['5.', 5],
    ['010', 10],
    ['0005.50', 5.5],
    ['-5+10', 5],
    ['--5', 5],
    ['+-5', -5],
    ['3--2', 5],
    ['5-+-+3', 8],
    ['2*-3', -6],
    ['4/-2', -2],
    ['-(-(3))', 3],
    ['0.1+0.2', 0.3],
    ['16.775', 16.78],
    ['1/3*3', 1],
  ])('%j is %j', (text, expected) => {
    expect(value(text)).toBe(expected);
  });

  it.each([
    ['2(3)', 6],
    ['(1+2)(3)', 9],
    ['2 (3)', 6],
    ['2.(3)', 6],
    ['2(3)(4)', 24],
    ['2(3)/6', 1],
    ['1-2(3)', -5],
    ['-2(3)', -6],
  ])('a bracket after a number or a bracket multiplies, as mathjs did: %j is %j', (text, expected) => {
    expect(value(text)).toBe(expected);
  });

  // mathjs's figures, left to right: 6, 24, 9, 1, 0.07, and refused for "+(4)8".
  // Its grouping of an unwritten product is its own, so these are refused
  // rather than given a different figure (ADR 0081).
  it.each(['(2)3', '2(3)4', '6/2(3)', '6/(2)(3)', '26/(53)7', '+(4)8'])('%j, an unwritten product mathjs grouped its own way, is refused', (text) => {
    expect(error(text)).toBe('Incomplete or malformed math expression');
  });

  it('formats to two decimals, through the same half-cent rounding', () => {
    expect(safeEvaluateMath('16.775')).toEqual({ isValid: true, value: 16.78, formattedValue: '16.78' });
    expect(safeEvaluateMath('100/3').formattedValue).toBe('33.33');
  });

  it.each(['2 3', '1.2.3', '1..2', '100.5.', '12 . 5', '1 000', '()', '( )', '(1+2', '1+2)', '2*(3', '.', '.(2)', '-', '+', '*5', '5*', '5/'])(
    '%j is malformed',
    (text) => {
      expect(safeEvaluateMath(text)).toEqual({
        isValid: false,
        value: null,
        formattedValue: '',
        error: 'Incomplete or malformed math expression',
      });
    },
  );

  it.each(['1/0', '0/0', '-1/0', '1/(5-5)'])('%j is not a number', (text) => {
    expect(error(text)).toBe('Calculation did not produce a valid number');
  });

  it.each(['', '   '])('%j is empty', (text) => {
    expect(error(text)).toBe('Empty expression');
  });

  it.each(['abc', '1,000', '1e3', 'constructor', 'alert(1)', '[1]', '1;2', 'x=1', '฿60'])(
    '%j holds a character the field does not accept',
    (text) => {
      expect(error(text)).toBe('Invalid characters in calculation');
    },
  );

  it('survives brackets nested past any stack', () => {
    expect(error('('.repeat(100_000) + '1' + ')'.repeat(100_000))).toBe('Incomplete or malformed math expression');
  });
});

describe('safeEvaluateMath: percent and power are gone (ADR 0081)', () => {
  // mathjs read `%` as percent or as modulo by position ("5%+5%" was 0,
  // "100%-5" was 0, "4/2%" was 200), and no operator key offers `%` or `^`.
  it.each(['50%', '100+10%', '10%3', '5%+5%', '2^3', '2^-1'])('%j is refused', (text) => {
    expect(error(text)).toBe('Invalid characters in calculation');
  });

  it('the amount field says so instead of waiting for more input', () => {
    expect(evaluateAmountInput('50%')).toEqual({
      amount: null,
      formattedValue: '',
      hasCalculation: false,
      error: 'Invalid characters in calculation',
    });
    expect(evaluateAmountInput('2^').error).toBe('Invalid characters in calculation');
  });

  it('a note keeps its percent as words and finds the amount after it', () => {
    // mathjs read "10% 60" as 10 mod 60, so this note seeded ฿10.
    expect(parseExpressInput('ส่วนลด 10% 60')).toEqual({ amountExpression: '60', amount: 60, cleanDescription: 'ส่วนลด 10%' });
    expect(parseExpressInput('tip 2^3').amount).toBeNull();
  });
});
