import {BoolResourceBase} from "edgemodel/BoolResourceBase";
import {GoalTreeImpl} from "edgemodel/GoalTreeImpl";
import {NodeImpl} from "edgemodel/NodeImpl";
import {ResourceBase} from "edgemodel/ResourceBase";
import {TaskImpl} from "edgemodel/TaskImpl";
import {OperandImpl} from "edgemodel/OperandImpl";
import {ExecutionDetailsImpl} from "edgemodel/ExecutionDetailsImpl";
import {IntResourceImpl} from "edgemodel/IntResourceImpl";
import {TaskBase} from "edgemodel/TaskBase";
import {ConditionBase} from "edgemodel/ConditionBase";
import {LinkBase} from "edgemodel/LinkBase";
import {GoalTreeBase} from "edgemodel/GoalTreeBase";
import {NodeBase} from "edgemodel/NodeBase";
import {ExecutionDetailsBase} from "edgemodel/ExecutionDetailsBase";
import {GoalImpl} from "edgemodel/GoalImpl";
import {ConditionImpl} from "edgemodel/ConditionImpl";
import {ResourceImpl} from "edgemodel/ResourceImpl";
import {BoolResourceImpl} from "edgemodel/BoolResourceImpl";
import {OperandBase} from "edgemodel/OperandBase";
import {EdgemodelPackage} from "edgemodel/EdgemodelPackage";
import {IntResourceBase} from "edgemodel/IntResourceBase";
import {LinkImpl} from "edgemodel/LinkImpl";
import {GoalBase} from "edgemodel/GoalBase";
import {EFactory} from "ecore/EFactory";
import {EPackageImpl} from "ecore/EPackageImpl";
import {EClass} from "ecore/EClass";
import {EAttribute} from "ecore/EAttribute";
import {EcorePackageImpl} from "ecore/EcorePackageImpl";
import {EOperation} from "ecore/EOperation";
import {EEnum} from "ecore/EEnum";
import {EcoreFactoryImpl} from "ecore/EcoreFactoryImpl";
import {EReference} from "ecore/EReference";
export class EdgemodelPackageImpl extends EPackageImpl implements EdgemodelPackage{
		public static eNAME:string = "edgemodel";
		
		public static eNS_URI:string = "http://www.example.org/edgemodel";
		
		public static eNS_PREFIX:string = "edgemodel";
		
		
		
		/*
		constructor(){
			//no private constructors in TypeScript
			super(EdgemodelPackageImpl.eNS_URI, EdgemodelFactoryImpl.eINSTANCE as any as EFactory);
		}
		*/
		
		public static init():EdgemodelPackage
		{

	        // Obtain or create and register package
	        let theEdgemodelPackage = new EdgemodelPackageImpl();
	        theEdgemodelPackage.ecorePackage = EcorePackageImpl.eINSTANCE;
	        theEdgemodelPackage.ecoreFactory = EcoreFactoryImpl.eINSTANCE;
	
	        // Create package meta-data objects
	        theEdgemodelPackage.createPackageContents();
	
	        // Initialize created meta-data
	        theEdgemodelPackage.initializePackageContents();

	        return theEdgemodelPackage;
        }
        
        private isCreated:boolean = false;
        
        public createPackageContents = ():void =>
        {
            if (this.isCreated) return;
            this.isCreated = true;
			this.GoalTreeEClass = this.createEClass(EdgemodelPackageImpl.GOALTREE);
			GoalTreeBase.eStaticClass = this.GoalTreeEClass;
			this.createEReference(this.GoalTreeEClass, EdgemodelPackageImpl.GOAL_TREE__ROOT);
			this.createEReference(this.GoalTreeEClass, EdgemodelPackageImpl.GOAL_TREE__ALL_TASKS);
			this.createEReference(this.GoalTreeEClass, EdgemodelPackageImpl.GOAL_TREE__ALL_GOALS);
			this.createEReference(this.GoalTreeEClass, EdgemodelPackageImpl.GOAL_TREE__ALL_RESOURCE);
			this.NodeEClass = this.createEClass(EdgemodelPackageImpl.NODE);
			NodeBase.eStaticClass = this.NodeEClass;
			this.createEAttribute(this.NodeEClass, EdgemodelPackageImpl.NODE__ID);
			this.createEAttribute(this.NodeEClass, EdgemodelPackageImpl.NODE__NAME);
			this.createEReference(this.NodeEClass, EdgemodelPackageImpl.NODE__CHILD);
			this.createEReference(this.NodeEClass, EdgemodelPackageImpl.NODE__DEPENDS_ON);
			this.createEAttribute(this.NodeEClass, EdgemodelPackageImpl.NODE__MAX_RETRIES);
			this.GoalEClass = this.createEClass(EdgemodelPackageImpl.GOAL);
			GoalBase.eStaticClass = this.GoalEClass;
			this.createEAttribute(this.GoalEClass, EdgemodelPackageImpl.GOAL__TYPE);
			this.createEReference(this.GoalEClass, EdgemodelPackageImpl.GOAL__PARENT);
			this.createEReference(this.GoalEClass, EdgemodelPackageImpl.GOAL__CONTEXT);
			this.createEReference(this.GoalEClass, EdgemodelPackageImpl.GOAL__MAINTAIN_CONDITION);
			this.createEReference(this.GoalEClass, EdgemodelPackageImpl.GOAL__EXEC);
			this.createEAttribute(this.GoalEClass, EdgemodelPackageImpl.GOAL__UTILITY);
			this.createEAttribute(this.GoalEClass, EdgemodelPackageImpl.GOAL__COST);
			this.TaskEClass = this.createEClass(EdgemodelPackageImpl.TASK);
			TaskBase.eStaticClass = this.TaskEClass;
			this.createEReference(this.TaskEClass, EdgemodelPackageImpl.TASK__RESOURCES);
			this.LinkEClass = this.createEClass(EdgemodelPackageImpl.LINK);
			LinkBase.eStaticClass = this.LinkEClass;
			this.createEReference(this.LinkEClass, EdgemodelPackageImpl.LINK__OUTGOING);
			this.createEReference(this.LinkEClass, EdgemodelPackageImpl.LINK__INCOMING);
			this.ExecutionDetailsEClass = this.createEClass(EdgemodelPackageImpl.EXECUTIONDETAILS);
			ExecutionDetailsBase.eStaticClass = this.ExecutionDetailsEClass;
			this.createEAttribute(this.ExecutionDetailsEClass, EdgemodelPackageImpl.EXECUTION_DETAILS__OPERATOR);
			this.createEReference(this.ExecutionDetailsEClass, EdgemodelPackageImpl.EXECUTION_DETAILS__OPERAND);
			this.OperandEClass = this.createEClass(EdgemodelPackageImpl.OPERAND);
			OperandBase.eStaticClass = this.OperandEClass;
			this.createEAttribute(this.OperandEClass, EdgemodelPackageImpl.OPERAND__RETRY_LIMIT);
			this.createEReference(this.OperandEClass, EdgemodelPackageImpl.OPERAND__TARGET);
			this.ResourceEClass = this.createEClass(EdgemodelPackageImpl.RESOURCE);
			ResourceBase.eStaticClass = this.ResourceEClass;
			this.createEAttribute(this.ResourceEClass, EdgemodelPackageImpl.RESOURCE__KIND);
			this.createEAttribute(this.ResourceEClass, EdgemodelPackageImpl.RESOURCE__NAME);
			this.createEAttribute(this.ResourceEClass, EdgemodelPackageImpl.RESOURCE__ID);
			this.BoolResourceEClass = this.createEClass(EdgemodelPackageImpl.BOOLRESOURCE);
			BoolResourceBase.eStaticClass = this.BoolResourceEClass;
			this.createEAttribute(this.BoolResourceEClass, EdgemodelPackageImpl.BOOL_RESOURCE__INITIAL_VALUE);
			this.IntResourceEClass = this.createEClass(EdgemodelPackageImpl.INTRESOURCE);
			IntResourceBase.eStaticClass = this.IntResourceEClass;
			this.createEAttribute(this.IntResourceEClass, EdgemodelPackageImpl.INT_RESOURCE__INITIAL_VALUE);
			this.createEAttribute(this.IntResourceEClass, EdgemodelPackageImpl.INT_RESOURCE__LOWER_BOUND);
			this.createEAttribute(this.IntResourceEClass, EdgemodelPackageImpl.INT_RESOURCE__UPPER_BOUND);
			this.ConditionEClass = this.createEClass(EdgemodelPackageImpl.CONDITION);
			ConditionBase.eStaticClass = this.ConditionEClass;
			this.createEAttribute(this.ConditionEClass, EdgemodelPackageImpl.CONDITION__EXPRESSION);
			
			this.GoalTypeEEnum = this.createEEnum(EdgemodelPackageImpl.GOALTYPE);
			this.LinkTypeEEnum = this.createEEnum(EdgemodelPackageImpl.LINKTYPE);
			this.RuntimeOpEEnum = this.createEEnum(EdgemodelPackageImpl.RUNTIMEOP);
			this.ResourceKindEEnum = this.createEEnum(EdgemodelPackageImpl.RESOURCEKIND);
			
        }
        private isInitialized:boolean = false;
        public initializePackageContents=():void =>
        {
            if (this.isInitialized) return;
            this.isInitialized = true;
            // Initialize package
            this.name = EdgemodelPackageImpl.eNAME;
            this.nsPrefix = EdgemodelPackageImpl.eNS_PREFIX;
            this.nsURI = EdgemodelPackageImpl.eNS_URI;

			
			
			
			this.GoalEClass.eSuperTypes.add(this.getNode());
			
			this.TaskEClass.eSuperTypes.add(this.getNode());
			
			
			
			
			
			this.BoolResourceEClass.eSuperTypes.add(this.getResource());
			
			this.IntResourceEClass.eSuperTypes.add(this.getResource());
			
			var op:EOperation = null;
			
			this.initEClass(
			this.GoalTreeEClass,
			GoalTreeImpl, 
			"GoalTree", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			
			this.initEReference(
				this.getGoalTree_Root(),
				this.getGoal(), 
				null, 
				"root", 
				null, 
				1, 
				1, 
				GoalTreeImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				!EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getGoalTree_AllTasks(),
				this.getTask(), 
				null, 
				"allTasks", 
				null, 
				0, 
				-1, 
				GoalTreeImpl, 
				EPackageImpl.IS_TRANSIENT, 
				EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_UNIQUE, 
				EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getGoalTree_AllGoals(),
				this.getGoal(), 
				null, 
				"allGoals", 
				null, 
				0, 
				-1, 
				GoalTreeImpl, 
				EPackageImpl.IS_TRANSIENT, 
				EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_UNIQUE, 
				EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getGoalTree_AllResource(),
				this.getResource(), 
				null, 
				"allResource", 
				null, 
				0, 
				-1, 
				GoalTreeImpl, 
				EPackageImpl.IS_TRANSIENT, 
				EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				!EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_UNIQUE, 
				EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.NodeEClass,
			NodeImpl, 
			"Node", 
			EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getNode_Id(), 
				this.getString(), 
				"id", 
				null, 
				1, 
				1, 
				NodeImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getNode_Name(), 
				this.getString(), 
				"name", 
				null, 
				1, 
				1, 
				NodeImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				!EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getNode_MaxRetries(), 
				this.getInt(), 
				"maxRetries", 
				"0", 
				0, 
				1, 
				NodeImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				!EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			
			this.initEReference(
				this.getNode_Child(),
				this.getLink(), 
				this.getLink_Incoming(), 
				"child", 
				null, 
				1, 
				1, 
				NodeImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getNode_DependsOn(),
				this.getGoal(), 
				null, 
				"dependsOn", 
				null, 
				0, 
				-1, 
				NodeImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.GoalEClass,
			GoalImpl, 
			"Goal", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getGoal_Type(), 
				this.getGoalType(), 
				"type", 
				"Achieve", 
				1, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getGoal_Utility(), 
				this.getDouble(), 
				"utility", 
				"0.0", 
				1, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getGoal_Cost(), 
				this.getDouble(), 
				"cost", 
				"0.0", 
				1, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			
			this.initEReference(
				this.getGoal_Parent(),
				this.getLink(), 
				this.getLink_Outgoing(), 
				"parent", 
				null, 
				1, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				!EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getGoal_Context(),
				this.getCondition(), 
				null, 
				"context", 
				null, 
				0, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getGoal_MaintainCondition(),
				this.getCondition(), 
				null, 
				"maintainCondition", 
				null, 
				0, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getGoal_Exec(),
				this.getExecutionDetails(), 
				null, 
				"exec", 
				null, 
				0, 
				1, 
				GoalImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.TaskEClass,
			TaskImpl, 
			"Task", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			
			this.initEReference(
				this.getTask_Resources(),
				this.getResource(), 
				null, 
				"resources", 
				null, 
				0, 
				-1, 
				TaskImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.LinkEClass,
			LinkImpl, 
			"Link", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			
			this.initEReference(
				this.getLink_Outgoing(),
				this.getGoal(), 
				this.getGoal_Parent(), 
				"outgoing", 
				null, 
				1, 
				-1, 
				LinkImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEReference(
				this.getLink_Incoming(),
				this.getNode(), 
				this.getNode_Child(), 
				"incoming", 
				null, 
				1, 
				1, 
				LinkImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.ExecutionDetailsEClass,
			ExecutionDetailsImpl, 
			"ExecutionDetails", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getExecutionDetails_Operator(), 
				this.getRuntimeOp(), 
				"operator", 
				"Interleaved", 
				0, 
				1, 
				ExecutionDetailsImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			this.initEReference(
				this.getExecutionDetails_Operand(),
				this.getOperand(), 
				null, 
				"operand", 
				null, 
				1, 
				-1, 
				ExecutionDetailsImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.OperandEClass,
			OperandImpl, 
			"Operand", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getOperand_RetryLimit(), 
				this.ecorePackage.getEInt(), 
				"retryLimit", 
				"0", 
				0, 
				1, 
				OperandImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			
			this.initEReference(
				this.getOperand_Target(),
				this.getNode(), 
				null, 
				"target", 
				null, 
				1, 
				-1, 
				OperandImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_COMPOSITE, 
				EPackageImpl.IS_RESOLVE_PROXIES, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			this.initEClass(
			this.ResourceEClass,
			ResourceImpl, 
			"Resource", 
			EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getResource_Kind(), 
				this.getResourceKind(), 
				"kind", 
				"Bool", 
				1, 
				1, 
				ResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getResource_Name(), 
				this.getString(), 
				"name", 
				null, 
				1, 
				1, 
				ResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				!EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				!EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getResource_Id(), 
				this.getString(), 
				"id", 
				null, 
				1, 
				1, 
				ResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				!EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			
			this.initEClass(
			this.BoolResourceEClass,
			BoolResourceImpl, 
			"BoolResource", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getBoolResource_InitialValue(), 
				this.getBoolean(), 
				"initialValue", 
				"false", 
				1, 
				1, 
				BoolResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			
			this.initEClass(
			this.IntResourceEClass,
			IntResourceImpl, 
			"IntResource", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getIntResource_InitialValue(), 
				this.ecorePackage.getEInt(), 
				"initialValue", 
				"0", 
				1, 
				1, 
				IntResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getIntResource_LowerBound(), 
				this.ecorePackage.getEInt(), 
				"lowerBound", 
				"0", 
				1, 
				1, 
				IntResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			this.initEAttribute_EClassifier(
				this.getIntResource_UpperBound(), 
				this.ecorePackage.getEInt(), 
				"upperBound", 
				"0", 
				1, 
				1, 
				IntResourceImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			
			this.initEClass(
			this.ConditionEClass,
			ConditionImpl, 
			"Condition", 
			!EPackageImpl.IS_ABSTRACT, 
			!EPackageImpl.IS_INTERFACE, 
			EPackageImpl.IS_GENERATED_INSTANCE_CLASS);
			
			this.initEAttribute_EClassifier(
				this.getCondition_Expression(), 
				this.getString(), 
				"expression", 
				null, 
				0, 
				1, 
				ConditionImpl, 
				!EPackageImpl.IS_TRANSIENT, 
				!EPackageImpl.IS_VOLATILE, 
				EPackageImpl.IS_CHANGEABLE, 
				!EPackageImpl.IS_UNSETTABLE, 
				!EPackageImpl.IS_ID, 
				EPackageImpl.IS_UNIQUE, 
				!EPackageImpl.IS_DERIVED, 
				EPackageImpl.IS_ORDERED);
			
			
			
			
			this.initEEnum(this.GoalTypeEEnum, null, "GoalType");
			this.initEEnum(this.LinkTypeEEnum, null, "LinkType");
			this.initEEnum(this.RuntimeOpEEnum, null, "RuntimeOp");
			this.initEEnum(this.ResourceKindEEnum, null, "ResourceKind");
			
        }
		
		
		private GoalTreeEClass:EClass = null;
		private NodeEClass:EClass = null;
		private GoalEClass:EClass = null;
		private TaskEClass:EClass = null;
		private LinkEClass:EClass = null;
		private ExecutionDetailsEClass:EClass = null;
		private OperandEClass:EClass = null;
		private ResourceEClass:EClass = null;
		private BoolResourceEClass:EClass = null;
		private IntResourceEClass:EClass = null;
		private ConditionEClass:EClass = null;
		
		
		private GoalTypeEEnum:EEnum = null;
		private LinkTypeEEnum:EEnum = null;
		private RuntimeOpEEnum:EEnum = null;
		private ResourceKindEEnum:EEnum = null;
		
		
		
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
		public static GOAL_FEATURE_COUNT:number = EdgemodelPackageImpl.NODE_FEATURE_COUNT + 7;
		public static GOAL_OPERATION_COUNT:number = EdgemodelPackageImpl.NODE_OPERATION_COUNT + 0;
		
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
		public static TASK_FEATURE_COUNT:number = EdgemodelPackageImpl.NODE_FEATURE_COUNT + 1;
		public static TASK_OPERATION_COUNT:number = EdgemodelPackageImpl.NODE_OPERATION_COUNT + 0;
		
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
		public static BOOLRESOURCE_FEATURE_COUNT:number = EdgemodelPackageImpl.RESOURCE_FEATURE_COUNT + 1;
		public static BOOLRESOURCE_OPERATION_COUNT:number = EdgemodelPackageImpl.RESOURCE_OPERATION_COUNT + 0;
		
		public static BOOL_RESOURCE__KIND:number = 0;
		public static BOOL_RESOURCE__NAME:number = 1;
		public static BOOL_RESOURCE__ID:number = 2;
		public static BOOL_RESOURCE__INITIAL_VALUE:number = 3;
		
		public static INTRESOURCE:number = 13;
		public static INTRESOURCE_FEATURE_COUNT:number = EdgemodelPackageImpl.RESOURCE_FEATURE_COUNT + 3;
		public static INTRESOURCE_OPERATION_COUNT:number = EdgemodelPackageImpl.RESOURCE_OPERATION_COUNT + 0;
		
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
		
		
		/*Important: Call init() AFTER metaobject ids have been assigned.*/
		public static eINSTANCE:EdgemodelPackage = EdgemodelPackageImpl.init();
		
		
		public getGoalTree=():EClass=>{return this.GoalTreeEClass;}
		
		public getGoalTree_Root=():EReference=>{return <EReference> this.GoalTreeEClass.eStructuralFeatures.at(0);}
		public getGoalTree_AllTasks=():EReference=>{return <EReference> this.GoalTreeEClass.eStructuralFeatures.at(1);}
		public getGoalTree_AllGoals=():EReference=>{return <EReference> this.GoalTreeEClass.eStructuralFeatures.at(2);}
		public getGoalTree_AllResource=():EReference=>{return <EReference> this.GoalTreeEClass.eStructuralFeatures.at(3);}
		public getNode=():EClass=>{return this.NodeEClass;}
		
		public getNode_Id=():EAttribute=>{return <EAttribute> this.NodeEClass.eStructuralFeatures.at(0);}
		public getNode_Name=():EAttribute=>{return <EAttribute> this.NodeEClass.eStructuralFeatures.at(1);}
		public getNode_Child=():EReference=>{return <EReference> this.NodeEClass.eStructuralFeatures.at(2);}
		public getNode_DependsOn=():EReference=>{return <EReference> this.NodeEClass.eStructuralFeatures.at(3);}
		public getNode_MaxRetries=():EAttribute=>{return <EAttribute> this.NodeEClass.eStructuralFeatures.at(4);}
		public getGoal=():EClass=>{return this.GoalEClass;}
		
		public getGoal_Type=():EAttribute=>{return <EAttribute> this.GoalEClass.eStructuralFeatures.at(0);}
		public getGoal_Parent=():EReference=>{return <EReference> this.GoalEClass.eStructuralFeatures.at(1);}
		public getGoal_Context=():EReference=>{return <EReference> this.GoalEClass.eStructuralFeatures.at(2);}
		public getGoal_MaintainCondition=():EReference=>{return <EReference> this.GoalEClass.eStructuralFeatures.at(3);}
		public getGoal_Exec=():EReference=>{return <EReference> this.GoalEClass.eStructuralFeatures.at(4);}
		public getGoal_Utility=():EAttribute=>{return <EAttribute> this.GoalEClass.eStructuralFeatures.at(5);}
		public getGoal_Cost=():EAttribute=>{return <EAttribute> this.GoalEClass.eStructuralFeatures.at(6);}
		public getTask=():EClass=>{return this.TaskEClass;}
		
		public getTask_Resources=():EReference=>{return <EReference> this.TaskEClass.eStructuralFeatures.at(0);}
		public getLink=():EClass=>{return this.LinkEClass;}
		
		public getLink_Outgoing=():EReference=>{return <EReference> this.LinkEClass.eStructuralFeatures.at(0);}
		public getLink_Incoming=():EReference=>{return <EReference> this.LinkEClass.eStructuralFeatures.at(1);}
		public getExecutionDetails=():EClass=>{return this.ExecutionDetailsEClass;}
		
		public getExecutionDetails_Operator=():EAttribute=>{return <EAttribute> this.ExecutionDetailsEClass.eStructuralFeatures.at(0);}
		public getExecutionDetails_Operand=():EReference=>{return <EReference> this.ExecutionDetailsEClass.eStructuralFeatures.at(1);}
		public getOperand=():EClass=>{return this.OperandEClass;}
		
		public getOperand_RetryLimit=():EAttribute=>{return <EAttribute> this.OperandEClass.eStructuralFeatures.at(0);}
		public getOperand_Target=():EReference=>{return <EReference> this.OperandEClass.eStructuralFeatures.at(1);}
		public getResource=():EClass=>{return this.ResourceEClass;}
		
		public getResource_Kind=():EAttribute=>{return <EAttribute> this.ResourceEClass.eStructuralFeatures.at(0);}
		public getResource_Name=():EAttribute=>{return <EAttribute> this.ResourceEClass.eStructuralFeatures.at(1);}
		public getResource_Id=():EAttribute=>{return <EAttribute> this.ResourceEClass.eStructuralFeatures.at(2);}
		public getBoolResource=():EClass=>{return this.BoolResourceEClass;}
		
		public getBoolResource_InitialValue=():EAttribute=>{return <EAttribute> this.BoolResourceEClass.eStructuralFeatures.at(0);}
		public getIntResource=():EClass=>{return this.IntResourceEClass;}
		
		public getIntResource_InitialValue=():EAttribute=>{return <EAttribute> this.IntResourceEClass.eStructuralFeatures.at(0);}
		public getIntResource_LowerBound=():EAttribute=>{return <EAttribute> this.IntResourceEClass.eStructuralFeatures.at(1);}
		public getIntResource_UpperBound=():EAttribute=>{return <EAttribute> this.IntResourceEClass.eStructuralFeatures.at(2);}
		public getCondition=():EClass=>{return this.ConditionEClass;}
		
		public getCondition_Expression=():EAttribute=>{return <EAttribute> this.ConditionEClass.eStructuralFeatures.at(0);}
		public getGoalType=():EEnum=>{return this.GoalTypeEEnum;}
		public getLinkType=():EEnum=>{return this.LinkTypeEEnum;}
		public getRuntimeOp=():EEnum=>{return this.RuntimeOpEEnum;}
		public getResourceKind=():EEnum=>{return this.ResourceKindEEnum;}
		
 
}
