import {ResourceKind} from "edgemodel/ResourceKind";
import {OrderedSet} from "ecore/OrderedSet";
import {Set} from "ecore/Set";
import {Bag} from "ecore/Bag";
import {InternalEObject} from "ecore/InternalEObject";

export interface Resource
extends InternalEObject

{
	kind:ResourceKind;
	name:string;
	id:string;
	
	

}

