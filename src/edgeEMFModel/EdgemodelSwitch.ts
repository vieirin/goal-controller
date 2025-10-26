import {EdgemodelPackageImpl} from "edgemodel/EdgemodelPackageImpl";
import {Condition} from "edgemodel/Condition";
import {Task} from "edgemodel/Task";
import {Operand} from "edgemodel/Operand";
import {Node} from "edgemodel/Node";
import {Resource} from "edgemodel/Resource";
import {BoolResource} from "edgemodel/BoolResource";
import {ExecutionDetails} from "edgemodel/ExecutionDetails";
import {Goal} from "edgemodel/Goal";
import {IntResource} from "edgemodel/IntResource";
import {GoalTree} from "edgemodel/GoalTree";
import {EdgemodelPackage} from "edgemodel/EdgemodelPackage";
import {Link} from "edgemodel/Link";
import {Switch} from "ecore/Switch";
import {EObject} from "ecore/EObject";
import {EPackage} from "ecore/EPackage";
export class EdgemodelSwitch<T> extends Switch<T> {
	protected static modelPackage:EdgemodelPackage;
	
	constructor(){
		super();
		if (EdgemodelSwitch.modelPackage == null) {
			EdgemodelSwitch.modelPackage = EdgemodelPackageImpl.eINSTANCE;
		}	
	}
	
	public isSwitchFor(ePackage:EPackage):boolean{
		return ePackage === EdgemodelSwitch.modelPackage;
	}
	
	public doSwitch3(classifierID:number, theEObject:EObject):T {
		switch (classifierID) {
			case EdgemodelPackageImpl.GOALTREE: {
				let obj:GoalTree = <GoalTree>theEObject;
				let result:T = this.caseGoalTree(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.NODE: {
				let obj:Node = <Node>theEObject;
				let result:T = this.caseNode(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.GOAL: {
				let obj:Goal = <Goal>theEObject;
				let result:T = this.caseGoal(obj);
				if (result == null) result = this.caseNode(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.TASK: {
				let obj:Task = <Task>theEObject;
				let result:T = this.caseTask(obj);
				if (result == null) result = this.caseNode(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.LINK: {
				let obj:Link = <Link>theEObject;
				let result:T = this.caseLink(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.EXECUTIONDETAILS: {
				let obj:ExecutionDetails = <ExecutionDetails>theEObject;
				let result:T = this.caseExecutionDetails(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.OPERAND: {
				let obj:Operand = <Operand>theEObject;
				let result:T = this.caseOperand(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.RESOURCE: {
				let obj:Resource = <Resource>theEObject;
				let result:T = this.caseResource(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.BOOLRESOURCE: {
				let obj:BoolResource = <BoolResource>theEObject;
				let result:T = this.caseBoolResource(obj);
				if (result == null) result = this.caseResource(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.INTRESOURCE: {
				let obj:IntResource = <IntResource>theEObject;
				let result:T = this.caseIntResource(obj);
				if (result == null) result = this.caseResource(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			case EdgemodelPackageImpl.CONDITION: {
				let obj:Condition = <Condition>theEObject;
				let result:T = this.caseCondition(obj);
				if (result == null) result = this.defaultCase(theEObject);
				return result;
			}
			default: return this.defaultCase(theEObject);
		}
	}
	
	
	public caseGoalTree(object:GoalTree):T {
		return null;
	}
	public caseNode(object:Node):T {
		return null;
	}
	public caseGoal(object:Goal):T {
		return null;
	}
	public caseTask(object:Task):T {
		return null;
	}
	public caseLink(object:Link):T {
		return null;
	}
	public caseExecutionDetails(object:ExecutionDetails):T {
		return null;
	}
	public caseOperand(object:Operand):T {
		return null;
	}
	public caseResource(object:Resource):T {
		return null;
	}
	public caseBoolResource(object:BoolResource):T {
		return null;
	}
	public caseIntResource(object:IntResource):T {
		return null;
	}
	public caseCondition(object:Condition):T {
		return null;
	}
	
}

