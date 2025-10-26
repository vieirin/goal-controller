import {Goal} from "edgemodel/Goal";
import {Link} from "edgemodel/Link";
import {OrderedSet} from "ecore/OrderedSet";
import {Bag} from "ecore/Bag";
import {InternalEObject} from "ecore/InternalEObject";

export interface Node
extends InternalEObject

{
	id:string;
	name:string;
	maxRetries:number;
	
	child:Link;
	dependsOn: OrderedSet<Goal>;
	

}

