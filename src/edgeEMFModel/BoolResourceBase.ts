import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {ResourceImpl} from "edgemodel/ResourceImpl";
import {BoolResource} from "edgemodel/BoolResource";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class BoolResourceBase
			extends ResourceImpl
			implements BoolResource
			{
				private _initialValue:boolean = false;
				get initialValue():boolean{
					return this._initialValue;
				}
				set initialValue(value:boolean){
					this._initialValue = value; 
				}

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return BoolResourceBase.eStaticClass;
				}
			
			
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.BOOL_RESOURCE__KIND:
							return this.kind;
						case EdgemodelPackageLiterals.BOOL_RESOURCE__NAME:
							return this.name;
						case EdgemodelPackageLiterals.BOOL_RESOURCE__ID:
							return this.id;
						case EdgemodelPackageLiterals.BOOL_RESOURCE__INITIAL_VALUE:
							return this.initialValue;
					}
					//return this.eGetFromResource(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.BOOL_RESOURCE__INITIAL_VALUE:
							this.initialValue = <boolean> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
