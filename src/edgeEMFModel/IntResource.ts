import {Resource} from "edgemodel/Resource";
import {OrderedSet} from "ecore/OrderedSet";

export interface IntResource
extends Resource

{
	initialValue:number;
	lowerBound:number;
	upperBound:number;
	
	

}

