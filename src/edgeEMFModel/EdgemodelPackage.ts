import {EClass} from "ecore/EClass";
import {EAttribute} from "ecore/EAttribute";
import {EEnum} from "ecore/EEnum";
import {EReference} from "ecore/EReference";
import {EPackage} from "ecore/EPackage";
export interface EdgemodelPackage extends EPackage {
	getGoalTree():EClass;
	getGoalTree_Root():EReference;
	getGoalTree_AllTasks():EReference;
	getGoalTree_AllGoals():EReference;
	getGoalTree_AllResource():EReference;
	
	getNode():EClass;
	getNode_Child():EReference;
	getNode_DependsOn():EReference;
	
	getNode_Id():EAttribute;
	getNode_Name():EAttribute;
	getNode_MaxRetries():EAttribute;
	getGoal():EClass;
	getGoal_Parent():EReference;
	getGoal_Context():EReference;
	getGoal_MaintainCondition():EReference;
	getGoal_Exec():EReference;
	
	getGoal_Type():EAttribute;
	getGoal_Utility():EAttribute;
	getGoal_Cost():EAttribute;
	getTask():EClass;
	getTask_Resources():EReference;
	
	getLink():EClass;
	getLink_Outgoing():EReference;
	getLink_Incoming():EReference;
	
	getExecutionDetails():EClass;
	getExecutionDetails_Operand():EReference;
	
	getExecutionDetails_Operator():EAttribute;
	getOperand():EClass;
	getOperand_Target():EReference;
	
	getOperand_RetryLimit():EAttribute;
	getResource():EClass;
	
	getResource_Kind():EAttribute;
	getResource_Name():EAttribute;
	getResource_Id():EAttribute;
	getBoolResource():EClass;
	
	getBoolResource_InitialValue():EAttribute;
	getIntResource():EClass;
	
	getIntResource_InitialValue():EAttribute;
	getIntResource_LowerBound():EAttribute;
	getIntResource_UpperBound():EAttribute;
	getCondition():EClass;
	
	getCondition_Expression():EAttribute;
	getGoalType():EEnum;
	getLinkType():EEnum;
	getRuntimeOp():EEnum;
	getResourceKind():EEnum;
}
