import { describe, expect, it } from 'vitest';
import { applyJqQuery } from './JsonFormatter.svelte';

describe('JsonFormatter JQ-like Query', () => {
  describe('applyJqQuery', () => {
    // Common test data
    const testData = {
      "children": [
        {
          "name": "mohamed"
        }
      ],
      "nestedArrays": [
        [1, 2],
        [3, 4]
      ],
      "object": {
        "key1": "value1",
        "key2": "value2"
      }
    };

    it('should return the entire object for empty queries', () => {
      const result = applyJqQuery(testData, '');
      expect(JSON.parse(result)).toEqual(testData);
      
      const result2 = applyJqQuery(testData, '.');
      expect(JSON.parse(result2)).toEqual(testData);
    });

    it('should access simple properties correctly', () => {
      const result = applyJqQuery(testData, '.object');
      expect(JSON.parse(result)).toEqual({ "key1": "value1", "key2": "value2" });
      
      const result2 = applyJqQuery(testData, '.object.key1');
      expect(JSON.parse(result2)).toEqual("value1");
    });

    it('should handle array access with index correctly', () => {
      const result = applyJqQuery(testData, '.children[0]');
      expect(JSON.parse(result)).toEqual({ "name": "mohamed" });
      
      const result2 = applyJqQuery(testData, '.nestedArrays[0]');
      expect(JSON.parse(result2)).toEqual([1, 2]);
    });

    it('should handle array iterator notation correctly', () => {
      const result = applyJqQuery(testData, '.children');
      expect(JSON.parse(result)).toEqual([{ "name": "mohamed" }]);
      
      const result2 = applyJqQuery(testData, '.children[]');
      expect(JSON.parse(result2)).toEqual({ "name": "mohamed" });
    });

    it('should handle nested properties through array iterator', () => {
      const result = applyJqQuery(testData, '.children[].name');
      expect(JSON.parse(result)).toEqual("mohamed");
    });

    it('should handle nested arrays with iterator', () => {
      const result = applyJqQuery(testData, '.nestedArrays[]');
      const lines = result.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0])).toEqual([1, 2]);
      expect(JSON.parse(lines[1])).toEqual([3, 4]);
    });

    it('should handle complex example from the issue', () => {
      const complexData = { "children": [{ "name": "mohamed" }] };
      
      // .children should give the array
      const resultArray = applyJqQuery(complexData, '.children');
      expect(JSON.parse(resultArray)).toEqual([{ "name": "mohamed" }]);
      
      // .children[] should give the first object directly 
      const resultObject = applyJqQuery(complexData, '.children[]');
      expect(JSON.parse(resultObject)).toEqual({ "name": "mohamed" });
    });

    it('should handle multiple elements in array iteration', () => {
      const multipleData = { 
        "children": [
          { "name": "mohamed" },
          { "name": "ahmed" }
        ]
      };
      
      // .children[] should give each object on separate lines
      const result = applyJqQuery(multipleData, '.children[]');
      const lines = result.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0])).toEqual({ "name": "mohamed" });
      expect(JSON.parse(lines[1])).toEqual({ "name": "ahmed" });
    });
  });
});