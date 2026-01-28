import * as assert from 'assert';
import { describe, it } from 'mocha';
import { generateFluents } from '../../src/sleecTemplateEngine/fluents';
import type { Task } from '@goal-controller/goal-tree';

/**
 * Helper to create a minimal Task node with only the properties needed for testing
 */
const createTaskNode = (id: string, name: string): Task =>
  ({
    id,
    name,
    type: 'task',
    properties: {},
  }) as Task;

describe('sleecTemplateEngine', () => {
  describe('generateFluents', () => {
    it('should generate fluent definition for a single task', () => {
      const tasks = [createTaskNode('T1', 'Inform Purpose and Protocol')];

      const fluents = generateFluents(tasks);

      assert.strictEqual(fluents.length, 1);
      assert.strictEqual(
        fluents[0],
        '    fluent InformPurposeandProtocol <{StartInformPurposeandProtocol}, {AchievedInformPurposeandProtocol}>',
      );
    });

    it('should generate fluent definitions for multiple tasks', () => {
      const tasks = [
        createTaskNode('T1', 'Inform Purpose and Protocol'),
        createTaskNode('T2', 'Obtain Consent Full Tracking'),
        createTaskNode('T3', 'Obtain Consent Partial Tracking'),
      ];

      const fluents = generateFluents(tasks);

      assert.strictEqual(fluents.length, 3);
      assert.strictEqual(
        fluents[0],
        '    fluent InformPurposeandProtocol <{StartInformPurposeandProtocol}, {AchievedInformPurposeandProtocol}>',
      );
      assert.strictEqual(
        fluents[1],
        '    fluent ObtainConsentFullTracking <{StartObtainConsentFullTracking}, {AchievedObtainConsentFullTracking}>',
      );
      assert.strictEqual(
        fluents[2],
        '    fluent ObtainConsentPartialTracking <{StartObtainConsentPartialTracking}, {AchievedObtainConsentPartialTracking}>',
      );
    });

    it('should remove spaces from task names in fluent definitions', () => {
      const tasks = [createTaskNode('T1', 'Track Vital Signs')];

      const fluents = generateFluents(tasks);

      assert.strictEqual(
        fluents[0],
        '    fluent TrackVitalSigns <{StartTrackVitalSigns}, {AchievedTrackVitalSigns}>',
      );
    });

    it('should skip tasks with no name', () => {
      const tasks = [
        createTaskNode('T1', 'Valid Task'),
        {
          id: 'T2',
          name: null,
          type: 'task',
          properties: {},
        } as unknown as Task,
        {
          id: 'T3',
          name: undefined,
          type: 'task',
          properties: {},
        } as unknown as Task,
      ];

      const fluents = generateFluents(tasks);

      assert.strictEqual(fluents.length, 1);
      assert.strictEqual(
        fluents[0],
        '    fluent ValidTask <{StartValidTask}, {AchievedValidTask}>',
      );
    });

    it('should return empty array for empty tasks list', () => {
      const fluents = generateFluents([]);

      assert.deepStrictEqual(fluents, []);
    });

    it('should handle task names with multiple consecutive spaces', () => {
      const tasks = [createTaskNode('T1', 'Process   data')];

      const fluents = generateFluents(tasks);

      assert.strictEqual(
        fluents[0],
        '    fluent Processdata <{StartProcessdata}, {AchievedProcessdata}>',
      );
    });

    it('should generate fluents matching BSN Goal Model task names', () => {
      // Based on goalModel-sleec2.txt task names
      const tasks = [
        createTaskNode('T1', 'Inform System Purpose and Protocol'),
        createTaskNode('T2', 'Obtain Consent Full Tracking'),
        createTaskNode('T3', 'Obtain Consent Partial Tracking'),
        createTaskNode('T4', 'Apply Consent Partial Tracking Protocol'),
        createTaskNode('T5', 'Track Vital Signs'),
        createTaskNode('T6', 'Track Patient Outdoors'),
        createTaskNode('T7', 'Process data'),
        createTaskNode('T8', 'Detect patient health status'),
      ];

      const fluents = generateFluents(tasks);

      assert.strictEqual(fluents.length, 8);
      assert.ok(
        fluents[0]?.includes('InformSystemPurposeandProtocol'),
        'Should include InformSystemPurposeandProtocol',
      );
      assert.ok(
        fluents[1]?.includes('ObtainConsentFullTracking'),
        'Should include ObtainConsentFullTracking',
      );
      assert.ok(
        fluents[2]?.includes('ObtainConsentPartialTracking'),
        'Should include ObtainConsentPartialTracking',
      );
      assert.ok(
        fluents[3]?.includes('ApplyConsentPartialTrackingProtocol'),
        'Should include ApplyConsentPartialTrackingProtocol',
      );
      assert.ok(
        fluents[4]?.includes('TrackVitalSigns'),
        'Should include TrackVitalSigns',
      );
      assert.ok(
        fluents[5]?.includes('TrackPatientOutdoors'),
        'Should include TrackPatientOutdoors',
      );
      assert.ok(
        fluents[6]?.includes('Processdata'),
        'Should include Processdata',
      );
      assert.ok(
        fluents[7]?.includes('Detectpatienthealthstatus'),
        'Should include Detectpatienthealthstatus',
      );
    });

    it('should produce correct fluent format: fluent Name <{StartName}, {AchievedName}>', () => {
      const tasks = [createTaskNode('T1', 'TestTask')];

      const fluents = generateFluents(tasks);

      // Verify the exact format
      const fluentRegex = /^\s+fluent (\w+) <\{Start\1\}, \{Achieved\1\}>$/;
      assert.ok(
        fluentRegex.test(fluents[0] || ''),
        `Fluent should match format: "    fluent Name <{StartName}, {AchievedName}>", got: "${fluents[0]}"`,
      );
    });
  });
});
