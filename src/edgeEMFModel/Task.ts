import {Node} from "edgemodel/Node";
import {Resource} from "edgemodel/Resource";
import {OrderedSet} from "ecore/OrderedSet";

export interface Task
extends Node

{
	
	resources: OrderedSet<Resource>;
	

}

