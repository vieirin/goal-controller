import { EdgemodelPackageImpl } from 'edgemodel/EdgemodelPackageImpl';
import { Task } from 'edgemodel/Task';
import { TaskImpl } from 'edgemodel/TaskImpl';
import { Operand } from 'edgemodel/Operand';
import { Node } from 'edgemodel/Node';
import { ExecutionDetailsImpl } from 'edgemodel/ExecutionDetailsImpl';
import { BoolResource } from 'edgemodel/BoolResource';
import { Goal } from 'edgemodel/Goal';
import { GoalImpl } from 'edgemodel/GoalImpl';
import { ConditionImpl } from 'edgemodel/ConditionImpl';
import { GoalTree } from 'edgemodel/GoalTree';
import { RuntimeOp } from 'edgemodel/RuntimeOp';
import { LinkImpl } from 'edgemodel/LinkImpl';
import { Condition } from 'edgemodel/Condition';
import { GoalTreeImpl } from 'edgemodel/GoalTreeImpl';
import { NodeImpl } from 'edgemodel/NodeImpl';
import { OperandImpl } from 'edgemodel/OperandImpl';
import { IntResourceImpl } from 'edgemodel/IntResourceImpl';
import { Resource } from 'edgemodel/Resource';
import { GoalType } from 'edgemodel/GoalType';
import { ExecutionDetails } from 'edgemodel/ExecutionDetails';
import { EdgemodelFactory } from 'edgemodel/EdgemodelFactory';
import { ResourceImpl } from 'edgemodel/ResourceImpl';
import { IntResource } from 'edgemodel/IntResource';
import { BoolResourceImpl } from 'edgemodel/BoolResourceImpl';
import { LinkType } from 'edgemodel/LinkType';
import { ResourceKind } from 'edgemodel/ResourceKind';
import { Link } from 'edgemodel/Link';
import { EFactoryImpl } from 'ecore/EFactoryImpl';
import { EClass } from 'ecore/EClass';
import { EDataType } from 'ecore/EDataType';
import { EObject } from 'ecore/EObject';
export class EdgemodelFactoryImpl
  extends EFactoryImpl
  implements EdgemodelFactory
{
  public static eINSTANCE: EdgemodelFactory = EdgemodelFactoryImpl.init();
  public static init(): EdgemodelFactory {
    return new EdgemodelFactoryImpl();
  }

  public createGoalTree = (): GoalTree => {
    let theGoalTree = new GoalTreeImpl();

    return theGoalTree;
  };
  public createNode = (): Node => {
    let theNode = new NodeImpl();

    return theNode;
  };
  public createGoal = (): Goal => {
    let theGoal = new GoalImpl();

    return theGoal;
  };
  public createTask = (): Task => {
    let theTask = new TaskImpl();

    return theTask;
  };
  public createLink = (): Link => {
    let theLink = new LinkImpl();

    return theLink;
  };
  public createExecutionDetails = (): ExecutionDetails => {
    let theExecutionDetails = new ExecutionDetailsImpl();

    return theExecutionDetails;
  };
  public createOperand = (): Operand => {
    let theOperand = new OperandImpl();

    return theOperand;
  };
  public createResource = (): Resource => {
    let theResource = new ResourceImpl();

    return theResource;
  };
  public createBoolResource = (): BoolResource => {
    let theBoolResource = new BoolResourceImpl();

    return theBoolResource;
  };
  public createIntResource = (): IntResource => {
    let theIntResource = new IntResourceImpl();

    return theIntResource;
  };
  public createCondition = (): Condition => {
    let theCondition = new ConditionImpl();

    return theCondition;
  };

  public create(eClass: EClass): EObject {
    switch (eClass.getClassifierID()) {
      case EdgemodelPackageImpl.GOALTREE:
        return this.createGoalTree();
      case EdgemodelPackageImpl.GOAL:
        return this.createGoal();
      case EdgemodelPackageImpl.TASK:
        return this.createTask();
      case EdgemodelPackageImpl.LINK:
        return this.createLink();
      case EdgemodelPackageImpl.EXECUTIONDETAILS:
        return this.createExecutionDetails();
      case EdgemodelPackageImpl.OPERAND:
        return this.createOperand();
      case EdgemodelPackageImpl.BOOLRESOURCE:
        return this.createBoolResource();
      case EdgemodelPackageImpl.INTRESOURCE:
        return this.createIntResource();
      case EdgemodelPackageImpl.CONDITION:
        return this.createCondition();
      default:
        throw new Error(
          "The class '" + eClass.name + "' is not a valid classifier"
        );
    }
  }

  public createFromString(eDataType: EDataType, initialValue: string): any {
    switch (eDataType.getClassifierID()) {
      case EdgemodelPackageImpl.GOALTYPE:
        return this.createGoalTypeFromString(eDataType, initialValue);
      case EdgemodelPackageImpl.LINKTYPE:
        return this.createLinkTypeFromString(eDataType, initialValue);
      case EdgemodelPackageImpl.RUNTIMEOP:
        return this.createRuntimeOpFromString(eDataType, initialValue);
      case EdgemodelPackageImpl.RESOURCEKIND:
        return this.createResourceKindFromString(eDataType, initialValue);
      default:
        throw new Error(
          "The datatype '" + eDataType.name + "' is not a valid classifier"
        );
    }
  }
  public convertToString(eDataType: EDataType, instanceValue: any): string {
    switch (eDataType.getClassifierID()) {
      case EdgemodelPackageImpl.GOALTYPE:
        return this.convertGoalTypeToString(eDataType, instanceValue);
      case EdgemodelPackageImpl.LINKTYPE:
        return this.convertLinkTypeToString(eDataType, instanceValue);
      case EdgemodelPackageImpl.RUNTIMEOP:
        return this.convertRuntimeOpToString(eDataType, instanceValue);
      case EdgemodelPackageImpl.RESOURCEKIND:
        return this.convertResourceKindToString(eDataType, instanceValue);
      default:
        throw new Error(
          "The datatype '" + eDataType.name + "' is not a valid classifier"
        );
    }
  }

  public createGoalTypeFromString(
    eDataType: EDataType,
    initialValue: string
  ): GoalType {
    let result: GoalType = GoalType.get_string(initialValue);
    if (result == null)
      throw new Error(
        "The value '" +
          initialValue +
          "' is not a valid enumerator of '" +
          eDataType.name +
          "'"
      );
    return result;
  }

  public convertGoalTypeToString(
    eDataType: EDataType,
    instanceValue: any
  ): string {
    return instanceValue === null ? null : instanceValue.toString();
  }
  public createLinkTypeFromString(
    eDataType: EDataType,
    initialValue: string
  ): LinkType {
    let result: LinkType = LinkType.get_string(initialValue);
    if (result == null)
      throw new Error(
        "The value '" +
          initialValue +
          "' is not a valid enumerator of '" +
          eDataType.name +
          "'"
      );
    return result;
  }

  public convertLinkTypeToString(
    eDataType: EDataType,
    instanceValue: any
  ): string {
    return instanceValue === null ? null : instanceValue.toString();
  }
  public createRuntimeOpFromString(
    eDataType: EDataType,
    initialValue: string
  ): RuntimeOp {
    let result: RuntimeOp = RuntimeOp.get_string(initialValue);
    if (result == null)
      throw new Error(
        "The value '" +
          initialValue +
          "' is not a valid enumerator of '" +
          eDataType.name +
          "'"
      );
    return result;
  }

  public convertRuntimeOpToString(
    eDataType: EDataType,
    instanceValue: any
  ): string {
    return instanceValue === null ? null : instanceValue.toString();
  }
  public createResourceKindFromString(
    eDataType: EDataType,
    initialValue: string
  ): ResourceKind {
    let result: ResourceKind = ResourceKind.get_string(initialValue);
    if (result == null)
      throw new Error(
        "The value '" +
          initialValue +
          "' is not a valid enumerator of '" +
          eDataType.name +
          "'"
      );
    return result;
  }

  public convertResourceKindToString(
    eDataType: EDataType,
    instanceValue: any
  ): string {
    return instanceValue === null ? null : instanceValue.toString();
  }
}
