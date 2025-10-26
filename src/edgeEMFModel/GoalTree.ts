import {Goal} from "edgemodel/Goal";
import {Task} from "edgemodel/Task";
import {Resource} from "edgemodel/Resource";
import {OrderedSet} from "ecore/OrderedSet";
import {Bag} from "ecore/Bag";
import {Sequence} from "ecore/Sequence";
import {InternalEObject} from "ecore/InternalEObject";

export interface GoalTree
extends InternalEObject

{
	
	root:Goal;
	allTasks: Bag<Task>;
	allGoals: Sequence<Goal>;
	allResource: Bag<Resource>;
	

}

