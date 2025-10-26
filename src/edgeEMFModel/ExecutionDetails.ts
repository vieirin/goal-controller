import {RuntimeOp} from "edgemodel/RuntimeOp";
import {Operand} from "edgemodel/Operand";
import {OrderedSet} from "ecore/OrderedSet";
import {InternalEObject} from "ecore/InternalEObject";

export interface ExecutionDetails
extends InternalEObject

{
	operator:RuntimeOp;
	
	operand: OrderedSet<Operand>;
	

}

