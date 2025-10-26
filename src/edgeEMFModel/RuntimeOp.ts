// @ts-nocheck
export class RuntimeOp {
  public static readonly CHOICE_VALUE: number = 0;
  public static readonly ALTERNATIVE_VALUE: number = 0;
  public static readonly DEGRADATION_VALUE: number = 0;
  public static readonly SEQUENCE_VALUE: number = 0;
  public static readonly INTERLEAVED_VALUE: number = 0;

  public static CHOICE: RuntimeOp = new RuntimeOp(0, 'Choice', 'Choice');
  public static ALTERNATIVE: RuntimeOp = new RuntimeOp(
    0,
    'Alternative',
    'Alternative'
  );
  public static DEGRADATION: RuntimeOp = new RuntimeOp(
    0,
    'Degradation',
    'Degradation'
  );
  public static SEQUENCE: RuntimeOp = new RuntimeOp(0, 'Sequence', 'Sequence');
  public static INTERLEAVED: RuntimeOp = new RuntimeOp(
    0,
    'Interleaved',
    'Interleaved'
  );

  private static VALUES_ARRAY: Array<RuntimeOp> = [
    RuntimeOp.CHOICE,
    RuntimeOp.ALTERNATIVE,
    RuntimeOp.DEGRADATION,
    RuntimeOp.SEQUENCE,
    RuntimeOp.INTERLEAVED,
  ];

  public static get_string(literal: string): RuntimeOp {
    for (let i = 0; i < this.VALUES_ARRAY.length; i++) {
      let result = this.VALUES_ARRAY[i];
      if (result.toString() === literal) {
        return result;
      }
    }
    return null;
  }

  public static getByName(name: string): RuntimeOp {
    for (let i = 0; i < this.VALUES_ARRAY.length; i++) {
      let result = this.VALUES_ARRAY[i];
      if (result.getName() == name) {
        return result;
      }
    }
    return null;
  }

  public static get_number(value: number): RuntimeOp {
    switch (value) {
      case this.CHOICE_VALUE:
        return this.CHOICE;
      case this.ALTERNATIVE_VALUE:
        return this.ALTERNATIVE;
      case this.DEGRADATION_VALUE:
        return this.DEGRADATION;
      case this.SEQUENCE_VALUE:
        return this.SEQUENCE;
      case this.INTERLEAVED_VALUE:
        return this.INTERLEAVED;
    }
    return null;
  }

  private value: number;
  private name: string;
  private literal: string;

  private constructor(value: number, name: string, literal: string) {
    this.value = value;
    this.name = name;
    this.literal = literal;
  }

  public getLiteral(): string {
    return this.literal;
  }

  public getName(): string {
    return this.name;
  }

  public getValue(): number {
    return this.value;
  }

  public toString(): string {
    return this.literal;
  }
}
