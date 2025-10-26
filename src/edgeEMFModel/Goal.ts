import {Condition} from "edgemodel/Condition";
import {Node} from "edgemodel/Node";
import {GoalType} from "edgemodel/GoalType";
import {ExecutionDetails} from "edgemodel/ExecutionDetails";
import {Link} from "edgemodel/Link";
import {OrderedSet} from "ecore/OrderedSet";
import {Set} from "ecore/Set";

export interface Goal
extends Node

{
	type:GoalType;
	utility:number;
	cost:number;
	
	parent:Link;
	context:Condition;
	maintainCondition:Condition;
	exec:ExecutionDetails;
	

}

