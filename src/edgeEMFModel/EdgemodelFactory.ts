import {Condition} from "edgemodel/Condition";
import {Goal} from "edgemodel/Goal";
import {Task} from "edgemodel/Task";
import {IntResource} from "edgemodel/IntResource";
import {GoalTree} from "edgemodel/GoalTree";
import {Operand} from "edgemodel/Operand";
import {Node} from "edgemodel/Node";
import {Resource} from "edgemodel/Resource";
import {BoolResource} from "edgemodel/BoolResource";
import {ExecutionDetails} from "edgemodel/ExecutionDetails";
import {Link} from "edgemodel/Link";
import {EFactory} from "ecore/EFactory";
export interface EdgemodelFactory extends EFactory{
	createGoalTree():GoalTree;
	createNode():Node;
	createGoal():Goal;
	createTask():Task;
	createLink():Link;
	createExecutionDetails():ExecutionDetails;
	createOperand():Operand;
	createResource():Resource;
	createBoolResource():BoolResource;
	createIntResource():IntResource;
	createCondition():Condition;
}
