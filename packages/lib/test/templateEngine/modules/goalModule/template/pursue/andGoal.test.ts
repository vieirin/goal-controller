import * as assert from 'assert';
import { describe, it } from 'mocha';
import { splitSequence } from '../../../../../../src/templateEngine/modules/goalModule/template/pursue/andGoal';

describe('splitSequence', () => {
  describe('basic functionality', () => {
    it('should split sequence at G10 correctly', () => {
      const sequence = ['G10', 'G11', 'G12'];
      const childId = 'G10';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [[], ['G11', 'G12']]);
    });

    it('should split sequence at G11 correctly', () => {
      const sequence = ['G10', 'G11', 'G12'];
      const childId = 'G11';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [['G10'], ['G12']]);
    });

    it('should split sequence at G12 correctly', () => {
      const sequence = ['G10', 'G11', 'G12'];
      const childId = 'G12';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [['G10', 'G11'], []]);
    });
  });

  describe('edge cases', () => {
    it('should handle single element sequence', () => {
      const sequence = ['G10'];
      const childId = 'G10';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [[], []]);
    });

    it('should handle two element sequence - first element', () => {
      const sequence = ['G10', 'G11'];
      const childId = 'G10';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [[], ['G11']]);
    });

    it('should handle two element sequence - second element', () => {
      const sequence = ['G10', 'G11'];
      const childId = 'G11';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [['G10'], []]);
    });

    it('should handle non-existent childId', () => {
      const sequence = ['G10', 'G11', 'G12'];
      const childId = 'G99';

      assert.throws(
        () => splitSequence(sequence, childId),
        new Error(
          `Child ID ${childId} not found in sequence ${sequence.join(', ')}`,
        ),
      );
    });

    it('should handle empty sequence', () => {
      const sequence: string[] = [];
      const childId = 'G10';

      assert.throws(
        () => splitSequence(sequence, childId),
        new Error(
          `Child ID ${childId} not found in sequence ${sequence.join(', ')}`,
        ),
      );
    });

    it('should handle duplicate elements in sequence', () => {
      const sequence = ['G10', 'G11', 'G10', 'G12'];
      const childId = 'G10';
      const result = splitSequence(sequence, childId);

      // indexOf returns the first occurrence
      assert.deepStrictEqual(result, [[], ['G11', 'G10', 'G12']]);
    });
  });

  describe('longer sequences', () => {
    it('should handle 5 element sequence - middle element', () => {
      const sequence = ['G1', 'G2', 'G3', 'G4', 'G5'];
      const childId = 'G3';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [
        ['G1', 'G2'],
        ['G4', 'G5'],
      ]);
    });

    it('should handle 5 element sequence - first element', () => {
      const sequence = ['G1', 'G2', 'G3', 'G4', 'G5'];
      const childId = 'G1';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [[], ['G2', 'G3', 'G4', 'G5']]);
    });

    it('should handle 5 element sequence - last element', () => {
      const sequence = ['G1', 'G2', 'G3', 'G4', 'G5'];
      const childId = 'G5';
      const result = splitSequence(sequence, childId);

      assert.deepStrictEqual(result, [['G1', 'G2', 'G3', 'G4'], []]);
    });
  });
});
