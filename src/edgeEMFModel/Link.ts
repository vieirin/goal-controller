import {Goal} from "edgemodel/Goal";
import {Node} from "edgemodel/Node";
import {OrderedSet} from "ecore/OrderedSet";
import {InternalEObject} from "ecore/InternalEObject";

export interface Link
extends InternalEObject

{
	
	outgoing: OrderedSet<Goal>;
	incoming:Node;
	

}

