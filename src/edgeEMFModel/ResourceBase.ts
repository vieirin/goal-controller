import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Resource} from "edgemodel/Resource";
import {ResourceKind} from "edgemodel/ResourceKind";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {Set} from "ecore/Set";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {Bag} from "ecore/Bag";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class ResourceBase
			extends BasicEObjectImpl
			implements Resource
			{
				private _kind:ResourceKind = ResourceKind.BOOL;
				get kind():ResourceKind{
					return this._kind;
				}
				set kind(value:ResourceKind){
					this._kind = value; 
				}
				private _name:string = '';
				get name():string{
					return this._name;
				}
				private _id:string = '';
				get id():string{
					return this._id;
				}

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return ResourceBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.RESOURCE__KIND:
							return this.kind;
						case EdgemodelPackageLiterals.RESOURCE__NAME:
							return this.name;
						case EdgemodelPackageLiterals.RESOURCE__ID:
							return this.id;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.RESOURCE__KIND:
							this.kind = <ResourceKind> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
