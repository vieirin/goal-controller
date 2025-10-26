import {Node} from "edgemodel/Node";
import {OrderedSet} from "ecore/OrderedSet";
import {Set} from "ecore/Set";
import {InternalEObject} from "ecore/InternalEObject";

export interface Operand
extends InternalEObject

{
	retryLimit:number;
	
	target: OrderedSet<Node>;
	

}

