export class EdgemodelPackageLiterals{
	public static GOALTREE:number = 4;
	public static GOALTREE_FEATURE_COUNT:number = 4;
	public static GOALTREE_OPERATION_COUNT:number = 0;
	
	public static GOAL_TREE__ROOT:number = 0;
	public static GOAL_TREE__ALL_TASKS:number = 1;
	public static GOAL_TREE__ALL_GOALS:number = 2;
	public static GOAL_TREE__ALL_RESOURCE:number = 3;
	
	public static NODE:number = 5;
	public static NODE_FEATURE_COUNT:number = 5;
	public static NODE_OPERATION_COUNT:number = 0;
	
	public static NODE__ID:number = 0;
	public static NODE__NAME:number = 1;
	public static NODE__CHILD:number = 2;
	public static NODE__DEPENDS_ON:number = 3;
	public static NODE__MAX_RETRIES:number = 4;
	
	public static GOAL:number = 6;
	public static GOAL_FEATURE_COUNT:number = EdgemodelPackageLiterals.NODE_FEATURE_COUNT + 7;
	public static GOAL_OPERATION_COUNT:number = EdgemodelPackageLiterals.NODE_OPERATION_COUNT + 0;
	
	public static GOAL__ID:number = 0;
	public static GOAL__NAME:number = 1;
	public static GOAL__CHILD:number = 2;
	public static GOAL__DEPENDS_ON:number = 3;
	public static GOAL__MAX_RETRIES:number = 4;
	public static GOAL__TYPE:number = 5;
	public static GOAL__PARENT:number = 6;
	public static GOAL__CONTEXT:number = 7;
	public static GOAL__MAINTAIN_CONDITION:number = 8;
	public static GOAL__EXEC:number = 9;
	public static GOAL__UTILITY:number = 10;
	public static GOAL__COST:number = 11;
	
	public static TASK:number = 7;
	public static TASK_FEATURE_COUNT:number = EdgemodelPackageLiterals.NODE_FEATURE_COUNT + 1;
	public static TASK_OPERATION_COUNT:number = EdgemodelPackageLiterals.NODE_OPERATION_COUNT + 0;
	
	public static TASK__ID:number = 0;
	public static TASK__NAME:number = 1;
	public static TASK__CHILD:number = 2;
	public static TASK__DEPENDS_ON:number = 3;
	public static TASK__MAX_RETRIES:number = 4;
	public static TASK__RESOURCES:number = 5;
	
	public static LINK:number = 8;
	public static LINK_FEATURE_COUNT:number = 2;
	public static LINK_OPERATION_COUNT:number = 0;
	
	public static LINK__OUTGOING:number = 0;
	public static LINK__INCOMING:number = 1;
	
	public static EXECUTIONDETAILS:number = 9;
	public static EXECUTIONDETAILS_FEATURE_COUNT:number = 2;
	public static EXECUTIONDETAILS_OPERATION_COUNT:number = 0;
	
	public static EXECUTION_DETAILS__OPERATOR:number = 0;
	public static EXECUTION_DETAILS__OPERAND:number = 1;
	
	public static OPERAND:number = 10;
	public static OPERAND_FEATURE_COUNT:number = 2;
	public static OPERAND_OPERATION_COUNT:number = 0;
	
	public static OPERAND__RETRY_LIMIT:number = 0;
	public static OPERAND__TARGET:number = 1;
	
	public static RESOURCE:number = 11;
	public static RESOURCE_FEATURE_COUNT:number = 3;
	public static RESOURCE_OPERATION_COUNT:number = 0;
	
	public static RESOURCE__KIND:number = 0;
	public static RESOURCE__NAME:number = 1;
	public static RESOURCE__ID:number = 2;
	
	public static BOOLRESOURCE:number = 12;
	public static BOOLRESOURCE_FEATURE_COUNT:number = EdgemodelPackageLiterals.RESOURCE_FEATURE_COUNT + 1;
	public static BOOLRESOURCE_OPERATION_COUNT:number = EdgemodelPackageLiterals.RESOURCE_OPERATION_COUNT + 0;
	
	public static BOOL_RESOURCE__KIND:number = 0;
	public static BOOL_RESOURCE__NAME:number = 1;
	public static BOOL_RESOURCE__ID:number = 2;
	public static BOOL_RESOURCE__INITIAL_VALUE:number = 3;
	
	public static INTRESOURCE:number = 13;
	public static INTRESOURCE_FEATURE_COUNT:number = EdgemodelPackageLiterals.RESOURCE_FEATURE_COUNT + 3;
	public static INTRESOURCE_OPERATION_COUNT:number = EdgemodelPackageLiterals.RESOURCE_OPERATION_COUNT + 0;
	
	public static INT_RESOURCE__KIND:number = 0;
	public static INT_RESOURCE__NAME:number = 1;
	public static INT_RESOURCE__ID:number = 2;
	public static INT_RESOURCE__INITIAL_VALUE:number = 3;
	public static INT_RESOURCE__LOWER_BOUND:number = 4;
	public static INT_RESOURCE__UPPER_BOUND:number = 5;
	
	public static CONDITION:number = 14;
	public static CONDITION_FEATURE_COUNT:number = 1;
	public static CONDITION_OPERATION_COUNT:number = 0;
	
	public static CONDITION__EXPRESSION:number = 0;
	
	public static GOALTYPE:number = 0;
	
	public static LINKTYPE:number = 1;
	
	public static RUNTIMEOP:number = 2;
	
	public static RESOURCEKIND:number = 3;
	
}
